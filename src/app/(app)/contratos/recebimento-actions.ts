"use server";

// Recebimento de equipamento — fase 1a: o rascunho.
//
// O fechamento, o romaneio em PDF e o e-mail ao fornecedor vêm na 1b. Até lá o
// recebimento é registro interno: nada sai do sistema, e é por isso que esta
// fase pode ir a produção sozinha sem risco de comunicar terceiro por engano.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { ehDataISO } from "@/lib/locacao";
import {
  recebimentoSchema,
  recebimentoItemSchema,
} from "@/lib/recebimento";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

/** Revalida as duas telas que mostram recebimentos. */
function revalidar(contratoId: string, recebimentoId?: string) {
  revalidatePath(`/contratos/${contratoId}`);
  if (recebimentoId) revalidatePath(`/recebimentos/${recebimentoId}`);
}

/**
 * Cria o rascunho e leva direto à conferência.
 *
 * REDIRECIONA, e por isso não devolve `ActionResult`: um `redirect()` lança
 * `NEXT_REDIRECT` e tudo depois do `await` no cliente seria código morto
 * (regra do AGENTS.md). Quem chama é um `<form action>` simples.
 *
 * Existe separado de `salvarRecebimento` porque o caminho normal é um clique
 * só: o conferente está com o caminhão parado no portão e não quer preencher
 * cabeçalho antes de listar o que chegou. Data e conferente ficam editáveis na
 * própria tela de conferência.
 */
export async function criarRascunhoRecebimento(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    throw new Error("Você não tem permissão para registrar recebimentos.");
  }
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  const recebidoEm = String(formData.get("recebido_em") ?? "").trim();
  // `ehDataISO` e não um regex aqui: a cópia inline deste guarda foi escrita
  // sem as contrabarras (`/^d{4}-d{2}-d{2}$/`), recusou toda data válida, e o
  // botão "Registrar recebimento" não criava nada — sem erro nenhum na tela.
  if (!contratoId || !ehDataISO(recebidoEm)) {
    throw new Error("Data de recebimento inválida.");
  }

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("fornecedor_id")
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato) throw new Error("Contrato não encontrado.");

  const { data, error } = await supabase
    .from("recebimento")
    .insert({
      org_id: perfil.org_id,
      contrato_id: contratoId,
      fornecedor_id: contrato.fornecedor_id,
      recebido_em: recebidoEm,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("criarRascunhoRecebimento", error);
    throw new Error("Não foi possível criar o recebimento.");
  }

  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/recebimentos/${data.id}`);
}

/**
 * Cria ou edita o cabeçalho do rascunho.
 *
 * O `fornecedor_id` NÃO vem do formulário: é lido do contrato. Deixá-lo na mão
 * do cliente permitiria gravar um recebimento apontando para um fornecedor que
 * não é o do contrato — e é esse fornecedor que receberá o aviso na fase 1b.
 */
export async function salvarRecebimento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar recebimentos.");
  }

  const parsed = recebimentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, contrato_id, ...campos } = parsed.data;

  const supabase = await createClient();

  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("id, fornecedor_id, status")
    .eq("id", contrato_id)
    .maybeSingle();
  if (!contrato) return falha("Contrato não encontrado.");

  if (id) {
    // Só rascunho é editável. O `.eq("status", "rascunho")` é a trava real: sem
    // ela, uma requisição forjada editaria um recebimento já fechado e já
    // comunicado ao fornecedor.
    const { data, error } = await supabase
      .from("recebimento")
      .update(campos)
      .eq("id", id)
      .eq("status", "rascunho")
      .select("id");
    if (error) {
      console.error("salvarRecebimento(update)", error);
      return falha("Não foi possível salvar o recebimento.");
    }
    if (!data || data.length === 0) {
      return falha("Este recebimento já foi fechado e não pode mais ser editado.");
    }
    revalidar(contrato_id, id);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("recebimento")
    .insert({
      org_id: perfil.org_id,
      contrato_id,
      fornecedor_id: contrato.fornecedor_id,
      ...campos,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("salvarRecebimento(insert)", error);
    return falha("Não foi possível criar o recebimento.");
  }

  revalidar(contrato_id, data.id);
  return { ok: true, id: data.id };
}

/**
 * Acrescenta ou edita uma linha do rascunho.
 *
 * `controle` vem no payload só para o refine do schema decidir se a peça é
 * obrigatória — não é coluna e não vai para o insert.
 */
export async function salvarRecebimentoItem(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar recebimentos.");
  }

  const parsed = recebimentoItemSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, recebimento_id } = parsed.data;
  // Lista EXPLÍCITA de colunas, e não spread do parsed: `controle` existe só
  // para o refine do schema decidir se a peça é obrigatória, e não é coluna.
  // Um spread mandaria o campo ao PostgREST e o insert falharia.
  const campos = {
    item_locado_id: parsed.data.item_locado_id,
    item_id: parsed.data.item_id,
    unidade_id: parsed.data.unidade_id,
    quantidade: parsed.data.quantidade,
    condicao: parsed.data.condicao,
    observacoes: parsed.data.observacoes,
  };

  const supabase = await createClient();

  const { data: rec } = await supabase
    .from("recebimento")
    .select("id, contrato_id, status")
    .eq("id", recebimento_id)
    .maybeSingle();
  if (!rec) return falha("Recebimento não encontrado.");
  if (rec.status !== "rascunho") {
    return falha("Este recebimento já foi fechado e não pode mais ser editado.");
  }

  const { error } = id
    ? await supabase.from("recebimento_item").update(campos).eq("id", id)
    : await supabase
        .from("recebimento_item")
        .insert({ org_id: perfil.org_id, recebimento_id, ...campos });

  if (error) {
    console.error("salvarRecebimentoItem", error);
    return falha("Não foi possível salvar o item.");
  }

  revalidar(rec.contrato_id, recebimento_id);
  return { ok: true };
}

export async function excluirRecebimentoItem(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para editar recebimentos." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const recebimentoId = String(formData.get("recebimento_id") ?? "").trim();
  if (!id || !recebimentoId) return;

  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("recebimento")
    .select("contrato_id, status")
    .eq("id", recebimentoId)
    .maybeSingle();
  if (!rec) return { error: "Recebimento não encontrado." };
  if (rec.status !== "rascunho") {
    return { error: "Este recebimento já foi fechado." };
  }

  // Exclusão de verdade, e não soft delete: a linha de um rascunho não é
  // documento — o documento nasce no fechamento. Guardar lixo de rascunho só
  // atrapalharia a conferência.
  const { error } = await supabase.from("recebimento_item").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o item." };

  revalidar(rec.contrato_id, recebimentoId);
}

/**
 * Exclui o rascunho inteiro.
 *
 * Pelo RPC `soft_delete_recebimento` (migration 0049), que recusa recebimento
 * FECHADO: ele já gerou documento e já foi comunicado ao fornecedor. O caminho
 * para desfazer um fechado é reabrir — só master, na fase 1b.
 */
export async function excluirRecebimento(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const id = String(formData.get("id") ?? "").trim();
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_recebimento", {
    p_id: id,
  });
  if (error || data !== true) {
    return {
      error:
        "Não foi possível excluir. Recebimento já fechado não pode ser excluído.",
    };
  }

  if (contratoId) revalidar(contratoId);
}
