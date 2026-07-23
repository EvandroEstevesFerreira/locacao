import { createClient } from "@/lib/supabase/server";

export type Papel =
  | "admin"
  | "gestor"
  | "financeiro"
  | "operacional"
  | "visualizador";

export type Perfil = {
  id: string;
  org_id: string | null;
  nome: string | null;
  email: string | null;
  papel: Papel;
};

/**
 * Retorna o perfil do usuário autenticado (ou null se não houver sessão).
 * Usado em server actions e páginas para obter org_id e papel.
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

/** Papéis com permissão de escrita nos cadastros (obras, fornecedores, itens). */
export function podeEditarCadastros(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "gestor";
}

/** Papéis com permissão de gerir o financeiro. */
export function podeGerenciarFinanceiro(papel: Papel | undefined): boolean {
  return papel === "admin" || papel === "financeiro" || papel === "gestor";
}
