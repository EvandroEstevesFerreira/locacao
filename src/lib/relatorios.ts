import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcularCusto,
  dataDeISO,
  formatarBRL,
  formatarData,
  periodosEntre,
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
};

export type FiltrosRelatorio = {
  obra_id?: string;
  inicio?: string;
  fim?: string;
};

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
      "quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, contrato:contrato_id(numero, cadencia, obra_id, obra:obra_id(codigo,nome)), item:item_id(descricao)",
    )
    .eq("status", "em_aberto")
    .order("data_retirada");

  const linhas = (data ?? [])
    .filter(
      (l: Record<string, unknown>) =>
        !filtros.obra_id ||
        (l.contrato as { obra_id?: string })?.obra_id === filtros.obra_id,
    )
    .map((l: Record<string, unknown>) => {
      const contrato = l.contrato as {
        numero: string;
        cadencia: Cadencia;
        obra: { codigo: string; nome: string } | null;
      } | null;
      const item = l.item as { descricao: string } | null;
      const periodos = contrato
        ? periodosEntre(contrato.cadencia, dataDeISO(l.data_retirada as string), hoje)
        : 0;
      const custo = calcularCusto(
        Number(l.quantidade),
        Number(l.valor_unitario_periodo),
        periodos,
      );
      return {
        obra: contrato?.obra
          ? `${contrato.obra.codigo} — ${contrato.obra.nome}`
          : "—",
        contrato: contrato?.numero ?? "—",
        item: item?.descricao ?? "—",
        quantidade: Number(l.quantidade),
        retirada: l.data_retirada as string,
        devolucao: (l.data_devolucao_prevista as string | null) ?? null,
        custo,
      };
    });

  return {
    titulo: "Itens em aberto",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "item", label: "Item", tipo: "texto" },
      { key: "quantidade", label: "Qtd.", tipo: "numero" },
      { key: "retirada", label: "Retirada", tipo: "data" },
      { key: "devolucao", label: "Devol. prevista", tipo: "data" },
      { key: "custo", label: "Custo estimado", tipo: "moeda" },
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
    .select("descricao, competencia, vencimento, valor, status, obra:obra_id(codigo,nome)")
    .order("vencimento");
  if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
  if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
  if (filtros.fim) q = q.lte("vencimento", filtros.fim);
  const { data } = await q;

  const linhas = (data ?? []).map((l: Record<string, unknown>) => {
    const obra = l.obra as { codigo: string; nome: string } | null;
    return {
      obra: obra ? `${obra.codigo} — ${obra.nome}` : "—",
      descricao: l.descricao as string,
      competencia: l.competencia as string,
      vencimento: l.vencimento as string,
      valor: Number(l.valor),
      status: l.status === "pago" ? "Pago" : "Pendente",
    };
  });

  return {
    titulo: "Contas a pagar",
    colunas: [
      { key: "obra", label: "Obra", tipo: "texto" },
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
    .select("valor, status, obra:obra_id(codigo,nome)");
  if (filtros.obra_id) q = q.eq("obra_id", filtros.obra_id);
  if (filtros.inicio) q = q.gte("vencimento", filtros.inicio);
  if (filtros.fim) q = q.lte("vencimento", filtros.fim);
  const { data } = await q;

  const mapa = new Map<
    string,
    { obra: string; total: number; pendente: number; pago: number }
  >();
  for (const l of (data ?? []) as Record<string, unknown>[]) {
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
