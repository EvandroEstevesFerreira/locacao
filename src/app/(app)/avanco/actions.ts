"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { avancoSchema } from "@/lib/avanco";

// Só as linhas que o usuário realmente preencheu chegam aqui — a tela filtra as
// vazias antes de enviar. O `min(1)` é a rede: um lote vazio significaria que o
// filtro do cliente falhou, e gravar nada em silêncio esconderia isso.
const loteSchema = z.object({
  linhas: z.array(avancoSchema).min(1, "Informe o avanço de ao menos uma obra."),
});

/**
 * Grava o avanço da semana de várias obras de uma vez.
 *
 * Em lote de propósito: quem lança é o administrativo, na segunda-feira, para
 * todas as obras. Uma action por obra significaria 8 idas ao servidor e uma
 * tela que ninguém preenche até o fim.
 */
export async function salvarAvancos(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para lançar o avanço das obras.");
  }

  const parsed = loteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();

  // `onConflict` no par (obra_id, semana) é o que torna relançar uma CORREÇÃO
  // em vez de duplicata — e é por isso que a semana é canonizada na
  // segunda-feira antes de chegar aqui. Sem isso, o avanço acumulado viraria
  // lixo no primeiro relançamento.
  const { error } = await supabase.from("avanco_obra").upsert(
    parsed.data.linhas.map((l) => ({
      org_id: perfil.org_id,
      obra_id: l.obra_id,
      semana: l.semana,
      percentual: l.percentual,
      observacoes: l.observacoes,
      informado_por: perfil.id,
    })),
    { onConflict: "obra_id,semana" },
  );

  if (error) {
    console.error("salvarAvancos", error);
    return falha("Não foi possível salvar. Tente novamente.");
  }

  revalidatePath("/avanco");
  revalidatePath("/obras");
  return { ok: true };
}
