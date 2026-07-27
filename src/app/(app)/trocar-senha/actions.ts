"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type TrocarSenhaState = { error?: string };

export async function trocarSenha(
  _prev: TrocarSenhaState,
  formData: FormData,
): Promise<TrocarSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");
  if (senha.length < 8) return { error: "A senha deve ter ao menos 8 caracteres." };
  if (senha !== confirmar) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return { error: "Sessão inválida." };

  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) return { error: "Não foi possível alterar a senha. Tente novamente." };

  // Limpa a flag de senha temporária (SECURITY DEFINER, só para o próprio usuário).
  await supabase.rpc("marcar_senha_trocada");

  redirect("/");
}
