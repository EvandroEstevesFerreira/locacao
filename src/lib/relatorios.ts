import type { SupabaseClient } from "@supabase/supabase-js";
import { differenceInCalendarDays } from "date-fns";
import {
  tipoImovelLabel,
  tipoConsumoLabel,
  STATUS_CAUCAO_INFO,
  type StatusCaucao,
} from "@/lib/imoveis";
import {
  calcularCusto,
  dataDeISO,
  formatarBRL,
  formatarData,
  periodosEntre,
  periodosPorMes,
  type Cadencia,
} from "@/lib/locacao";
import { hojeISOSaoPaulo, hojeSaoPaulo } from "./locacao";

export type TipoRelatorio =
  | "itens_abertos"
  | "contas_pagar"
  | "custo_por_obra"
  | "ociosidade"
  | "custo_por_fornecedor"
  | "avarias"
  | "imoveis_custo"
  | "imoveis_contratos_vencer"
  | "imoveis_sem_contrato"
  | "imoveis_consumo"
  | "imoveis_reparos"
  | "imoveis_caucao";

export const TIPOS_RELATORIO: {
  valor: TipoRelatorio;
  label: string;
  descricao: string;
  usaPeriodo: boolean;
}[] = [
  {
    valor: "itens_abertos",
    label: "Itens em aberto",
    descricao: "Itens locados ainda não devolvidos, com custo estimado.",
    usaPeriodo: false,
  },
  {
    valor: "contas_pagar",
    label: "Contas a pagar",
    descricao: "Lançamentos financeiros por período de vencimento.",
    usaPeriodo: true,
  },
  {
    valor: "custo_por_obra",
    label: "Custo por obra",
    descricao: "Total de contas a pagar agrupado por obra.",
    usaPeriodo: true,
  },
  {
    valor: "custo_por_fornecedor",
    label: "Custo por fornecedor",
    descricao: "Total de contas a pagar agrupado por fornecedor.",
    usaPeriodo: true,
  },
  {
    valor: "ociosidade",
    label: "Ociosidade",
    descricao:
      "Itens ainda em aberto atrasados ou sem previsão de devolução (risco de custo parado).",
    usaPeriodo: false,
  },
  {
    valor: "avarias",
    label: "Avarias",
    descricao: "Avarias registradas em vistorias, com custo estimado e situação.",
    usaPeriodo: true,
  },
  {
    valor: "imoveis_custo",
    label: "Imóveis — custo mensal",
    descricao:
      "Aluguel + condomínio + IPTU + seguro fiança (contrato vigente) por imóvel, com subtotal por obra.",
    usaPeriodo: false,
  },
  {
    valor: "imoveis_contratos_vencer",
    label: "Imóveis — contratos a vencer",
    descricao: "Contratos de imóvel vigentes com data de término.",
    usaPeriodo: true,
  },
  {
    valor: "imoveis_sem_contrato",
    label: "Imóveis — sem contrato",
    descricao: "Imóveis ativos sem contrato vigente.",
    usaPeriodo: false,
  },
  {
    valor: "imoveis_consumo",
    label: "Imóveis — consumo",
    descricao: "Contas de consumo (água, luz, gás...) por imóvel e mês.",
    usaPeriodo: true,
  },
  {
    valor: "imoveis_reparos",
    label: "Imóveis — reparos",
    descricao: "Reparos realizados por imóvel, com custo e executor.",
    usaPeriodo: true,
  },
  {
    valor: "imoveis_caucao",
    label: "Imóveis — caução",
    descricao: "Cauções por imóvel, com valor e situação.",
    usaPeriodo: false,
  },
];

export type TipoColuna = "texto" | "moeda" | "data" | "numero";
export type Coluna = { key: string; label: string; tipo: TipoColuna };

/** Formata um valor de célula conforme o tipo da coluna (para tela e PDF). */
export function formatarValor(
  tipo: TipoColuna,
  valor: string | number | null,
): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (tipo === "moeda") return formatarBRL(Number(valor));
  if (tipo === "data") return formatarData(String(valor));
  if (tipo === "numero") return String(valor);
  return String(valor);
}
export type Relatorio = {
  titulo: string;
  colunas: Coluna[];
  linhas: Record<string, string | number | null>[];
  agruparPor?: string; // key de coluna para subtotais (ex.: "obra")
  grafico?: { labelKey: string; valorKey: string }; // barras (agregados)
};

