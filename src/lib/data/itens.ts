import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { NaturezaItem } from "@/lib/itens";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha do catálogo de itens, com a contagem de unidades já resolvida. */
export type ItemListItem = {
  id: string;
  natureza: NaturezaItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
  /** Quantas unidades físicas cadastradas — o `equipamento_unidade(count)`. */
  unidades: number;
  categoriaId: string | null;
  /** Nome da categoria, ou null para item ainda não classificado. */
  categoriaNome: string | null;
};

export async function listarItens(
  p: ListaParams & { categoria?: string },
): Promise<Pagina<ItemListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("item_catalogo")
    .select(
      "id, natureza, tipo_id, descricao, unidade, ativo, categoria_id, " +
        "categoria:categoria_id(nome), equipamento_unidade(count)",
      { count: "exact" },
    );
  if (p.q) query = query.or(termoOr(["descricao", "unidade"], p.q));
  // `categoria_id` é coluna do próprio item, então o filtro vai no banco — ao
  // contrário da frota, onde a categoria mora no item relacionado.
  if (p.categoria === "sem") query = query.is("categoria_id", null);
  else if (p.categoria) query = query.eq("categoria_id", p.categoria);

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarItens", error.message);

  type Bruto = Omit<ItemListItem, "unidades" | "categoriaId" | "categoriaNome"> & {
    categoria_id: string | null;
    categoria: { nome: string } | { nome: string }[] | null;
    equipamento_unidade: { count: number }[];
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map(
      ({ equipamento_unidade, categoria, categoria_id, ...i }) => ({
        ...i,
        unidades: equipamento_unidade?.[0]?.count ?? 0,
        categoriaId: categoria_id,
        categoriaNome: Array.isArray(categoria)
          ? (categoria[0]?.nome ?? null)
          : (categoria?.nome ?? null),
      }),
    ),
    total: count ?? 0,
  };
}
