"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { rateioSchema } from "@/lib/custo-item";

/**
 * Grava o rateio de um lançamento entre as linhas do contrato.
 *
 * O rateio é SUBSTITUÍDO por inteiro: apaga as parcelas e grava as novas. É o
 * comportamento certo para um editor de lista — a alternativa, diferenciar o
 * que mudou, criaria um estado intermediário sem valor nenhum e um bug de
 * parcela órfã quando alguém remove uma linha.
 *
 * Parcela com valor zero não é gravada: "não atribuí nada a este item" e
 * "atribuí R$ 0,00" são a mesma coisa, e a segunda só polui a leitura.
 */
export async function salvarRateio(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para ratear lançamentos.");
  }

  const parsed = rateioSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { lancamento_id, parcelas } = parsed.data;
  const supabase = await createClient();

  const { error: erroApagar } = await supabase
    .from("lancamento_item")
    .delete()
    .eq("lancamento_id", lancamento_id);
  if (erroApagar) {
    console.error("salvarRateio/apagar", erroApagar);
    return falha("Não foi possível salvar. Tente novamente.");
  }

  const aGravar = parcelas.filter((p) => p.valor > 0);
  if (aGravar.length > 0) {
    const { error } = await supabase.from("lancamento_item").insert(
      aGravar.map((p) => ({
        org_id: perfil.org_id,
        lancamento_id,
        item_locado_id: p.item_locado_id,
        valor: p.valor,
      })),
    );
    if (error) {
      console.error("salvarRateio/inserir", error);
      return falha("Não foi possível salvar. Tente novamente.");
    }
  }

  revalidatePath("/financeiro");
  revalidatePath(`/financeiro/${lancamento_id}/rateio`);
  // A obra também: é lá que o confronto orçado × realizado por item aparece.
  revalidatePath("/obras");
  return { ok: true };
}
