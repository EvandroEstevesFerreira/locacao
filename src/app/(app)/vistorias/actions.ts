"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";

const PODE = ["admin", "gestor", "operacional"];

export type VistoriaFormState = { error?: string };

const vistoriaSchema = z.object({
  contrato_id: z.string().uuid("Selecione o contrato."),
  tipo: z.enum(["entrada", "devolucao"]),
  data: z.string().min(1, "Informe a data."),
  responsavel: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

function nuloSeVazio(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarVistoria(
  _prev: VistoriaFormState,
  formData: FormData,
): Promise<VistoriaFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!PODE.includes(perfil.papel)) return { error: "Sem permissão." };

  const parsed = vistoriaSchema.safeParse({
    contrato_id: formData.get("contrato_id"),
    tipo: formData.get("tipo"),
    data: formData.get("data"),
    responsavel: formData.get("responsavel") ?? undefined,
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const dados = {
    contrato_id: parsed.data.contrato_id,
    tipo: parsed.data.tipo,
    data: parsed.data.data,
    responsavel: nuloSeVazio(parsed.data.responsavel),
    observacoes: nuloSeVazio(parsed.data.observacoes),
  };

  const supabase = await createClient();
  let vistoriaId = id;
  if (id) {
    const { error } = await supabase.from("vistoria").update(dados).eq("id", id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { data, error } = await supabase
      .from("vistoria")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return { error: "Não foi possível salvar." };
    vistoriaId = data.id;
  }

  revalidatePath("/vistorias");
  redirect(`/vistorias/${vistoriaId}`);
}

export async function excluirVistoria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !PODE.includes(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  // Remove as fotos do storage antes de apagar a vistoria.
  const { data: fotos } = await supabase
    .from("vistoria_foto")
    .select("path")
    .eq("vistoria_id", id);
  if (fotos?.length) {
    await supabase.storage.from("vistorias").remove(fotos.map((f) => f.path));
  }
  await supabase.from("vistoria").delete().eq("id", id);
  revalidatePath("/vistorias");
  redirect("/vistorias");
}

/** Registra no banco uma foto já enviada ao storage pelo cliente. */
export async function registrarFoto(vistoriaId: string, path: string) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !PODE.includes(perfil.papel)) return;
  const supabase = await createClient();
  await supabase
    .from("vistoria_foto")
    .insert({ org_id: perfil.org_id, vistoria_id: vistoriaId, path });
  revalidatePath(`/vistorias/${vistoriaId}`);
}

export async function excluirFoto(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !PODE.includes(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const path = (formData.get("path") as string | null)?.trim();
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id || !path) return;
  const supabase = await createClient();
  await supabase.storage.from("vistorias").remove([path]);
  await supabase.from("vistoria_foto").delete().eq("id", id);
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

const avariaSchema = z.object({
  vistoria_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva a avaria.").max(300),
  custo_estimado: z.coerce.number().min(0).default(0),
});

export type AvariaFormState = { error?: string };

export async function adicionarAvaria(
  _prev: AvariaFormState,
  formData: FormData,
): Promise<AvariaFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!PODE.includes(perfil.papel)) return { error: "Sem permissão." };

  const parsed = avariaSchema.safeParse({
    vistoria_id: formData.get("vistoria_id"),
    descricao: formData.get("descricao"),
    custo_estimado: formData.get("custo_estimado") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("avaria").insert({
    org_id: perfil.org_id,
    vistoria_id: parsed.data.vistoria_id,
    descricao: parsed.data.descricao,
    custo_estimado: parsed.data.custo_estimado,
  });
  if (error) return { error: "Não foi possível adicionar a avaria." };
  revalidatePath(`/vistorias/${parsed.data.vistoria_id}`);
  return {};
}

export async function atualizarStatusAvaria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !PODE.includes(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const status = formData.get("status") as string | null;
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id || !["aberta", "cobrada", "resolvida"].includes(status ?? "")) return;
  const supabase = await createClient();
  await supabase.from("avaria").update({ status }).eq("id", id);
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

export async function excluirAvaria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !PODE.includes(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("avaria").delete().eq("id", id);
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}
