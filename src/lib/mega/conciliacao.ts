import { vencimentoEfetivo } from "./vencimento";
import { formatarBRL } from "@/lib/locacao";

/**
 * O casamento entre o que o Mega pagou e o que o Loca deve.
 *
 * Puro de propósito, como `espelho.ts`: a regra de casamento é invenção nossa,
 * e invenção nossa precisa de teste em memória.
 *
 * ELE NÃO DÁ BAIXA. Devolve SUGESTÕES, que um humano confirma. A assimetria é
 * o motivo: sugestão errada é recusada em dois segundos; baixa errada vira um
 * contrato quitado que ninguém cobra, e só aparece quando o fornecedor liga.
 */

/**
 * Coluna `numeric` como ela de fato chega: número OU string.
 *
 * O tipo é honesto de propósito. Declarar `number` e confiar fez o `===` com
 * zero falhar em silêncio; quem escrever o próximo leitor tropeça no tipo
 * antes de tropeçar na fila vazia.
 */
export type Numerico = number | string;

export type TituloQuitado = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  tipo_documento: string;
  numero_documento: string;
  data_vencimento: string;
  data_prorrogado: string | null;
  /** `numeric` do Postgres — o PostgREST entrega como string. Ver `Numerico`. */
  valor_parcela: Numerico;
  saldo_atual: Numerico;
};

export type LancamentoAberto = {
  id: string;
  fornecedor_id: string | null;
  imovel_id: string | null;
  /** Sempre dia 1 do mês de referência, como a coluna `competencia` guarda. */
  competencia: string;
  valor: Numerico;
  nf_numero: string | null;
  status: "pendente" | "pago";
};

export type Sugestao = {
  mega_titulo_id: string;
  lancamento_id: string | null;
  confianca: "alta" | "media" | "baixa";
  motivo: string;
};

/**
 * Tipos de documento em que o número É a nota.
 *
 * SÓ `NF`, e o conjunto é preso à medição: dos 465 títulos do espelho medidos
 * em 11/09/2026, `NF` foi o único tipo em que o campo se mostrou confiável (9
 * genéricos em 183). `RECIBO` (92 em 94), `CONTRATO` (7 em 7) e `ALUGUEL` (20
 * em 22) ficaram de fora porque a medição os reprovou; `NFE`, `NFS`, `NFSE` e
 * `FATURA` ficam de fora porque a medição não os viu — e admitir um tipo não
 * medido é apostar que ele se comporta como `NF`.
 *
 * O que justifica ampliar: uma nova medição sobre o espelho, com a contagem de
 * genéricos por tipo, registrada no AGENTS.md. Nada além disso.
 */
const TIPOS_FISCAIS = new Set(["NF"]);

/**
 * A competência do título: o mês do vencimento EFETIVO.
 *
 * A prorrogada, nunca a original. Prorrogar de 03/12/2024 para 31/03/2025 muda
 * o mês, e casar pela original jogaria o pagamento na competência errada.
 */
export function competenciaDoTitulo(t: {
  data_vencimento: string;
  data_prorrogado: string | null;
}): string {
  const efetivo = vencimentoEfetivo({
    dataVencimento: t.data_vencimento,
    dataProrrogado: t.data_prorrogado,
  });
  return `${efetivo.slice(0, 7)}-01`;
}

/**
 * Dá para acreditar neste número de documento?
 *
 * DUAS PORTAS, e as duas têm de abrir. O tipo manda: em `NF` o campo é a nota
 * (9 genéricos em 183); em `RECIBO` não é (92 de 94), nem em `CONTRATO` (7 de
 * 7) ou `ALUGUEL` (20 de 22). E 1 a 3 dígitos é o lançador numerando à mão —
 * "1", "2", "3" — mesmo sob um tipo fiscal.
 */
export function documentoConfiavel(tipo: string, numero: string): boolean {
  const n = numero.trim();
  if (n.length === 0 || n.length <= 3) return false;
  return TIPOS_FISCAIS.has(tipo.trim().toUpperCase());
}

/** O dono do título/lançamento, com o TIPO junto: "f:uuid" ou "i:uuid". */
function agente(x: { fornecedor_id: string | null; imovel_id: string | null }): string | null {
  if (x.fornecedor_id) return `f:${x.fornecedor_id}`;
  if (x.imovel_id) return `i:${x.imovel_id}`;
  return null;
}

/** As mesmas linhas, já com os numéricos coeridos. Uso interno. */
type TituloNum = Omit<TituloQuitado, "valor_parcela" | "saldo_atual"> & {
  valor_parcela: number;
  saldo_atual: number;
};
type LancamentoNum = Omit<LancamentoAberto, "valor"> & { valor: number };

function mesmoValor(a: number, b: number): boolean {
  // Um centavo de folga: os dois lados são numeric(14,2), mas passam por float
  // no caminho até aqui.
  return Math.abs(a - b) < 0.005;
}

