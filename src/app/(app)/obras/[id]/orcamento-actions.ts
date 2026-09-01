"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { orcamentoSchema } from "@/lib/orcamento";

/**
 * Salva o orçamento de locação de uma obra.
 *
 * Já existe orçamento vigente? Então isto é uma REVISÃO: a versão anterior é
 * aposentada e uma nova nasce. Nunca sobrescreve — sem a linha de base, o
 * orçamento passaria a perseguir o realizado, nunca haveria estouro porque o
 * alvo se move, e o desvio ficaria inexplicável.
 */
export async function salvarOrcamento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para definir o orçamento da obra.");
  }

  const parsed = orcamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { obra_id, valor_total, observacoes, itens } = parsed.data;
  const supabase = await createClient();

  // A versão vigente atual, para saber o próximo número e aposentá-la.
  const { data: atual } = await supabase
    .from("orcamento_locacao")
    .select("id, versao")
    .eq("obra_id", obra_id)
    .eq("vigente", true)
    .maybeSingle();

  // `idx_orcamento_vigente` recusaria dois vigentes, então a ORDEM importa:
  // aposenta antes de inserir. Invertido, o insert falharia com erro cru de
  // unique na cara do usuário.
  if (atual) {
    const { error } = await supabase
      .from("orcamento_locacao")
      .update({ vigente: false })
      .eq("id", atual.id);
    if (error) {
      console.error("salvarOrcamento/aposentar", error);
      return falha("Não foi possível salvar. Tente novamente.");
    }
  }

  const { data: novo, error } = await supabase
    .from("orcamento_locacao")
    .insert({
      org_id: perfil.org_id,
      obra_id,
      versao: (atual?.versao ?? 0) + 1,
      vigente: true,
      valor_total,
      observacoes,
      criado_por: perfil.id,
    })
    .select("id")
    .single();

  if (error || !novo) {
    console.error("salvarOrcamento/inserir", error);
    // A versão anterior já foi aposentada aqui. Reativá-la seria o certo, mas
    // exigiria transação — e o PostgREST não a oferece. O efeito de falhar aqui
    // é a obra ficar sem orçamento vigente, que a tela mostra como "não
    // cadastrado" e é recuperável salvando de novo. Nenhum dado se perde: as
    // versões antigas continuam no histórico.
    return falha("Não foi possível salvar. Tente novamente.");
  }

  if (itens.length > 0) {
    const { error: erroItens } = await supabase.from("orcamento_item").insert(
      itens.map((i) => ({
        org_id: perfil.org_id,
        orcamento_id: novo.id,
        item_id: i.item_id,
        // 0 do formulário vazio vira NULL: "quantidade não informada" e
        // "quantidade zero" são coisas diferentes.
        quantidade: i.quantidade || null,
        valor_previsto: i.valor_previsto,
      })),
    );
    if (erroItens) {
      console.error("salvarOrcamento/itens", erroItens);
      return falha("O orçamento foi salvo, mas o detalhamento por item falhou.");
    }
  }

  revalidatePath(`/obras/${obra_id}`);
  return { ok: true, id: novo.id };
}