/** Dados prontos para um gráfico de barras a partir de `relatorio.grafico`. */
export function dadosGrafico(
  relatorio: Relatorio,
): { label: string; valor: number }[] {
  if (!relatorio.grafico) return [];
  const { labelKey, valorKey } = relatorio.grafico;
  return relatorio.linhas.map((l) => ({
    label: String(l[labelKey] ?? "—"),
    valor: Number(l[valorKey] ?? 0),
  }));
}

export type FiltrosRelatorio = {
  obra_id?: string;
  fornecedor_id?: string;
  status?: "pago" | "pendente";
  inicio?: string;
  fim?: string;
};

async function custoPorFornecedor(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  let q = supabase
    .from("lancamento_financeiro")
    .select(
      "valor, status, contrato:contrato_id(fornecedor_id, fornecedor:fornecedor_id(nome))",
    )
    .is("deleted_at", null);
  if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
  if (filtros.fim) q = q.lte("vencimento", filtros.fim);
  const { data } = await q;

  const mapa = new Map<
    string,
    { fornecedor: string; total: number; pendente: number; pago: number }
  >();
  for (const l of (data ?? []) as Record<string, unknown>[]) {
    const c = l.contrato as { fornecedor_id?: string; fornecedor: { nome: string } | null } | null;
    if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id) continue;
    const nome = c?.fornecedor?.nome ?? "Sem fornecedor";
    const atual = mapa.get(nome) ?? { fornecedor: nome, total: 0, pendente: 0, pago: 0 };
    const v = Number(l.valor);
    atual.total += v;
    if (l.status === "pago") atual.pago += v;
    else atual.pendente += v;
    mapa.set(nome, atual);
  }

  return {
    titulo: "Custo por fornecedor",
    grafico: { labelKey: "fornecedor", valorKey: "total" },
    colunas: [
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "total", label: "Total", tipo: "moeda" },
      { key: "pendente", label: "Pendente", tipo: "moeda" },
      { key: "pago", label: "Pago", tipo: "moeda" },
    ],
    linhas: Array.from(mapa.values()),
  };
}

async function ociosidade(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hojeStr = hojeISOSaoPaulo();
  const hoje = hojeSaoPaulo();
  const { data } = await supabase
    .from("item_locado")
    .select(
      "quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, contrato:contrato_id(numero, cadencia, cobranca_prorata, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)), item:item_id(descricao)",
    )
    .eq("status", "em_aberto")
    .order("data_devolucao_prevista");

  const linhas = (data ?? [])
    .filter((l: Record<string, unknown>) => {
      const c = l.contrato as { obra_id?: string; fornecedor_id?: string } | null;
      if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return false;
      if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id)
        return false;
      const dv = l.data_devolucao_prevista as string | null;
      // Ocioso = atrasado (devolução prevista já passou) ou sem previsão.
      return dv === null || dv < hojeStr;
    })
    .map((l: Record<string, unknown>) => {
      const contrato = l.contrato as {
        numero: string;
        cadencia: Cadencia;
        cobranca_prorata?: boolean;
        obra: { codigo: string; nome: string } | null;
        fornecedor: { nome: string } | null;
      } | null;
      const item = l.item as { descricao: string } | null;
      const qtd = Number(l.quantidade);
      const valor = Number(l.valor_unitario_periodo);
      const prorata = !!contrato?.cobranca_prorata;
      const retirada = dataDeISO(l.data_retirada as string);
      const custoMensal = contrato
        ? qtd * valor * periodosPorMes(contrato.cadencia)
        : null;
      const custo = contrato
        ? calcularCusto(qtd, valor, periodosEntre(contrato.cadencia, retirada, hoje, prorata))
        : null;
      const dv = l.data_devolucao_prevista as string | null;
      const atraso =
        dv === null
          ? "sem previsão"
          : `${differenceInCalendarDays(hoje, dataDeISO(dv))} dias`;
      return {
        obra: contrato?.obra
          ? `${contrato.obra.codigo} — ${contrato.obra.nome}`
          : "—",
        contrato: contrato?.numero ?? "—",
        fornecedor: contrato?.fornecedor?.nome ?? "—",
        item: item?.descricao ?? "—",
        quantidade: qtd,
        retirada: l.data_retirada as string,
        devolucao: dv,
        atraso,
        custoMensal,
        custo,
      };
    });

  return {
    titulo: "Ociosidade",
    agruparPor: "obra",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "item", label: "Item", tipo: "texto" },
      { key: "quantidade", label: "Qtd.", tipo: "numero" },
      { key: "retirada", label: "Retirada", tipo: "data" },
      { key: "devolucao", label: "Devol. prevista", tipo: "data" },
      { key: "atraso", label: "Atraso", tipo: "texto" },
      { key: "custoMensal", label: "Custo/mês", tipo: "moeda" },
      { key: "custo", label: "Custo até hoje", tipo: "moeda" },
    ],
    linhas,
  };
}

