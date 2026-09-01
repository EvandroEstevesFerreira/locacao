import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import { hojeISOSaoPaulo, intervaloDoMes } from "@/lib/locacao";
import type { ListaParams, Pagina } from "./lista-params";

export type StatusLancamento = "pendente" | "pago";

/** Uma linha da listagem do financeiro. */
export type LancamentoListItem = {
  id: string;
  descricao: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: StatusLancamento;
  obraCodigo: string | null;
  /**
   * Presença de contrato, para a lista saber se o rateio por item é possível.
   *
   * O rateio distribui o custo entre as LINHAS de um contrato; sem contrato não
   * há linhas, e oferecer o botão levaria a uma tela que só diz "não dá".
   */
  contrato_id: string | null;
};

/** Totais do financeiro sobre TODO o filtro, não só a página visível. */
export type TotaisFinanceiro = {
  pendente: number;
  pago: number;
  vencido: number;
};

export type FiltrosFinanceiro = {
  /** Só filtra quando é "pendente" ou "pago"; qualquer outro valor é "todos". */
  status?: string;
  obraId?: string;
  /** Mês 'yyyy-MM' — recorta por VENCIMENTO, que é o eixo do gráfico da home. */
  mes?: string;
};

/**
 * Aplica os filtros da tela a uma query.
 *
 * Existe porque a listagem e os totais precisam do MESMO recorte com `select`
 * diferentes — a lista pagina, os totais somam tudo. Antes as duas condições
 * estavam escritas duas vezes na página, e qualquer filtro novo tinha de ser
 * lembrado nos dois lugares ou os KPIs discordavam da tabela em silêncio.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros<T extends { or: any; eq: any; gte: any; lte: any }>(
  query: T,
  f: FiltrosFinanceiro,
  q: string,
): T {
  let r = query;
  if (f.status === "pendente" || f.status === "pago") r = r.eq("status", f.status);
  if (f.obraId) r = r.eq("obra_id", f.obraId);
  // Por VENCIMENTO e não por competência: o vencimento é o eixo do gráfico da
  // home, e clicar numa barra tem de trazer exatamente as linhas que a compõem.
  // Competência é o mês a que a despesa se refere, quase sempre outro — e a
  // divergência chegaria ao usuário como "o total não bate".
  const intervalo = intervaloDoMes(f.mes);
  if (intervalo) {
    r = r.gte("vencimento", intervalo.inicio).lte("vencimento", intervalo.fim);
  }
  if (q) r = r.or(termoOr(["descricao"], q));
  return r;
}

export async function listarLancamentos(
  p: ListaParams & FiltrosFinanceiro,
): Promise<Pagina<LancamentoListItem>> {
  const supabase = await createClient();
  const base = supabase
    .from("lancamento_financeiro")
    .select(
      "id, descricao, competencia, valor, vencimento, status, contrato_id, obra:obra_id(codigo)",
      { count: "exact" },
    );

  const { data, count, error } = await aplicarFiltros(base, p, p.q)
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarLancamentos", error.message);

  type Bruto = Omit<LancamentoListItem, "obraCodigo"> & {
    obra: { codigo: string } | null;
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map(({ obra, ...l }) => ({
      ...l,
      obraCodigo: obra?.codigo ?? null,
    })),
    total: count ?? 0,
  };
}

export async function obterTotaisFinanceiro(
  f: FiltrosFinanceiro & { q: string },
  clientePronto?: SupabaseClient,
): Promise<TotaisFinanceiro> {
  const supabase = clientePronto ?? (await createClient());
  const base = supabase
    .from("lancamento_financeiro")
    .select("valor, vencimento, status");

  const { data, error } = await aplicarFiltros(base, f, f.q);
  if (error) console.error("obterTotaisFinanceiro", error.message);

  const linhas = (data ?? []) as {
    valor: number;
    vencimento: string;
    status: string;
  }[];
  const hoje = hojeISOSaoPaulo();

  return {
    pendente: linhas
      .filter((l) => l.status === "pendente")
      .reduce((s, l) => s + Number(l.valor), 0),
    pago: linhas
      .filter((l) => l.status === "pago")
      .reduce((s, l) => s + Number(l.valor), 0),
    vencido: linhas
      .filter((l) => l.status === "pendente" && l.vencimento < hoje)
      .reduce((s, l) => s + Number(l.valor), 0),
  };
}
