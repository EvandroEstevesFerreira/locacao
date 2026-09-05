// Os três relatórios do ciclo físico do equipamento — fase 4.
//
// Em arquivo próprio porque `relatorios.ts` já passava de novecentas linhas, e
// porque estes três nascem de um dado que não existia até a fase 2: devolução
// não era documento, avaria não tinha responsável e reparo de equipamento não
// existia.
//
// SEM `import "server-only"`, ao contrário do resto de `src/lib/data/`, e a
// razão é indireta: quem importa daqui é `relatorios.ts`, e ELE é importado por
// um componente cliente — `configuracoes/config-relatorio-form.tsx` precisa de
// `TIPOS_RELATORIO` para montar o seletor. `server-only` aqui envenena a cadeia
// inteira e o build quebra em cinco lugares que não têm nada a ver com isto.
//
// A proteção real não é a diretiva: estas funções recebem o `supabase` de quem
// chama e não abrem cliente nenhum, então não há credencial a vazar.
//
// Eles NÃO engolem erro. `gerarRelatorio` alimenta PDF, Excel e e-mail de cron:
// um `[]` silencioso aqui produziria um relatório plausível e errado entregue a
// um cliente (regra do AGENTS.md). Quem chama trata; `(app)/error.tsx` é a rede.

import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeISOSaoPaulo } from "./locacao";
import type { Relatorio, FiltrosRelatorio } from "./relatorios";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>;

/**
 * Dias de calendário entre duas datas ISO, podendo ser NEGATIVO.
 *
 * Diferente de `diasDePosse`, que trunca em zero: aqui o negativo é informação
 * — "faltam 3 dias para o prazo" é diferente de "no prazo", e a coluna de
 * atraso perde o sentido se todo prazo futuro virar zero.
 *
 * A conta é feita em UTC a partir das partes da data, e não com `new Date(iso)`:
 * as colunas são `date`, o Vercel roda em UTC, e um `Date` construído de um
 * instante deslocaria o dia.
 */
function diasEntre(de: string, ate: string): number {
  const parse = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    return Date.UTC(a, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(ate) - parse(de)) / 86_400_000);
}

type Bruta = Record<string, unknown>;
type ContratoEmbed = {
  numero?: string;
  obra_id?: string;
  fornecedor_id?: string;
  obra: { codigo: string; nome: string } | null;
  fornecedor: { nome: string } | null;
} | null;

/**
 * Conferência pendente — o relatório que mais vale dinheiro dos três.
 *
 * DEVOLUÇÃO EM RASCUNHO é o caso caro: o equipamento já saiu da obra, o saldo
 * não baixou, e o contrato segue cobrando diária por ele. Ninguém vê, porque a
 * tela do contrato mostra o item como em aberto — e está certa. O que não
 * aconteceu foi o fechamento do documento.
 *
 * RECEBIMENTO EM RASCUNHO é o inverso: a retirada não foi carimbada, então o
 * custo daquele equipamento está AUSENTE do contrato, e a obra parece mais
 * barata do que é.
 *
 * FECHADO SEM AVISO é o terceiro: o fornecedor não sabe que o equipamento
 * voltou, e é isso que ele vai alegar quando cobrar.
 */
