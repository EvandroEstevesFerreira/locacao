import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

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
