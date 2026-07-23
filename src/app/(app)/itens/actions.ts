"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";

export type ItemFormState = { error?: string };

const itemSchema = z.object({
  tipo: z.enum(["equipamento", "material_retornavel", "consumivel"]),
  descricao: z.string().trim().min(1, "Informe a descrição do item.").max(200),
  unidade: z.string().trim().max(10).optional(),
});

function vazioParaNulo(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarItem(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida. Entre novamente." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para editar itens." };
  }

  const parsed = itemSchema.safeParse({
    tipo: formData.get("tipo"),
    descricao: formData.get("descricao"),
    unidade: formData.get("unidade") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const ativo =
    formData.get("ativo") === "on" || formData.get("ativo") === "true";
  const dados = {
    tipo: parsed.data.tipo,
    descricao: parsed.data.descricao,
    unidade: vazioParaNulo(parsed.data.unidade),
    ativo,
  };

  const supabase = await createClient();
  let itemId = id;
  if (id) {
    const { error } = await supabase.from("item_catalogo").update(dados).eq("id", id);
    if (error) return { error: "Não foi possível salvar. Tente novamente." };
  } else {
    const { data, error } = await supabase
      .from("item_catalogo")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return { error: "Não foi possível salvar. Tente novamente." };
    itemId = data.id;
  }

  revalidatePath("/itens");
  // Equipamento abre a edição para cadastrar as unidades; senão volta à lista.
  if (!id && dados.tipo === "equipamento") {
    redirect(`/itens/${itemId}`);
  }
  redirect("/itens");
}

export async function excluirItem(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("item_catalogo").delete().eq("id", id);
  revalidatePath("/itens");
}

const unidadeSchema = z.object({
  item_id: z.string().uuid(),
  identificador: z.string().trim().min(1, "Informe o identificador.").max(80),
  observacoes: z.string().trim().max(300).optional(),
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
    observacoes: vazioParaNulo(parsed.data.observacoes),
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
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const itemId = (formData.get("item_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("equipamento_unidade").delete().eq("id", id);
  if (itemId) revalidatePath(`/itens/${itemId}`);
}
