import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { StatusImovel } from "@/lib/imoveis";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha da listagem de imóveis, com o contrato vigente já resolvido. */
export type ImovelListItem = {
  id: string;
  tipo: string;
  apelido: string;
  cidade: string | null;
  uf: string | null;
  status: StatusImovel;
  obraCodigo: string | null;
  /** Aluguel + condomínio do contrato vigente, ou 0 se não houver vigente. */
  mensalVigente: number;
};

export type FiltrosImovel = {
  tipo?: string;
  status?: string;
  obraId?: string;
};

type ContratoBruto = {
  valor_aluguel: number;
  valor_condominio: number;
  vigente: boolean;
};

/** Soma do contrato vigente. Só um contrato por imóvel é vigente por vez. */
function mensalDoVigente(contratos: ContratoBruto[] | null): number {
  const v = (contratos ?? []).find((c) => c.vigente);
  return v ? Number(v.valor_aluguel) + Number(v.valor_condominio) : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function aplicarFiltros<T extends { or: any; eq: any }>(
  query: T,
  f: FiltrosImovel,
  q: string,
): T {
  let r = query;
  if (f.tipo) r = r.eq("tipo", f.tipo);
  if (f.status) r = r.eq("status", f.status);
  if (f.obraId) r = r.eq("obra_id", f.obraId);
  if (q) r = r.or(termoOr(["apelido", "cidade"], q));
  return r;
}

export async function listarImoveis(
  p: ListaParams & FiltrosImovel,
): Promise<Pagina<ImovelListItem>> {
  const supabase = await createClient();
  const base = supabase
    .from("imovel")
    .select(
      "id, tipo, apelido, cidade, uf, status, obra:obra_id(codigo), contrato_imovel(valor_aluguel, valor_condominio, vigente)",
      { count: "exact" },
    )
    .is("deleted_at", null);

  const { data, count, error } = await aplicarFiltros(base, p, p.q)
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarImoveis", error.message);

  type Bruto = Omit<ImovelListItem, "obraCodigo" | "mensalVigente"> & {
    obra: { codigo: string } | null;
    contrato_imovel: ContratoBruto[] | null;
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map(
      ({ obra, contrato_imovel, ...i }) => ({
        ...i,
        obraCodigo: obra?.codigo ?? null,
        mensalVigente: mensalDoVigente(contrato_imovel),
      }),
    ),
    total: count ?? 0,
  };
}

/**
 * Aluguel + condomínio somado de TODOS os imóveis que casam com o filtro, não
 * só os da página visível — é o KPI do topo da tela.
 *
 * Consulta separada de propósito: com `range()` o total sairia limitado aos 20
 * imóveis da página e o indicador mentiria conforme se navegasse.
 */
export async function somarAluguelVigente(
  f: FiltrosImovel & { q: string },
): Promise<number> {
  const supabase = await createClient();
  const base = supabase
    .from("imovel")
    .select("contrato_imovel(valor_aluguel, valor_condominio, vigente)")
    .is("deleted_at", null);

  const { data, error } = await aplicarFiltros(base, f, f.q);
  if (error) console.error("somarAluguelVigente", error.message);

  type Bruto = { contrato_imovel: ContratoBruto[] | null };
  return ((data ?? []) as unknown as Bruto[]).reduce(
    (s, i) => s + mensalDoVigente(i.contrato_imovel),
    0,
  );
}
