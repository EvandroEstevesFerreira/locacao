import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { NaturezaItem } from "@/lib/itens";

/**
 * Uma linha do catálogo de itens.
 *
 * `unidades` é a contagem total de peças, mantida por compatibilidade com quem
 * já lia daqui; a quebra por situação vem em `LinhaCatalogoBruta`.
 */
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

// ---------------------------------------------------------------------------
// O catálogo agrupado por tipo
// ---------------------------------------------------------------------------

/**
 * Teto de linhas do catálogo agrupado.
 *
 * Agrupar e paginar brigam: uma seção partida entre a página 1 e a 2 mostra
 * "NOTEBOOK — 96 peças" com quatro modelos embaixo, e quem lê não sabe se o
 * resto existe. A tela troca a paginação pelos filtros — e este teto é a rede,
 * com aviso na tela quando bate.
 *
 * 500 é folgado para o catálogo real (27 hoje, algumas centenas no horizonte).
 * Se um dia passar disso de verdade, o certo NÃO é aumentar o número: é voltar
 * a paginar por seção.
 */
export const TETO_CATALOGO = 500;

export type ParqueDoItem = {
  pecas: number;
  emUso: number;
  disponivel: number;
  locadas: number;
};

export type LinhaCatalogoBruta = ItemListItem & {
  tipoNome: string | null;
} & ParqueDoItem;

/**
 * O catálogo com o tipo e o parque de cada item.
 *
 * Duas consultas em vez de um join embutido: `item_parque` é VIEW, e view não
 * tem chave estrangeira para o PostgREST inferir o vínculo. Pedir o embed
 * funcionaria por acaso — ou não funcionaria, em silêncio, devolvendo tudo
 * zerado.
 */
export async function listarCatalogo(p: {
  q?: string;
  categoria?: string;
  tipo?: string;
}): Promise<{ linhas: LinhaCatalogoBruta[]; total: number; truncado: boolean }> {
  const supabase = await createClient();

  let query = supabase
    .from("item_catalogo")
    .select(
      "id, natureza, descricao, unidade, ativo, categoria_id, tipo_id, " +
        "categoria:categoria_id(nome), tipo:tipo_id(nome)",
      { count: "exact" },
    );
  if (p.q) query = query.or(termoOr(["descricao", "unidade"], p.q));
  if (p.categoria === "sem") query = query.is("categoria_id", null);
  else if (p.categoria) query = query.eq("categoria_id", p.categoria);
  if (p.tipo === "sem") query = query.is("tipo_id", null);
  else if (p.tipo) query = query.eq("tipo_id", p.tipo);

  const { data, count, error } = await query
    .order("descricao")
    .range(0, TETO_CATALOGO - 1);
  if (error) {
    console.error("listarCatalogo", error.message);
    return { linhas: [], total: 0, truncado: false };
  }

  type Bruto = {
    id: string;
    natureza: NaturezaItem;
    descricao: string;
    unidade: string | null;
    ativo: boolean;
    categoria_id: string | null;
    categoria: { nome: string } | { nome: string }[] | null;
    tipo: { nome: string } | { nome: string }[] | null;
  };
  const brutos = (data ?? []) as unknown as Bruto[];

  // Sem itens não há o que contar, e um `.in("item_id", [])` devolveria a view
  // inteira em algumas versões do PostgREST.
  const parquePorItem = new Map<string, ParqueDoItem>();
  if (brutos.length > 0) {
    const { data: parque, error: erroParque } = await supabase
      .from("item_parque")
      .select("item_id, pecas, em_uso, disponivel, locadas")
      .in(
        "item_id",
        brutos.map((b) => b.id),
      );
    if (erroParque) console.error("listarCatalogo/parque", erroParque.message);
    for (const r of (parque ?? []) as unknown as {
      item_id: string;
      pecas: number;
      em_uso: number;
      disponivel: number;
      locadas: number;
    }[]) {
      parquePorItem.set(r.item_id, {
        pecas: Number(r.pecas),
        emUso: Number(r.em_uso),
        disponivel: Number(r.disponivel),
        locadas: Number(r.locadas),
      });
    }
  }

  const um = (v: { nome: string } | { nome: string }[] | null) =>
    Array.isArray(v) ? (v[0]?.nome ?? null) : (v?.nome ?? null);

  return {
    linhas: brutos.map((b) => ({
      id: b.id,
      natureza: b.natureza,
      descricao: b.descricao,
      unidade: b.unidade,
      ativo: b.ativo,
      unidades: parquePorItem.get(b.id)?.pecas ?? 0,
      categoriaId: b.categoria_id,
      categoriaNome: um(b.categoria),
      tipoNome: um(b.tipo),
      // Item sem linha na view seria impossível (ela é `left join` sobre o
      // próprio catálogo), mas zerar é melhor que quebrar a tela por um dado
      // que não deveria faltar.
      pecas: parquePorItem.get(b.id)?.pecas ?? 0,
      emUso: parquePorItem.get(b.id)?.emUso ?? 0,
      disponivel: parquePorItem.get(b.id)?.disponivel ?? 0,
      locadas: parquePorItem.get(b.id)?.locadas ?? 0,
    })),
    total: count ?? 0,
    truncado: (count ?? 0) > TETO_CATALOGO,
  };
}

/** Os tipos que existem, para o filtro. */
export async function listarTiposParaFiltro(): Promise<
  { id: string; nome: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_equipamento")
    .select("id, nome")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    console.error("listarTiposParaFiltro", error.message);
    return [];
  }
  return (data ?? []) as { id: string; nome: string }[];
}
