import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/permissoes";

// Re-exporta os tipos e helpers puros para quem já importa de "@/lib/auth".
// (A lógica de permissão vive em "@/lib/permissoes", sem dependência de servidor.)
export type { Papel, Perfil } from "@/lib/permissoes";
export {
  PAPEIS,
  PAPEL_INFO,
  podeEditarCadastros,
  podeOperar,
  podeGerenciarFinanceiro,
  podeGerenciarUsuarios,
  podeConfigurarSistema,
  podeExcluirCritico,
} from "@/lib/permissoes";

/**
 * Retorna o perfil do usuário autenticado (ou null se não houver sessão).
 * Server-only: usa cookies via o client de servidor do Supabase.
 */
export async function getCurrentPerfil(): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfil")
    .select("id, org_id, nome, email, papel")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
}
