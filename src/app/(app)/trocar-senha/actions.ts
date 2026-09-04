"use server";

import { createClient } from "@/lib/supabase/server";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { trocarSenhaSchema } from "@/lib/permissoes";

/**
 * Troca a senha do próprio usuário e limpa a flag de senha temporária.
 *
 * Recebe `raw: unknown` (o objeto tipado que o react-hook-form entrega) em vez
 * de FormData, e devolve `ActionResult`. Não chama `redirect()`: quem navega é o
 * cliente, com `router.replace`. As duas coisas juntas não funcionam — o
 * `redirect()` lança NEXT_REDIRECT e o `if (!r.ok)` do cliente nunca rodaria.
 */
export async function trocarSenha(raw: unknown): Promise<ActionResult> {
  const parsed = trocarSenhaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return falha("Sessão inválida. Entre novamente.");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.senha,
  });
  if (error) {
    return falha("Não foi possível alterar a senha. Tente novamente.");
  }

  // Limpa a flag de senha temporária (SECURITY DEFINER, só para o próprio
  // usuário). Se falhar, a senha já foi trocada — o middleware apenas pediria a
  // troca outra vez, o que é melhor do que reportar erro numa operação
  // concluída.
  const { error: erroFlag } = await supabase.rpc("marcar_senha_trocada");
  // Ignorar a falha é deliberado (ver acima), mas ela precisa deixar rastro:
  // sem log, um usuário preso pedindo troca de senha a cada acesso vira um
  // mistério sem ponto de partida.
  if (erroFlag) console.error("marcarSenhaTrocada", erroFlag);

  return { ok: true };
}
