"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { itemSchema } from "@/lib/itens";

/**
 * Salva item do catálogo.
 *
 * Devolve o `id` no sucesso porque o cliente precisa dele: ao criar um
 * EQUIPAMENTO, a navegação é para a tela de edição, onde se cadastram as
 * unidades. Antes isso era um `redirect()` condicional aqui dentro; agora quem
 * decide o destino é o formulário, que tem o `id` de volta.
 */
export async function salvarItem(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar itens.");
  }

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  let itemId = id ?? null;
  if (id) {
    const { error } = await supabase.from("item_catalogo").update(dados).eq("id", id);
    if (error) return falha("Não foi possível salvar. Tente novamente.");
  } else {
    const { data, error } = await supabase
      .from("item_catalogo")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return falha("Não foi possível salvar. Tente novamente.");
    itemId = data.id;
  }

  revalidatePath("/itens");
  return { ok: true, id: itemId ?? undefined };
}

export async function excluirItem(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir itens do catálogo." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("item_catalogo").delete().eq("id", id);
  revalidatePath("/itens");
}

const unidadeSchema = z.object({
  item_id: z.string().uuid(),
  identificador: z.string().trim().min(1, "Informe o identificador.").max(80),
  observacoes: z
    .string()
    .trim()
    .max(300)
    .optional()
    // "" precisa virar NULL, senão "sem observação" fica gravado como string
    // vazia e qualquer `is null` deixa de encontrá-la.
    .transform((v) => (v && v.length > 0 ? v : null)),
});

export type UnidadeFormState = { error?: string };

export async function adicionarUnidade(
  _prev: UnidadeFormState,
  formData: FormData,
): Promise<UnidadeFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Sem permissão." };
  }

  const parsed = unidadeSchema.safeParse({
    item_id: formData.get("item_id"),
    identificador: formData.get("identificador"),
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("equipamento_unidade").insert({
    org_id: perfil.org_id,
    item_id: parsed.data.item_id,
    identificador: parsed.data.identificador,
    observacoes: parsed.data.observacoes,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma unidade com esse identificador." };
    }
    return { error: "Não foi possível adicionar. Tente novamente." };
  }

  revalidatePath(`/itens/${parsed.data.item_id}`);
  return {};
}

export async function excluirUnidade(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir unidades." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const itemId = (formData.get("item_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("equipamento_unidade").delete().eq("id", id);
  if (itemId) revalidatePath(`/itens/${itemId}`);
}
