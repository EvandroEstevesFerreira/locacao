"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";

export type PerfilFormState = { error?: string; ok?: boolean };

const schema = z.object({
  nome: z.string().trim().min(1, "Informe seu nome.").max(120),
});

export async function atualizarMeuPerfil(
  _prev: PerfilFormState,
  formData: FormData,
): Promise<PerfilFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil) return { error: "Sessão inválida." };

  const parsed = schema.safeParse({ nome: formData.get("nome") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("perfil")
    .update({ nome: parsed.data.nome })
    .eq("id", perfil.id);
  if (error) return { error: "Não foi possível salvar o perfil." };

  // Troca de senha (opcional) — o próprio usuário, via sessão.
  const novaSenha = String(formData.get("nova_senha") ?? "").trim();
  if (novaSenha) {
    if (novaSenha.length < 8) {
      return { error: "A nova senha deve ter ao menos 8 caracteres." };
    }
    const { error: errSenha } = await supabase.auth.updateUser({
      password: novaSenha,
    });
    if (errSenha) {
      return { error: "Perfil salvo, mas a senha não pôde ser alterada." };
    }
  }

  revalidatePath("/perfil");
  return { ok: true };
}
