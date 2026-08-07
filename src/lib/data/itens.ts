import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { TipoItem } from "@/lib/itens";
import type { ListaParams, Pagina } from "./lista-params";

/** Uma linha do catálogo de itens, com a contagem de unidades já resolvida. */
export type ItemListItem = {
  id: string;
  tipo: TipoItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
  /** Quantas unidades físicas cadastradas — o `equipamento_unidade(count)`. */
  unidades: number;
};

export async function listarItens(
  p: ListaParams,
): Promise<Pagina<ItemListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("item_catalogo")
    .select(
      "id, tipo, descricao, unidade, ativo, equipamento_unidade(count)",
      { count: "exact" },
    );
  if (p.q) query = query.or(termoOr(["descricao", "unidade"], p.q));

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarItens", error.message);

  type Bruto = Omit<ItemListItem, "unidades"> & {
    equipamento_unidade: { count: number }[];
  };

  return {
    itens: ((data ?? []) as unknown as Bruto[]).map(
      ({ equipamento_unidade, ...i }) => ({
        ...i,
        unidades: equipamento_unidade?.[0]?.count ?? 0,
      }),
    ),
    total: count ?? 0,
  };
}