export function sugerirConciliacao({
  titulos,
  lancamentos,
}: {
  titulos: TituloQuitado[];
  lancamentos: LancamentoAberto[];
}): Sugestao[] {
  // SÓ TÍTULO QUITADO. Em aberto, a prorrogada é previsão, não pagamento.
  //
  // `Number()` antes de comparar, e não é zelo: o PostgREST devolve `numeric`
  // como STRING, e `"0.00" === 0` é falso. Sem a coerção, nada seria proposto,
  // o cron reportaria sucesso e a tela diria "Nada a conciliar" para sempre —
  // uma fila vazia não parece defeito. O mesmo vale para o valor da parcela,
  // que alimenta a comparação de centavos.
  const quitados: TituloNum[] = titulos
    .map((t) => ({
      ...t,
      valor_parcela: Number(t.valor_parcela),
      saldo_atual: Number(t.saldo_atual),
    }))
    .filter((t) => t.saldo_atual === 0);

  // Índice por agente+competência. O lançamento já pago fica de fora: ele não
  // precisa de baixa, e propor uma seria pedir para alguém confirmar o já feito.
  const porChave = new Map<string, LancamentoNum[]>();
  for (const bruto of lancamentos) {
    if (bruto.status === "pago") continue;
    // Mesma defesa do lado do Loca: `valor` também é `numeric`.
    const l = { ...bruto, valor: Number(bruto.valor) };
    const ag = agente(l);
    if (!ag) continue;
    const chave = `${ag}|${l.competencia}`;
    const lista = porChave.get(chave);
    if (lista) lista.push(l);
    else porChave.set(chave, [l]);
  }

  // UM LANÇAMENTO SÓ RECEBE UMA SUGESTÃO. Duas parcelas idênticas na mesma
  // competência existem (e são raras); deixar a segunda sem casamento é o erro
  // barato. Casar as duas no mesmo lançamento proporia baixa dupla.
  const usados = new Set<string>();
  const sugestoes: Sugestao[] = [];

  // Ordem estável: o documento confiável escolhe primeiro. Sem isto, um título
  // com evidência forte poderia perder o lançamento para um vizinho fraco só
  // por vir depois na lista.
  const ordenados = [...quitados].sort((a, b) => {
    const fa = documentoConfiavel(a.tipo_documento, a.numero_documento) ? 0 : 1;
    const fb = documentoConfiavel(b.tipo_documento, b.numero_documento) ? 0 : 1;
    return fa - fb;
  });

  for (const t of ordenados) {
    const ag = agente(t);
    if (!ag) {
      // AGENTE SEM VÍNCULO NÃO GERA CASAMENTO, e não é omissão: resolver agente
      // por nome ou por valor errou 3 de 8 em 10/09/2026. Alguém preenche o
      // `codigo_mega` e a rodada seguinte resolve.
      sugestoes.push({
        mega_titulo_id: t.id,
        lancamento_id: null,
        confianca: "baixa",
        motivo:
          "O título não está vinculado a nenhum fornecedor ou imóvel do Loca. " +
          "Preencha o código do Mega no cadastro para o sistema propor o casamento.",
      });
      continue;
    }

    const competencia = competenciaDoTitulo(t);
    const candidatos = (porChave.get(`${ag}|${competencia}`) ?? []).filter(
      (l) => !usados.has(l.id),
    );

    const fiscal = documentoConfiavel(t.tipo_documento, t.numero_documento);
    const porDocumento = fiscal
      ? candidatos.find((l) => (l.nf_numero ?? "").trim() === t.numero_documento.trim())
      : undefined;
    const porValor = candidatos.find((l) => mesmoValor(l.valor, t.valor_parcela));
    const escolhido = porDocumento ?? porValor ?? candidatos[0];

    if (!escolhido) {
      sugestoes.push({
        mega_titulo_id: t.id,
        lancamento_id: null,
        confianca: "baixa",
        motivo: `Nenhum lançamento em aberto para este agente na competência ${competencia.slice(0, 7)}.`,
      });
      continue;
    }

    usados.add(escolhido.id);

    const razoes: string[] = [`Competência ${competencia.slice(0, 7)}.`];
    if (porDocumento) razoes.push(`Documento ${t.numero_documento} bate com a NF do lançamento.`);
    const diferenca = t.valor_parcela - escolhido.valor;
    if (mesmoValor(t.valor_parcela, escolhido.valor)) {
      razoes.push("Valor idêntico.");
    } else {
      // A DIFERENÇA É O QUE INTERESSA. Ela é a multa, o juro ou o desconto — e
      // é por isso que ela vai escrita no motivo, não escondida.
      razoes.push(
        `O Loca esperava ${formatarBRL(escolhido.valor)} e o Mega pagou ` +
          `${formatarBRL(t.valor_parcela)} — diferença de ${formatarBRL(Math.abs(diferenca))}.`,
      );
    }

    const confianca: Sugestao["confianca"] = porDocumento
      ? "alta"
      : mesmoValor(t.valor_parcela, escolhido.valor)
        ? "media"
        : "baixa";

    sugestoes.push({
      mega_titulo_id: t.id,
      lancamento_id: escolhido.id,
      confianca,
      motivo: razoes.join(" "),
    });
  }

  return sugestoes;
}
