import "server-only";

import { createClient } from "@/lib/supabase/server";

/** Uma linha da listagem de usuários da organização. */
export type UsuarioListItem = {
  id: string;
  nome: string | null;
  email: string | null;
  papel: string;
  ativo: boolean;
};

/**
 * Usuários da organização. Sem paginação de propósito: o RLS já restringe à
 * organização e nenhuma delas tem volume que justifique paginar.
 */
export async function listarUsuarios(): Promise<UsuarioListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfil")
    .select("id, nome, email, papel, ativo")
    .order("nome");
  if (error) console.error("listarUsuarios", error.message);
  return (data ?? []) as UsuarioListItem[];
}
