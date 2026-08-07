import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Perfil } from "@/lib/permissoes";

// Re-exporta os tipos e helpers puros para quem já importa de "@/lib/auth".
// (A lógica de permissão vive em "@/lib/permissoes", sem dependência de servidor
// — é de lá que os componentes cliente importam.)
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
 * Perfil do usuário autenticado, ou `null` se não houver sessão.
 *
 * Envolvido em `cache()`: são 102 chamadas em 47 arquivos — praticamente toda
 * página e toda action — e cada uma custava um `auth.getUser()` mais um SELECT
 * em `perfil`. O `cache()` do React deduplica por requisição, então o layout, a
 * página e os componentes aninhados passam a dividir uma consulta só.
 *
 * Isto é memoização POR REQUISIÇÃO, não cache entre usuários: o `createClient()`
 * lê os cookies da requisição atual, e o escopo do `cache()` morre com ela.
 *
 * Armadilha a lembrar: `cache()` chaveia por identidade de argumento. Esta
 * função não recebe nenhum, então o acerto é garantido — ao adicionar
 * parâmetros, prefira primitivos.
 */
export const getCurrentPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfil")
    .select("id, org_id, nome, email, papel, modulos")
    .eq("id", user.id)
    .single();

  return (data as Perfil) ?? null;
});