export async function conferenciaPendente(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeISOSaoPaulo();

  const [rec, dev] = await Promise.all([
    supabase
      .from("recebimento")
      .select(
        "numero_registro, recebido_em, status, aviso_enviado_em, contrato:contrato_id(numero, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome))",
      )
      .order("recebido_em"),
    supabase
      .from("devolucao")
      .select(
        "numero_registro, devolvido_em, status, aviso_enviado_em, contrato:contrato_id(numero, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome))",
      )
      .order("devolvido_em"),
  ]);

  if (rec.error) throw rec.error;
  if (dev.error) throw dev.error;

  function montar(
    r: Bruta,
    tipo: string,
    chaveData: string,
    efeito: string,
  ): Record<string, string | number | null> | null {
    const c = r.contrato as ContratoEmbed;
    if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return null;
    if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id) {
      return null;
    }

    const rascunho = r.status === "rascunho";
    const semAviso = r.status === "fechado" && r.aviso_enviado_em === null;
    if (!rascunho && !semAviso) return null;

    const data = String(r[chaveData] ?? "");
    return {
      tipo,
      registro: (r.numero_registro as string | null) ?? "(sem número)",
      data: data || null,
      obra: c?.obra ? `${c.obra.codigo} — ${c.obra.nome}` : "—",
      contrato: c?.numero ?? "—",
      fornecedor: c?.fornecedor?.nome ?? "—",
      pendencia: rascunho ? "Em rascunho" : "Fornecedor não avisado",
      // O efeito em dinheiro, escrito. Sem esta coluna o relatório é uma lista
      // de tarefas administrativas; com ela, é a conta que está correndo.
      efeito: rascunho ? efeito : "Fornecedor pode cobrar o que já voltou",
      // Dias parados ordenam pela urgência: um rascunho de três dias é
      // esquecimento, um de trinta é dinheiro.
      dias: data ? diasEntre(data, hoje) : 0,
    };
  }

  const linhas = [
    ...(rec.data ?? []).map((r) =>
      montar(
        r as Bruta,
        "Recebimento",
        "recebido_em",
        "Custo do equipamento ausente do contrato",
      ),
    ),
    ...(dev.data ?? []).map((r) =>
      montar(
        r as Bruta,
        "Devolução",
        "devolvido_em",
        "Diária correndo sobre equipamento já devolvido",
      ),
    ),
  ]
    .filter((l): l is Record<string, string | number | null> => l !== null)
    .sort((a, b) => Number(b.dias) - Number(a.dias));

  return {
    titulo: "Conferência pendente",
    agruparPor: "obra",
    colunas: [
      { key: "tipo", label: "Tipo", tipo: "texto" },
      { key: "registro", label: "Registro", tipo: "texto" },
      { key: "data", label: "Data", tipo: "data" },
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "pendencia", label: "Pendência", tipo: "texto" },
      { key: "efeito", label: "O que está acontecendo", tipo: "texto" },
      { key: "dias", label: "Dias parado", tipo: "numero" },
    ],
    linhas,
  };
}

/**
 * Equipamento em conserto — onde a máquina está e há quanto tempo.
 *
 * Só ordens ABERTAS e EM EXECUÇÃO. Uma ordem concluída já devolveu a peça, e
 * misturar as duas transformaria um relatório operacional — o que olhar de
 * manhã — num histórico.
 */
export async function equipamentoFora(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeISOSaoPaulo();
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(
      "numero_registro, status, descricao, executor, aberto_em, enviado_em, previsto_para, valor, responsabilidade, unidade:unidade_id(identificador, item:item_id(descricao))",
    )
    .in("status", ["aberto", "em_execucao"])
    .order("enviado_em");

  if (error) throw error;

  const situacao: Record<string, string> = {
    aberto: "Aberta — peça na obra",
    em_execucao: "Em execução — peça fora",
  };
  const paga: Record<string, string> = {
    indefinida: "A apurar",
    fornecedor: "Do fornecedor",
    obra: "Da obra",
    funcionario: "De funcionário",
  };

  // O recorte por obra NÃO se aplica aqui, e é deliberado: a peça é da
  // ORGANIZAÇÃO e circula entre obras, então filtrar por obra esconderia
  // justamente o conserto da máquina que aquela obra vai receber. Mesma razão
  // da RLS por organização na migration 0068.
  void filtros;

  const linhas = (data ?? []).map((r: Bruta) => {
    const un = r.unidade as {
      identificador?: string;
      item: { descricao: string } | null;
    } | null;
    const enviado = (r.enviado_em as string | null) ?? null;
    const previsto = (r.previsto_para as string | null) ?? null;
    return {
      ordem: (r.numero_registro as string | null) ?? "—",
      peca: un?.identificador ?? "—",
      equipamento: un?.item?.descricao ?? "—",
      servico: r.descricao as string,
      oficina: (r.executor as string | null) ?? "—",
      saida: enviado,
      previsto,
      // Positivo = dias de ATRASO. Negativo = ainda dentro do prazo. É a única
      // coluna que alguém precisa olhar de manhã.
      atraso: previsto ? diasEntre(previsto, hoje) : 0,
      dias_fora: enviado ? diasEntre(enviado, hoje) : 0,
      valor: Number(r.valor),
      paga: paga[r.responsabilidade as string] ?? String(r.responsabilidade),
      situacao: situacao[r.status as string] ?? String(r.status),
    };
  });

  return {
    titulo: "Equipamento em conserto",
    colunas: [
      { key: "ordem", label: "Ordem", tipo: "texto" },
      { key: "peca", label: "Peça", tipo: "texto" },
      { key: "equipamento", label: "Equipamento", tipo: "texto" },
      { key: "servico", label: "Serviço", tipo: "texto" },
      { key: "oficina", label: "Oficina", tipo: "texto" },
      { key: "saida", label: "Saída", tipo: "data" },
      { key: "previsto", label: "Previsto", tipo: "data" },
      { key: "atraso", label: "Atraso (dias)", tipo: "numero" },
      { key: "dias_fora", label: "Dias fora", tipo: "numero" },
      { key: "valor", label: "Valor", tipo: "moeda" },
      { key: "paga", label: "Quem paga", tipo: "texto" },
      { key: "situacao", label: "Situação", tipo: "texto" },
    ],
    linhas,
    grafico: { labelKey: "peca", valorKey: "dias_fora" },
  };
}

