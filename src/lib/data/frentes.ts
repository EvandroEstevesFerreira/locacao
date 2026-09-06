import "server-only";

import { createClient } from "@/lib/supabase/server";

// Leituras da frente de serviço.
//
// `createClient()`, nunca `createAdminClient()`. O recorte é o DA OBRA — ao
// contrário de `tipo_equipamento` e `reparo_equipamento`, que são da
// organização —, e ele vive na RLS da migration 0072: quem não enxerga a obra
// não tem o que fazer com as frentes dela.

export type FrenteLinha = {
  id: string;
  nome: string;
  ativo: boolean;
  /** Itens de contrato alocados a esta frente. */
  itens: number;
};

export async function listarFrentesDaObra(
  obraId: string,
  incluirInativas = true,
): Promise<FrenteLinha[]> {
  const supabase = await createClient();
  let q = supabase
    .from("frente_obra")
    .select("id, nome, ativo, item_locado(count)")
    .eq("obra_id", obraId)
    .order("nome");
  if (!incluirInativas) q = q.eq("ativo", true);

  const { data, error } = await q;
  if (error) {
    console.error("listarFrentesDaObra", error);
    return [];
  }

  return (data ?? []).map((f) => {
    const c = f.item_locado as { count: number }[] | null;
    return {
      id: f.id,
      nome: f.nome,
      ativo: f.ativo,
      itens: c?.[0]?.count ?? 0,
    };
  });
}

/**
 * As frentes ATIVAS da obra de um contrato — o seletor do item.
 *
 * A obra vem pelo contrato porque `item_locado` não guarda `obra_id`. Oferecer
 * as frentes de outra obra faria o relatório de custo por frente somar despesa
 * de uma obra dentro de outra; o banco recusa (trigger da 0072), mas a tela não
 * deve nem oferecer.
 */
export async function listarFrentesDoContrato(
  contratoId: string,
): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("obra_id")
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato?.obra_id) return [];

  const { data, error } = await supabase
    .from("frente_obra")
    .select("id, nome")
    .eq("obra_id", contrato.obra_id)
    .eq("ativo", true)
    .order("nome");

  if (error) {
    console.error("listarFrentesDoContrato", error);
    return [];
  }
  return (data ?? []) as { id: string; nome: string }[];
}