async function avarias(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const { data } = await supabase
    .from("avaria")
    .select(
      "descricao, custo_estimado, status, vistoria:vistoria_id(data, contrato:contrato_id(numero, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)))",
    )
    .order("created_at", { ascending: false });

  const situacaoLabel: Record<string, string> = {
    aberta: "Aberta",
    cobrada: "Cobrada",
    resolvida: "Resolvida",
  };

  const linhas = (data ?? [])
    .filter((a: Record<string, unknown>) => {
      const v = a.vistoria as {
        data?: string;
        contrato?: { obra_id?: string; fornecedor_id?: string } | null;
      } | null;
      const c = v?.contrato ?? null;
      if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return false;
      if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id)
        return false;
      if (filtros.inicio && (v?.data ?? "") < filtros.inicio) return false;
      if (filtros.fim && (v?.data ?? "") > filtros.fim) return false;
      return true;
    })
    .map((a: Record<string, unknown>) => {
      const v = a.vistoria as {
        data?: string;
        contrato?: {
          numero?: string;
          obra: { codigo: string; nome: string } | null;
          fornecedor: { nome: string } | null;
        } | null;
      } | null;
      const c = v?.contrato ?? null;
      return {
        data: v?.data ?? null,
        obra: c?.obra ? `${c.obra.codigo} — ${c.obra.nome}` : "—",
        contrato: c?.numero ?? "—",
        fornecedor: c?.fornecedor?.nome ?? "—",
        descricao: a.descricao as string,
        custo: Number(a.custo_estimado),
        situacao: situacaoLabel[a.status as string] ?? String(a.status),
      };
    });

  return {
    titulo: "Avarias",
    agruparPor: "obra",
    colunas: [
      { key: "data", label: "Data", tipo: "data" },
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "descricao", label: "Descrição", tipo: "texto" },
      { key: "custo", label: "Custo estimado", tipo: "moeda" },
      { key: "situacao", label: "Situação", tipo: "texto" },
    ],
    linhas,
  };
}

// ===========================================================================
// Relatórios do módulo Imóveis (Fase 6)
// ===========================================================================
type Vig = {
  valor_aluguel: number;
  valor_condominio: number;
  valor_iptu: number;
  seguro_fianca: number;
  seguro_fianca_mensal: boolean;
  vigente: boolean;
};

async function imoveisCusto(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("imovel")
    .select("apelido, tipo, obra_id, obra:obra_id(codigo, nome), contrato_imovel(valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, vigente)")
    .is("deleted_at", null)
    .order("apelido");
  const linhas = (data ?? [])
    .filter((i: Record<string, unknown>) => !filtros.obra_id || i.obra_id === filtros.obra_id)
    .map((i: Record<string, unknown>) => {
      const obra = i.obra as { codigo: string; nome: string } | null;
      const vig = ((i.contrato_imovel as Vig[]) ?? []).find((c) => c.vigente);
      const aluguel = vig ? Number(vig.valor_aluguel) : 0;
      const cond = vig ? Number(vig.valor_condominio) : 0;
      const iptu = vig ? Number(vig.valor_iptu) : 0;
      const seguro = vig && vig.seguro_fianca_mensal ? Number(vig.seguro_fianca) : 0;
      return {
        obra: obra ? `${obra.codigo} — ${obra.nome}` : "Sem obra",
        imovel: i.apelido as string,
        tipo: tipoImovelLabel(i.tipo as string),
        aluguel,
        condominio: cond,
        iptu,
        seguro,
        total: aluguel + cond + iptu + seguro,
      };
    });
  return {
    titulo: "Imóveis — custo mensal",
    agruparPor: "obra",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "tipo", label: "Tipo", tipo: "texto" },
      { key: "aluguel", label: "Aluguel", tipo: "moeda" },
      { key: "condominio", label: "Condomínio", tipo: "moeda" },
      { key: "iptu", label: "IPTU", tipo: "moeda" },
      { key: "seguro", label: "Seguro fiança", tipo: "moeda" },
      { key: "total", label: "Total/mês", tipo: "moeda" },
    ],
    linhas,
  };
}

