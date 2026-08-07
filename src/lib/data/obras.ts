import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { ListaParams, Pagina } from "./lista-params";

/** Forma plana de obra usada em filtros e selects de formulário. */
export type ObraOpcao = {
  id: string;
  codigo: string;
  nome: string;
};

/**
 * Obras para popular filtros e selects.
 *
 * O mesmo `select("id, codigo, nome").order("codigo")` estava escrito em 17
 * páginas. Aqui fica num lugar, envolvido em `cache()` — o que importa de
 * verdade nas telas que precisam da lista duas vezes no mesmo render (o filtro
 * do cabeçalho e o select de um formulário embutido).
 *
 * O parâmetro é um booleano primitivo de propósito: `cache()` chaveia por
 * identidade de argumento, então um objeto de opções construído em dois lugares
 * seria *miss* e duplicaria a consulta — exatamente o oposto do objetivo.
 *
 * Em erro devolve lista vazia e loga. Filtro sem opções simplesmente não
 * aparece; a tela continua utilizável.
 */
export const listarObrasParaFiltro = cache(
  async (apenasAtivas = false): Promise<ObraOpcao[]> => {
    const supabase = await createClient();
    let q = supabase.from("obra").select("id, codigo, nome");
    if (apenasAtivas) q = q.eq("status", "ativa");

    const { data, error } = await q.order("codigo");
    if (error) {
      console.error("[listarObrasParaFiltro]", error);
      return [];
    }
    return (data ?? []) as ObraOpcao[];
  },
);

/** Uma linha da listagem de obras. */
export type ObraListItem = {
  id: string;
  codigo: string;
  nome: string;
  responsavel: string | null;
  status: string;
};

export async function listarObras(
  p: ListaParams,
): Promise<Pagina<ObraListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("obra")
    .select("id, codigo, nome, responsavel, status", { count: "exact" });
  if (p.q) query = query.or(termoOr(["codigo", "nome", "responsavel"], p.q));

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarObras", error.message);

  return { itens: (data ?? []) as ObraListItem[], total: count ?? 0 };
}
