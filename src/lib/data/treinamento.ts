import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Conclusao } from "@/lib/treinamento";
import type { Papel } from "@/lib/permissoes";

const CAMPOS =
  "trilha, versao, concluido_em, acertos, total_perguntas, numero_registro";

function paraConclusao(l: Record<string, unknown>): Conclusao {
  return {
    trilha: l.trilha as string,
    versao: Number(l.versao),
    concluidoEm: l.concluido_em as string,
    acertos: Number(l.acertos),
    totalPerguntas: Number(l.total_perguntas),
    numeroRegistro: (l.numero_registro as string | null) ?? null,
  };
}

/**
 * As conclusões de uma pessoa. Erro em lista: registra e devolve vazio.
 *
 * A RLS já limita o que volta — a policy deixa a pessoa ver o seu e o
 * administrador ver todos. O filtro por `perfil_id` aqui é o escopo da
 * pergunta, não a proteção.
 */
export async function conclusoesDoUsuario(perfilId: string): Promise<Conclusao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(CAMPOS)
    .eq("perfil_id", perfilId)
    .order("concluido_em", { ascending: false });

  if (error || !data) {
    if (error) console.error("conclusoesDoUsuario", error);
    return [];
  }
  return (data as unknown as Record<string, unknown>[]).map(paraConclusao);
}

export type UsuarioTreinamento = {
  perfilId: string;
  nome: string;
  papel: Papel;
  modulos: string[] | null;
  isMaster: boolean;
};

/** Os usuários ativos da organização, para o painel de pendências. */
export async function usuariosDaOrganizacao(): Promise<UsuarioTreinamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfil")
    .select("id, nome, papel, modulos")
    .eq("ativo", true)
    .order("nome");

  if (error || !data) {
    if (error) console.error("usuariosDaOrganizacao", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => ({
    perfilId: l.id as string,
    nome: (l.nome as string | null) ?? "—",
    papel: l.papel as Papel,
    modulos: (l.modulos as string[] | null) ?? null,
    isMaster: l.papel === "master",
  }));
}

/** Todas as conclusões que a RLS permite ver. Para o painel. */
export async function conclusoesDaOrganizacao(): Promise<
  (Conclusao & { perfilId: string })[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(`perfil_id, ${CAMPOS}`);

  if (error || !data) {
    if (error) console.error("conclusoesDaOrganizacao", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => ({
    ...paraConclusao(l),
    perfilId: l.perfil_id as string,
  }));
}

/**
 * Uma conclusão específica, com a assinatura — para o comprovante em PDF.
 *
 * Erro em detalhe: devolve `null` e a rota responde 404.
 */
export async function obterConclusao(
  perfilId: string,
  trilha: string,
  versao: number,
): Promise<(Conclusao & { assinatura: string | null }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(`${CAMPOS}, assinatura`)
    .eq("perfil_id", perfilId)
    .eq("trilha", trilha)
    .eq("versao", versao)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("obterConclusao", error);
    return null;
  }

  const l = data as unknown as Record<string, unknown>;
  return { ...paraConclusao(l), assinatura: (l.assinatura as string | null) ?? null };
}