async function imoveisContratosVencer(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("contrato_imovel")
    .select("data_inicio, data_fim, valor_aluguel, imovel:imovel_id(apelido, obra_id, obra:obra_id(codigo))")
    .eq("vigente", true)
    .not("data_fim", "is", null)
    .order("data_fim");
  const linhas = (data ?? [])
    .filter((c: Record<string, unknown>) => {
      const imv = c.imovel as { obra_id?: string } | null;
      if (filtros.obra_id && imv?.obra_id !== filtros.obra_id) return false;
      const fim = c.data_fim as string;
      if (filtros.inicio && fim < filtros.inicio) return false;
      if (filtros.fim && fim > filtros.fim) return false;
      return true;
    })
    .map((c: Record<string, unknown>) => {
      const imv = c.imovel as { apelido: string; obra: { codigo: string } | null } | null;
      return {
        imovel: imv?.apelido ?? "—",
        obra: imv?.obra?.codigo ?? "—",
        inicio: (c.data_inicio as string | null) ?? null,
        fim: c.data_fim as string,
        aluguel: Number(c.valor_aluguel),
      };
    });
  return {
    titulo: "Imóveis — contratos a vencer",
    colunas: [
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "inicio", label: "Início", tipo: "data" },
      { key: "fim", label: "Fim", tipo: "data" },
      { key: "aluguel", label: "Aluguel", tipo: "moeda" },
    ],
    linhas,
  };
}

async function imoveisSemContrato(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("imovel")
    .select("apelido, tipo, obra_id, obra:obra_id(codigo), contrato_imovel(vigente)")
    .is("deleted_at", null)
    .eq("status", "ativo")
    .order("apelido");
  const linhas = (data ?? [])
    .filter((i: Record<string, unknown>) => {
      if (filtros.obra_id && i.obra_id !== filtros.obra_id) return false;
      const cts = (i.contrato_imovel as { vigente: boolean }[]) ?? [];
      return !cts.some((c) => c.vigente);
    })
    .map((i: Record<string, unknown>) => {
      const obra = i.obra as { codigo: string } | null;
      return {
        imovel: i.apelido as string,
        tipo: tipoImovelLabel(i.tipo as string),
        obra: obra?.codigo ?? "—",
      };
    });
  return {
    titulo: "Imóveis — sem contrato",
    colunas: [
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "tipo", label: "Tipo", tipo: "texto" },
      { key: "obra", label: "Obra", tipo: "texto" },
    ],
    linhas,
  };
}

async function imoveisConsumo(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("conta_consumo")
    .select("tipo, competencia, valor, pago, imovel:imovel_id(apelido, obra_id, obra:obra_id(codigo))")
    .order("competencia", { ascending: false });
  const linhas = (data ?? [])
    .filter((c: Record<string, unknown>) => {
      const imv = c.imovel as { obra_id?: string } | null;
      if (filtros.obra_id && imv?.obra_id !== filtros.obra_id) return false;
      const comp = c.competencia as string;
      if (filtros.inicio && comp < filtros.inicio) return false;
      if (filtros.fim && comp > filtros.fim) return false;
      return true;
    })
    .map((c: Record<string, unknown>) => {
      const imv = c.imovel as { apelido: string } | null;
      return {
        imovel: imv?.apelido ?? "—",
        competencia: c.competencia as string,
        tipo: tipoConsumoLabel(c.tipo as string),
        valor: Number(c.valor),
        status: c.pago ? "Pago" : "Pendente",
      };
    });
  return {
    titulo: "Imóveis — consumo",
    agruparPor: "imovel",
    colunas: [
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "competencia", label: "Competência", tipo: "data" },
      { key: "tipo", label: "Tipo", tipo: "texto" },
      { key: "valor", label: "Valor", tipo: "moeda" },
      { key: "status", label: "Status", tipo: "texto" },
    ],
    linhas,
  };
}

