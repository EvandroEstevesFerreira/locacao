"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { cnpjValido, formatarCnpj, normalizarCnpj } from "@/lib/cnpj";

export type FornecedorFormState = { error?: string };

const fornecedorSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do fornecedor.").max(200),
  cnpj: z
    .string()
    .trim()
    .max(25)
    .optional()
    .refine((v) => !v || normalizarCnpj(v) === "" || cnpjValido(v), {
      message: "CNPJ inválido. Verifique o número (formato alfanumérico).",
    }),
  contato_nome: z.string().trim().max(200).optional(),
  contato_telefone: z.string().trim().max(40).optional(),
  contato_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "E-mail de contato inválido.",
    }),
  observacoes: z.string().trim().max(1000).optional(),
});

function vazioParaNulo(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarFornecedor(
  _prev: FornecedorFormState,
  formData: FormData,
): Promise<FornecedorFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida. Entre novamente." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para editar fornecedores." };
  }

  const parsed = fornecedorSchema.safeParse({
    nome: formData.get("nome"),
    cnpj: formData.get("cnpj") ?? undefined,
    contato_nome: formData.get("contato_nome") ?? undefined,
    contato_telefone: formData.get("contato_telefone") ?? undefined,
    contato_email: formData.get("contato_email") ?? undefined,
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const ativo = formData.get("ativo") === "on" || formData.get("ativo") === "true";
  const cnpjNorm = normalizarCnpj(parsed.data.cnpj ?? "");
  const dados = {
    nome: parsed.data.nome,
    cnpj: cnpjNorm === "" ? null : formatarCnpj(cnpjNorm),
    contato_nome: vazioParaNulo(parsed.data.contato_nome),
    contato_telefone: vazioParaNulo(parsed.data.contato_telefone),
    contato_email: vazioParaNulo(parsed.data.contato_email),
    observacoes: vazioParaNulo(parsed.data.observacoes),
    ativo,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("fornecedor").update(dados).eq("id", id)
    : await supabase
        .from("fornecedor")
        .insert({ org_id: perfil.org_id, ...dados });

  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/fornecedores");
  redirect("/fornecedores");
}

export async function excluirFornecedor(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("fornecedor").delete().eq("id", id);
  revalidatePath("/fornecedores");
}
