import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha da listagem de fornecedores, com as obras já achatadas. */
export type FornecedorListItem = {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  ativo: boolean;
  /** Códigos das obras vinculadas, para os badges da linha. */
  obras: { id: string; codigo: string }[];
};

export async function listarFornecedores(
  p: ListaParams & { obraId?: string },
): Promise<Pagina<FornecedorListItem>> {
  const supabase = await createClient();

  // Filtrar por obra exige join INTERNO: com o embed normal o PostgREST conta e
  // pagina todos os fornecedores, e só depois filtra as obras aninhadas — o que
  // devolve páginas parcialmente vazias e um total errado.
  const embed = p.obraId
    ? "fornecedor_obra!inner(obra:obra_id(id, codigo))"
    : "fornecedor_obra(obra:obra_id(id, codigo))";

  let query = supabase
    .from("fornecedor")
    .select(
      `id, nome, cnpj, contato_nome, contato_telefone, ativo, ${embed}`,
      { count: "exact" },
    );
  if (p.obraId) query = query.eq("fornecedor_obra.obra_id", p.obraId);
  if (p.q) query = query.or(termoOr(["nome", "cnpj"], p.q));

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarFornecedores", error.message);

  type Bruto = Omit<FornecedorListItem, "obras"> & {
    fornecedor_obra: { obra: { id: string; codigo: string } | null }[];
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map(
      ({ fornecedor_obra, ...f }) => ({
        ...f,
        obras: (fornecedor_obra ?? [])
          .map((v) => v.obra)
          .filter((o): o is { id: string; codigo: string } => o !== null),
      }),
    ),
    total: count ?? 0,
  };
}
