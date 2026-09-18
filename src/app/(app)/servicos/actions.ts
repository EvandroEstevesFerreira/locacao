"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { servicoSchema, atribuicaoSchema } from "@/lib/servicos";
import { hojeISOSaoPaulo } from "@/lib/locacao";

export async function salvarServico(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar serviços.");
  }

  const parsed = servicoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("contrato_servico").update(dados).eq("id", id)
    : await supabase
        .from("contrato_servico")
        .insert({ org_id: perfil.org_id, ...dados });

  if (error) {
    // Os CHECKs da 0115 chegam como 23514; a mensagem crua do Postgres não
    // serve ao usuário, então cada um vira uma frase que diz o que fazer.
    if (error.code === "23514") {
      return falha(
        "Confira a quantidade, o valor e as datas: quantidade tem de ser ao " +
          "menos 1, o valor não pode ser negativo e o fim da vigência não " +
          "pode ser anterior ao início.",
      );
    }
    return falha("Não foi possível salvar. Tente novamente.");
  }

  revalidatePath("/servicos");
  return { ok: true, id: id ?? undefined };
}

/**
 * Atribui uma licença a alguém.
 *
 * O centro de custo NÃO vem daqui: ele é lido de `funcionario.obra_id` na hora
 * de montar o rateio. Gravá-lo na atribuição criaria uma segunda verdade que
 * divergiria na primeira transferência de setor.
 */
export async function atribuirLicenca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para atribuir licenças.");
  }

  const parsed = atribuicaoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const dados = parsed.data;

  const supabase = await createClient();

  // Conferência CONTRA O BANCO, e não contra o que o formulário mandou: o
  // índice único da 0115 já impede a linha duplicada, mas ele chegaria como
  // 23505 — e "já existe" não diz à pessoa que a licença está com ela mesma.
  const { count: abertas } = await supabase
    .from("atribuicao_servico")
    .select("id", { count: "exact", head: true })
    .eq("contrato_id", dados.contrato_id)
    .is("removido_em", null);

  const { data: contrato } = await supabase
    .from("contrato_servico")
    .select("quantidade")
    .eq("id", dados.contrato_id)
    .maybeSingle();

  const qtd = (contrato as { quantidade: number } | null)?.quantidade ?? 0;
  if ((abertas ?? 0) >= qtd) {
    return falha(
      `Todas as ${qtd} licenças contratadas já estão atribuídas. ` +
        "Devolva uma antes, ou aumente a quantidade do contrato.",
    );
  }

  const { error } = await supabase
    .from("atribuicao_servico")
    .insert({ org_id: perfil.org_id, ...dados });

  if (error) {
    if (error.code === "23505") {
      return falha("Essa pessoa já está com uma licença deste serviço.");
    }
    return falha("Não foi possível atribuir. Tente novamente.");
  }

  revalidatePath(`/servicos/${dados.contrato_id}`);
  revalidatePath("/servicos");
  return { ok: true };
}

/**
 * Devolve a licença: marca a saída e PRESERVA a linha.
 *
 * Não é exclusão. As duas passagens de uma pessoa pelo mesmo contrato são o
 * que responde "desde quando ela usa isto", e apagar a primeira perderia isso.
 */
export async function devolverLicenca(formData: FormData): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para devolver licenças." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  if (!id) return { error: "Atribuição inválida." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("atribuicao_servico")
    .update({ removido_em: hojeISOSaoPaulo() })
    .eq("id", id);

  if (error) return { error: "Não foi possível devolver. Tente novamente." };

  if (contratoId) revalidatePath(`/servicos/${contratoId}`);
  revalidatePath("/servicos");
}

/**
 * Marca que alguém conferiu a lista contra o provedor, hoje.
 *
 * `hojeISOSaoPaulo()` e nunca `new Date().toISOString()`: a Vercel roda em UTC
 * e entre 21h e a meia-noite em Brasília a data sairia como a de amanhã — o
 * que faria a conferência parecer mais recente do que é.
 */
export async function marcarConferido(formData: FormData): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para conferir serviços." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Serviço inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("contrato_servico")
    .update({ conferido_em: hojeISOSaoPaulo() })
    .eq("id", id);

  if (error) return { error: "Não foi possível registrar a conferência." };

  revalidatePath(`/servicos/${id}`);
  revalidatePath("/servicos");
}

export async function excluirServico(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir serviços." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Serviço inválido." };

  const supabase = await createClient();
  // Soft-delete por função, e não por `.update({ deleted_at })`: a policy de
  // SELECT esconde linhas com `deleted_at`, e o Postgres a aplica também à
  // linha NOVA de um UPDATE, abortando o próprio comando (incidente da 0.19.4).
  //
  // `soft_delete_servico` e não `soft_delete`: a função genérica da 0041 tem
  // lista fechada de entidades e levantaria "Entidade inválida" — em produção,
  // porque nenhum teste de tipo pega uma string passada por RPC.
  //
  // Ela devolve true/false: `data !== true` também é falha.
  const { data, error } = await supabase.rpc("soft_delete_servico", {
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir o serviço. Tente novamente." };
  }
  revalidatePath("/servicos");
}