/**
 * Custo de manutenção por peça.
 *
 * Só ordens CONCLUÍDAS: valor de ordem em aberto é estimativa, e somar
 * estimativa com realizado produz um total que não bate com nada — nem com o
 * financeiro, nem com a nota da oficina.
 */
export async function manutencaoCusto(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(
      "concluido_em, valor, unidade_id, unidade:unidade_id(identificador, item:item_id(descricao))",
    )
    .eq("status", "concluido")
    .order("concluido_em");

  if (error) throw error;

  type Acumulado = {
    peca: string;
    equipamento: string;
    ordens: number;
    total: number;
    ultimo: string | null;
  };
  const porPeca = new Map<string, Acumulado>();

  for (const r of (data ?? []) as Bruta[]) {
    const quando = (r.concluido_em as string | null) ?? "";
    if (filtros.inicio && quando < filtros.inicio) continue;
    if (filtros.fim && quando > filtros.fim) continue;

    const un = r.unidade as {
      identificador?: string;
      item: { descricao: string } | null;
    } | null;
    const chave = String(r.unidade_id);
    const atual = porPeca.get(chave) ?? {
      peca: un?.identificador ?? "—",
      equipamento: un?.item?.descricao ?? "—",
      ordens: 0,
      total: 0,
      ultimo: null,
    };
    atual.ordens += 1;
    atual.total += Number(r.valor);
    // A data do ÚLTIMO conserto responde "faz quanto tempo que essa máquina não
    // dá problema" — e é ela que separa a peça que se estabilizou da que está
    // quebrando toda semana.
    if (!atual.ultimo || quando > atual.ultimo) atual.ultimo = quando || null;
    porPeca.set(chave, atual);
  }

  const linhas = [...porPeca.values()]
    .sort((a, b) => b.total - a.total)
    .map((a) => ({
      peca: a.peca,
      equipamento: a.equipamento,
      ordens: a.ordens,
      total: a.total,
      // Média por ordem: uma peça com uma ordem de R$ 3.000 e outra com dez de
      // R$ 300 somam igual e são problemas completamente diferentes — uma
      // quebrou feio uma vez, a outra não para de quebrar.
      medio: a.ordens > 0 ? Math.round((a.total / a.ordens) * 100) / 100 : 0,
      ultimo: a.ultimo,
    }));

  return {
    titulo: "Custo de manutenção",
    colunas: [
      { key: "peca", label: "Peça", tipo: "texto" },
      { key: "equipamento", label: "Equipamento", tipo: "texto" },
      { key: "ordens", label: "Ordens", tipo: "numero" },
      { key: "total", label: "Total gasto", tipo: "moeda" },
      { key: "medio", label: "Média por ordem", tipo: "moeda" },
      { key: "ultimo", label: "Último conserto", tipo: "data" },
    ],
    linhas,
    grafico: { labelKey: "peca", valorKey: "total" },
  };
}
