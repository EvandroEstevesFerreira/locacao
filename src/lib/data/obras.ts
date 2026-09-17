import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { TipoCentroCusto } from "@/lib/centro-custo";
import type { ListaParams, Pagina } from "./lista-params";

/** Forma plana de centro de custo usada em filtros e selects de formulário. */
export type ObraOpcao = {
  id: string;
  codigo: string;
  nome: string;
  tipo: TipoCentroCusto;
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
  async (apenasAtivas = false, tipo?: TipoCentroCusto): Promise<ObraOpcao[]> => {
    const supabase = await createClient();
    let q = supabase.from("obra").select("id, codigo, nome, tipo");
    if (apenasAtivas) q = q.eq("status", "ativa");
    // `tipo: "obra"` é o que os quatro controles de obra pedem — avanço,
    // frentes, orçamento de locação e fechamento mensal. São os mesmos quatro
    // que os gatilhos da migration 0114 recusam: a tela não oferece e o banco
    // não aceita. Sem o parâmetro, o select lista os dois, que é o caso comum
    // (contrato, termo, estoque, financeiro, frota, imóvel) e é o que dá ao
    // notebook do RH onde ficar.
    if (tipo) q = q.eq("tipo", tipo);

    const { data, error } = await q.order("codigo");
    if (error) {
      console.error("[listarObrasParaFiltro]", error);
      return [];
    }
    return (data ?? []) as ObraOpcao[];
  },
);

/** Uma linha da listagem de centros de custo. */
export type ObraListItem = {
  id: string;
  codigo: string;
  nome: string;
  responsavel: string | null;
  status: string;
  tipo: TipoCentroCusto;
  pai_id: string | null;
};

export async function listarObras(
  p: ListaParams,
  tipo?: TipoCentroCusto,
): Promise<Pagina<ObraListItem>> {
  const supabase = await createClient();
  let query = supabase
    .from("obra")
    .select("id, codigo, nome, responsavel, status, tipo, pai_id", { count: "exact" });
  if (p.q) query = query.or(termoOr(["codigo", "nome", "responsavel"], p.q));
  if (tipo) query = query.eq("tipo", tipo);

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);
  if (error) console.error("listarObras", error.message);

  return { itens: (data ?? []) as ObraListItem[], total: count ?? 0 };
}

/**
 * Departamentos que podem ser PAI de outro centro de custo.
 *
 * Só departamentos, e só os de raiz: a hierarquia tem dois níveis, e um setor
 * que já tem pai não pode receber filho. A mesma regra está no trigger da
 * migration 0114 — aqui ela evita oferecer na tela o que o banco vai recusar.
 *
 * `excetoId` tira o próprio registro da lista na edição: um centro de custo pai
 * de si mesmo é recusado pelo banco, mas oferecê-lo é convidar ao erro.
 */
export const listarDepartamentosPossiveisPai = cache(
  async (excetoId?: string): Promise<ObraOpcao[]> => {
    const supabase = await createClient();
    let q = supabase
      .from("obra")
      .select("id, codigo, nome, tipo")
      .eq("tipo", "departamento")
      .is("pai_id", null);
    if (excetoId) q = q.neq("id", excetoId);

    const { data, error } = await q.order("codigo");
    if (error) {
      console.error("[listarDepartamentosPossiveisPai]", error);
      return [];
    }
    return (data ?? []) as ObraOpcao[];
  },
);