async function imoveisReparos(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("reparo_imovel")
    .select("data, descricao, valor, executor, imovel:imovel_id(apelido, obra_id, obra:obra_id(codigo))")
    .order("data", { ascending: false });
  const linhas = (data ?? [])
    .filter((r: Record<string, unknown>) => {
      const imv = r.imovel as { obra_id?: string } | null;
      if (filtros.obra_id && imv?.obra_id !== filtros.obra_id) return false;
      const d = r.data as string;
      if (filtros.inicio && d < filtros.inicio) return false;
      if (filtros.fim && d > filtros.fim) return false;
      return true;
    })
    .map((r: Record<string, unknown>) => {
      const imv = r.imovel as { apelido: string } | null;
      return {
        imovel: imv?.apelido ?? "—",
        data: r.data as string,
        descricao: r.descricao as string,
        executor: (r.executor as string | null) ?? "—",
        valor: Number(r.valor),
      };
    });
  return {
    titulo: "Imóveis — reparos",
    agruparPor: "imovel",
    colunas: [
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "data", label: "Data", tipo: "data" },
      { key: "descricao", label: "Descrição", tipo: "texto" },
      { key: "executor", label: "Executor", tipo: "texto" },
      { key: "valor", label: "Valor", tipo: "moeda" },
    ],
    linhas,
  };
}

async function imoveisCaucao(supabase: DB, filtros: FiltrosRelatorio): Promise<Relatorio> {
  const { data } = await supabase
    .from("contrato_imovel")
    .select("caucao_valor, caucao_status, imovel:imovel_id(apelido, obra_id, obra:obra_id(codigo))")
    .eq("vigente", true)
    .not("caucao_valor", "is", null);
  const linhas = (data ?? [])
    .filter((c: Record<string, unknown>) => {
      const imv = c.imovel as { obra_id?: string } | null;
      return !filtros.obra_id || imv?.obra_id === filtros.obra_id;
    })
    .map((c: Record<string, unknown>) => {
      const imv = c.imovel as { apelido: string; obra: { codigo: string } | null } | null;
      const status = c.caucao_status as string | null;
      return {
        imovel: imv?.apelido ?? "—",
        obra: imv?.obra?.codigo ?? "—",
        valor: Number(c.caucao_valor),
        situacao: status ? STATUS_CAUCAO_INFO[status as StatusCaucao] : "—",
      };
    });
  return {
    titulo: "Imóveis — caução",
    colunas: [
      { key: "imovel", label: "Imóvel", tipo: "texto" },
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "valor", label: "Valor da caução", tipo: "moeda" },
      { key: "situacao", label: "Situação", tipo: "texto" },
    ],
    linhas,
  };
}

export type LinhaRelatorio =
  | { tipo: "dado"; valores: Record<string, string | number | null> }
  | { tipo: "subtotal"; rotulo: string; valores: Record<string, number> }
  | { tipo: "total"; rotulo: string; valores: Record<string, number> };

/**
 * Expande as linhas cruas de um relatório inserindo subtotais por grupo
 * (quando `agruparPor` está definido) e um total geral. Soma apenas colunas
 * de tipo "moeda". Puro — sem I/O.
 */
