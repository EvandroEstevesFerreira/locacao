import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcularCusto,
  dataDeISO,
  formatarBRL,
  formatarData,
  periodosEntre,
  periodosPorMes,
  type Cadencia,
} from "@/lib/locacao";

export type TipoRelatorio = "itens_abertos" | "contas_pagar" | "custo_por_obra";

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
};

export type FiltrosRelatorio = {
  obra_id?: string;
  fornecedor_id?: string;
  status?: "pago" | "pendente";
  inicio?: string;
  fim?: string;
};

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
  return custoPorObra(supabase, filtros);
}

async function itensAbertos(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = new Date();
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
    );
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
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "total", label: "Total", tipo: "moeda" },
      { key: "pendente", label: "Pendente", tipo: "moeda" },
      { key: "pago", label: "Pago", tipo: "moeda" },
    ],
    linhas: Array.from(mapa.values()),
  };
}
