import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { NaturezaItem } from "@/lib/itens";

// Leituras do catálogo: categorias, tipos e unidades de medida.
//
// `createClient()`, nunca `createAdminClient()`. São cadastros de organização e
// o isolamento vive na RLS da migration 0069.

export type CategoriaComTipos = {
  id: string;
  nome: string;
  tipos: {
    id: string;
    nome: string;
    naturezaPadrao: NaturezaItem;
    ativo: boolean;
    /** Quantos modelos do catálogo apontam para este tipo. */
    itens: number;
  }[];
};

/**
 * A árvore de Configurações › Catálogo.
 *
 * Traz as categorias VAZIAS também: categoria sem tipo é justamente onde falta
 * cadastro, e escondê-la deixaria a tela parecendo completa enquanto metade do
 * catálogo não tem para onde ir.
 */
export async function listarCategoriasComTipos(): Promise<CategoriaComTipos[]> {
  const supabase = await createClient();

  const [{ data: categorias, error: erroCat }, { data: tipos, error: erroTipos }] =
    await Promise.all([
      supabase.from("categoria_equipamento").select("id, nome").order("nome"),
      supabase
        .from("tipo_equipamento")
        .select("id, nome, categoria_id, natureza_padrao, ativo, item_catalogo(count)")
        .order("nome"),
    ]);

  if (erroCat || erroTipos) {
    console.error("listarCategoriasComTipos", erroCat ?? erroTipos);
    return [];
  }

  const porCategoria = new Map<string, CategoriaComTipos["tipos"]>();
  for (const t of tipos ?? []) {
    const contagem = t.item_catalogo as { count: number }[] | null;
    const lista = porCategoria.get(t.categoria_id) ?? [];
    lista.push({
      id: t.id,
      nome: t.nome,
      naturezaPadrao: t.natureza_padrao as NaturezaItem,
      ativo: t.ativo,
      itens: contagem?.[0]?.count ?? 0,
    });
    porCategoria.set(t.categoria_id, lista);
  }

  return (categorias ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    tipos: porCategoria.get(c.id) ?? [],
  }));
}

export type TipoOpcao = {
  id: string;
  nome: string;
  categoria: string;
  naturezaPadrao: NaturezaItem;
};

/**
 * Os tipos ATIVOS, achatados e rotulados com a categoria — o seletor do
 * formulário do item.
 *
 * Só os ativos: um tipo desativado não deve ser oferecido para cadastro novo,
 * mas continua existindo nos itens que já o referenciam.
 */
export async function listarTiposParaSelecao(): Promise<TipoOpcao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tipo_equipamento")
    .select("id, nome, natureza_padrao, categoria:categoria_id(nome)")
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error("listarTiposParaSelecao", error);
    return [];
  }

  return (data ?? [])
    .map((t) => {
      const cat = (Array.isArray(t.categoria) ? t.categoria[0] : t.categoria) as
        | { nome: string }
        | null;
      return {
        id: t.id,
        nome: t.nome,
        categoria: cat?.nome ?? "—",
        naturezaPadrao: t.natureza_padrao as NaturezaItem,
      };
    })
    // Ordena pela categoria e depois pelo nome, para o seletor agrupar
    // visualmente sem precisar de `<optgroup>`.
    .sort(
      (a, b) =>
        a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome),
    );
}

export type UnidadeOpcao = {
  id: string;
  simbolo: string;
  nome: string;
  /** Menor vem primeiro no seletor. */
  ordem: number;
  ativo: boolean;
};

/** Unidades de medida cadastradas, na ordem definida em Configurações. */
export async function listarUnidades(
  incluirInativas = false,
): Promise<UnidadeOpcao[]> {
  const supabase = await createClient();
  let q = supabase
    .from("unidade_medida")
    .select("id, simbolo, nome, ordem, ativo")
    .order("ordem")
    .order("simbolo");
  if (!incluirInativas) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error) {
    console.error("listarUnidades", error);
    return [];
  }
  return (data ?? []) as UnidadeOpcao[];
}