export function expandirLinhas(relatorio: Relatorio): LinhaRelatorio[] {
  const moedaKeys = relatorio.colunas
    .filter((c) => c.tipo === "moeda")
    .map((c) => c.key);
  const dados = relatorio.linhas;
  if (dados.length === 0) return [];

  const somar = (linhas: Record<string, string | number | null>[]) => {
    const acc: Record<string, number> = {};
    for (const k of moedaKeys) {
      acc[k] = linhas.reduce((s, l) => s + Number(l[k] ?? 0), 0);
    }
    return acc;
  };

  const out: LinhaRelatorio[] = [];

  if (relatorio.agruparPor && moedaKeys.length > 0) {
    const chave = relatorio.agruparPor;
    const ordenadas = [...dados].sort((a, b) =>
      String(a[chave] ?? "").localeCompare(String(b[chave] ?? "")),
    );
    let grupoAtual: string | null = null;
    let bucket: Record<string, string | number | null>[] = [];
    const flush = () => {
      if (bucket.length === 0) return;
      out.push({
        tipo: "subtotal",
        rotulo: String(grupoAtual ?? ""),
        valores: somar(bucket),
      });
      bucket = [];
    };
    for (const l of ordenadas) {
      const g = String(l[chave] ?? "");
      if (grupoAtual === null) grupoAtual = g;
      if (g !== grupoAtual) {
        flush();
        grupoAtual = g;
      }
      out.push({ tipo: "dado", valores: l });
      bucket.push(l);
    }
    flush();
  } else {
    for (const l of dados) out.push({ tipo: "dado", valores: l });
  }

  if (moedaKeys.length > 0) {
    out.push({ tipo: "total", rotulo: "TOTAL GERAL", valores: somar(dados) });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>;

export async function gerarRelatorio(
  supabase: DB,
  tipo: TipoRelatorio,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  if (tipo === "itens_abertos") return itensAbertos(supabase, filtros);
  if (tipo === "contas_pagar") return contasPagar(supabase, filtros);
  if (tipo === "custo_por_obra") return custoPorObra(supabase, filtros);
  if (tipo === "custo_por_fornecedor")
    return custoPorFornecedor(supabase, filtros);
  if (tipo === "ociosidade") return ociosidade(supabase, filtros);
  if (tipo === "avarias") return avarias(supabase, filtros);
  if (tipo === "imoveis_custo") return imoveisCusto(supabase, filtros);
  if (tipo === "imoveis_contratos_vencer")
    return imoveisContratosVencer(supabase, filtros);
  if (tipo === "imoveis_sem_contrato") return imoveisSemContrato(supabase, filtros);
  if (tipo === "imoveis_consumo") return imoveisConsumo(supabase, filtros);
  if (tipo === "imoveis_reparos") return imoveisReparos(supabase, filtros);
  return imoveisCaucao(supabase, filtros);
}

async function itensAbertos(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeSaoPaulo();
  const { data } = await supabase
    .from("item_locado")
    .select(
      "quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, contrato:contrato_id(numero, cadencia, cobranca_prorata, data_fim_prevista, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)), item:item_id(descricao)",
    )
    .eq("status", "em_aberto")
    .order("data_retirada");

  const linhas = (data ?? [])
    .filter((l: Record<string, unknown>) => {
      const c = l.contrato as { obra_id?: string; fornecedor_id?: string } | null;
      if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return false;
      if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id)
        return false;
      return true;
    })
    .map((l: Record<string, unknown>) => {
      const contrato = l.contrato as {
        numero: string;
        cadencia: Cadencia;
        cobranca_prorata?: boolean;
        data_fim_prevista?: string | null;
        obra: { codigo: string; nome: string } | null;
        fornecedor: { nome: string } | null;
      } | null;
      const item = l.item as { descricao: string } | null;
      const qtd = Number(l.quantidade);
      const valor = Number(l.valor_unitario_periodo);
      const prorata = !!contrato?.cobranca_prorata;
      const retirada = dataDeISO(l.data_retirada as string);

      // Custo acumulado até hoje.
      const periodos = contrato
        ? periodosEntre(contrato.cadencia, retirada, hoje, prorata)
        : 0;
      const custo = calcularCusto(qtd, valor, periodos);

      // Custo por mês (normalizado pela cadência).
      const custoMensal = contrato
        ? qtd * valor * periodosPorMes(contrato.cadencia)
        : null;

      // Custo total previsto até o fim da locação (devol. prevista do item ou
      // fim previsto do contrato).
      const fimISO =
        (l.data_devolucao_prevista as string | null) ??
        contrato?.data_fim_prevista ??
        null;
      const custoAteFim =
        contrato && fimISO
          ? calcularCusto(
              qtd,
              valor,
              periodosEntre(contrato.cadencia, retirada, dataDeISO(fimISO), prorata),
            )
          : null;

      return {
        obra: contrato?.obra
          ? `${contrato.obra.codigo} — ${contrato.obra.nome}`
          : "—",
        contrato: contrato?.numero ?? "—",
        fornecedor: contrato?.fornecedor?.nome ?? "—",
        item: item?.descricao ?? "—",
        quantidade: qtd,
        retirada: l.data_retirada as string,
        devolucao: (l.data_devolucao_prevista as string | null) ?? null,
        custoMensal,
        custo,
        custoAteFim,
      };
    });

  return {
    titulo: "Itens em aberto",
    agruparPor: "obra",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "item", label: "Item", tipo: "texto" },
      { key: "quantidade", label: "Qtd.", tipo: "numero" },
      { key: "retirada", label: "Retirada", tipo: "data" },
      { key: "devolucao", label: "Devol. prevista", tipo: "data" },
      { key: "custoMensal", label: "Custo/mês", tipo: "moeda" },
      { key: "custo", label: "Custo até hoje", tipo: "moeda" },
      { key: "custoAteFim", label: "Custo até o fim", tipo: "moeda" },
    ],
    linhas,
  };
}

