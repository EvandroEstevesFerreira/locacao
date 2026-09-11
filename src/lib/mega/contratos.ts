import { z } from "zod";

/**
 * Os contratos do módulo `AcompanhamentoContratoEngenhariaX` do Mega.
 *
 * É o "contratado × executado" oficial: quanto foi contratado com cada
 * fornecedor em cada obra, quanto já foi medido e quanto sobra. O Loca projeta
 * o comprometido a partir dos itens cadastrados; aqui está o número do ERP.
 *
 * UMA CHAMADA TRAZ TUDO: `Visoes/GetVisoesFornecedor` sem filtro devolveu 958
 * contratos de 247 fornecedores em 11/09/2026.
 */

/**
 * `"735 - CCN AUTOMACAO LTDA"` → código e nome.
 *
 * O Mega junta os dois num campo só. O código é o que casa com
 * `fornecedor.codigo_mega` e com `obra.codigo`; o nome é o que a tela mostra.
 * O separador só vale na PRIMEIRA ocorrência: "608 - RACIONAL - DANTE" tem
 * hífen no nome, e cortar em todos devolveria "RACIONAL".
 */
export function separaCodigo(bruto: string | null | undefined): {
  codigo: string | null;
  nome: string | null;
} {
  const s = (bruto ?? "").trim();
  if (!s) return { codigo: null, nome: null };
  const m = /^(\d+)\s*-\s*(.*)$/.exec(s);
  if (!m) return { codigo: null, nome: s };
  return { codigo: m[1], nome: m[2].trim() || null };
}

/** O ERP manda o mesmo campo ora como número, ora como texto. */
const dinheiro = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return 0;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  });

const texto = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return s === "" ? null : s;
  });

export const contratoMegaSchema = z
  .object({
    cto_in_codigo: z.union([z.number(), z.string()]),
    cto_st_alternativo: texto,
    produto: texto,
    fornecedor: texto,
    projeto: texto,
    usu_criacao: texto,
    data_criacao: texto,
    total_contratado: dinheiro,
    total_distratado: dinheiro,
    medicao: dinheiro,
    saldo: dinheiro,
    nota: dinheiro,
    adiantamento: dinheiro,
  })
  .transform((c) => {
    const agente = separaCodigo(c.fornecedor);
    const projeto = separaCodigo(c.projeto);
    return {
      codigo: String(c.cto_in_codigo),
      nome: c.cto_st_alternativo,
      produto: c.produto,
      codigoAgente: agente.codigo,
      agenteNome: agente.nome,
      codigoProjeto: projeto.codigo,
      projetoNome: projeto.nome,
      totalContratado: c.total_contratado,
      totalDistratado: c.total_distratado,
      medicao: c.medicao,
      saldo: c.saldo,
      nota: c.nota,
      adiantamento: c.adiantamento,
      criadoPor: c.usu_criacao,
      criadoEmMega: c.data_criacao,
    };
  });

export type ContratoMega = z.infer<typeof contratoMegaSchema>;

/** Tolerante: uma linha fora do formato não derruba as outras 957. */
export function parseContratos(bruto: unknown): {
  contratos: ContratoMega[];
  recusados: number;
} {
  if (!Array.isArray(bruto)) return { contratos: [], recusados: 0 };
  const contratos: ContratoMega[] = [];
  let recusados = 0;
  for (const linha of bruto) {
    const r = contratoMegaSchema.safeParse(linha);
    if (r.success) contratos.push(r.data);
    else recusados += 1;
  }
  return { contratos, recusados };
}

export type ContratoAgrupado = Omit<ContratoMega, "produto"> & {
  produto: string | null;
  itens: number;
};

/**
 * Uma linha por CONTRATO, somando os itens.
 *
 * CADA LINHA DA RESPOSTA É UM ITEM, e isso não está em documentação nenhuma:
 * medido em 11/09/2026, 958 linhas para 664 contratos — o contrato 813 sozinho
 * tem 15 itens (sprinkler, tubo de cobre, execução da instalação…).
 *
 * Gravar linha a linha quebra o upsert do PostgREST com "ON CONFLICT DO UPDATE
 * command cannot affect row a second time", e foi exatamente o que derrubou a
 * primeira rodada em produção. Nem `(código, produto)` serve de chave: ainda
 * colide 77 vezes.
 *
 * SOMAR É O CERTO, e dá para provar: a soma das 19 linhas da CCN é
 * R$ 550.627,17, o mesmo que o BigNumber `GetTotalContratado` do próprio ERP
 * responde para ela.
 */
export function agruparPorContrato(itens: ContratoMega[]): ContratoAgrupado[] {
  const porCodigo = new Map<string, ContratoAgrupado>();

  for (const i of itens) {
    const atual = porCodigo.get(i.codigo);
    if (!atual) {
      porCodigo.set(i.codigo, { ...i, itens: 1 });
      continue;
    }
    atual.itens += 1;
    atual.totalContratado += i.totalContratado;
    atual.totalDistratado += i.totalDistratado;
    atual.medicao += i.medicao;
    atual.saldo += i.saldo;
    atual.nota += i.nota;
    atual.adiantamento += i.adiantamento;
    // COM MAIS DE UM ITEM O PRODUTO SOME. Mostrar o primeiro de quinze seria
    // escolher um por sorteio e apresentá-lo como sendo o contrato.
    atual.produto = null;
  }

  // Centavos: somar float acumula resíduo, e estes números vão para uma coluna
  // numeric(14,2) que vai arredondar de qualquer forma.
  for (const c of porCodigo.values()) {
    c.totalContratado = Number(c.totalContratado.toFixed(2));
    c.totalDistratado = Number(c.totalDistratado.toFixed(2));
    c.medicao = Number(c.medicao.toFixed(2));
    c.saldo = Number(c.saldo.toFixed(2));
    c.nota = Number(c.nota.toFixed(2));
    c.adiantamento = Number(c.adiantamento.toFixed(2));
  }

  return [...porCodigo.values()];
}
