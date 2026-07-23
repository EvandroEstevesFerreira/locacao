"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";

export type ObraFormState = { error?: string };

const obraSchema = z.object({
  codigo: z.string().trim().min(1, "Informe o código da obra.").max(50),
  nome: z.string().trim().min(1, "Informe o nome da obra.").max(200),
  endereco: z.string().trim().max(300).optional(),
  responsavel: z.string().trim().max(200).optional(),
  centro_custo: z.string().trim().max(100).optional(),
  status: z.enum(["ativa", "pausada", "encerrada"]),
});

function vazioParaNulo(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarObra(
  _prev: ObraFormState,
  formData: FormData,
): Promise<ObraFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida. Entre novamente." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para editar obras." };
  }

  const parsed = obraSchema.safeParse({
    codigo: formData.get("codigo"),
    nome: formData.get("nome"),
    endereco: formData.get("endereco") ?? undefined,
    responsavel: formData.get("responsavel") ?? undefined,
    centro_custo: formData.get("centro_custo") ?? undefined,
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const dados = {
    codigo: parsed.data.codigo,
    nome: parsed.data.nome,
    endereco: vazioParaNulo(parsed.data.endereco),
    responsavel: vazioParaNulo(parsed.data.responsavel),
    centro_custo: vazioParaNulo(parsed.data.centro_custo),
    status: parsed.data.status,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("obra").update(dados).eq("id", id)
    : await supabase.from("obra").insert({ org_id: perfil.org_id, ...dados });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma obra com esse código." };
    }
    return { error: "Não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/obras");
  redirect("/obras");
}

export async function excluirObra(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("obra").delete().eq("id", id);
  revalidatePath("/obras");
}