async function contasPagar(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  let q = supabase
    .from("lancamento_financeiro")
    .select(
      "descricao, competencia, vencimento, valor, status, obra:obra_id(codigo,nome), contrato:contrato_id(fornecedor_id, fornecedor:fornecedor_id(nome))",
    )
    .is("deleted_at", null)
    .order("vencimento");
  if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
  if (filtros.fim) q = q.lte("vencimento", filtros.fim);
  const { data } = await q;

  const linhas = (data ?? [])
    .filter((l: Record<string, unknown>) => {
      if (!filtros.fornecedor_id) return true;
      const c = l.contrato as { fornecedor_id?: string } | null;
      return c?.fornecedor_id === filtros.fornecedor_id;
    })
    .map((l: Record<string, unknown>) => {
      const obra = l.obra as { codigo: string; nome: string } | null;
      const contrato = l.contrato as { fornecedor: { nome: string } | null } | null;
      return {
        obra: obra ? `${obra.codigo} — ${obra.nome}` : "—",
        fornecedor: contrato?.fornecedor?.nome ?? "—",
        descricao: l.descricao as string,
        competencia: l.competencia as string,
        vencimento: l.vencimento as string,
        valor: Number(l.valor),
        status: l.status === "pago" ? "Pago" : "Pendente",
      };
    });

  return {
    titulo: "Contas a pagar",
    agruparPor: "obra",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "descricao", label: "Descrição", tipo: "texto" },
      { key: "competencia", label: "Competência", tipo: "data" },
      { key: "vencimento", label: "Vencimento", tipo: "data" },
      { key: "valor", label: "Valor", tipo: "moeda" },
      { key: "status", label: "Status", tipo: "texto" },
    ],
    linhas,
  };
}

async function custoPorObra(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  let q = supabase
    .from("lancamento_financeiro")
    .select(
      "valor, status, obra:obra_id(codigo,nome), contrato:contrato_id(fornecedor_id)",
    )
    .is("deleted_at", null);
  if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
  if (filtros.status) q = q.eq("status", filtros.status);
  if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
  if (filtros.fim) q = q.lte("vencimento", filtros.fim);
  const { data } = await q;

  const mapa = new Map<
    string,
    { obra: string; total: number; pendente: number; pago: number }
  >();
  for (const l of (data ?? []) as Record<string, unknown>[]) {
    if (filtros.fornecedor_id) {
      const c = l.contrato as { fornecedor_id?: string } | null;
      if (c?.fornecedor_id !== filtros.fornecedor_id) continue;
    }
    const obra = l.obra as { codigo: string; nome: string } | null;
    const nome = obra ? `${obra.codigo} — ${obra.nome}` : "—";
    const atual = mapa.get(nome) ?? { obra: nome, total: 0, pendente: 0, pago: 0 };
    const v = Number(l.valor);
    atual.total += v;
    if (l.status === "pago") atual.pago += v;
    else atual.pendente += v;
    mapa.set(nome, atual);
  }

  return {
    titulo: "Custo por obra",
    grafico: { labelKey: "obra", valorKey: "total" },
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "total", label: "Total", tipo: "moeda" },
      { key: "pendente", label: "Pendente", tipo: "moeda" },
      { key: "pago", label: "Pago", tipo: "moeda" },
    ],
    linhas: Array.from(mapa.values()),
  };
}
