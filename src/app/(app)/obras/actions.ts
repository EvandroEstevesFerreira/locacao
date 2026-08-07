"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { obraSchema } from "@/lib/obra";

export async function salvarObra(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar obras.");
  }

  const parsed = obraSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("obra").update(dados).eq("id", id)
    : await supabase.from("obra").insert({ org_id: perfil.org_id, ...dados });

  if (error) {
    if (error.code === "23505") return falha("Já existe uma obra com esse código.");
    return falha("Não foi possível salvar. Tente novamente.");
  }

  // Fica como está: `revalidatePath` invalida o cache do servidor para a rota
  // inteira. O `router.refresh()` do cliente só re-busca a rota atual, então
  // sem isto a listagem ficaria com dado velho.
  revalidatePath("/obras");
  return { ok: true, id: id ?? undefined };
}

/**
 * Exclusão continua recebendo FormData: é chamada pelo ConfirmDelete, que monta
 * um FormData, e não por um formulário RHF. Manter a assinatura evita mexer nos
 * 18 call sites do ConfirmDelete.
 */
export async function excluirObra(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir obras." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Obra inválida." };

  const supabase = await createClient();
  // Soft-delete pela função `soft_delete` (migration 0041): a policy de SELECT
  // esconde linhas com deleted_at, o que faz o RLS recusar um UPDATE direto.
  // `soft_delete` devolve true/false — `data !== true` também é falha.
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "obra",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir a obra. Tente novamente." };
  }
  revalidatePath("/obras");
}
