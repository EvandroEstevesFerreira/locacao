"use server";

// Apontamento de uso — fase 3a.
//
// A conta das horas NÃO mora aqui: é o trigger `calcular_horas_apontamento`
// (migration 0071). "Horas do período" é a diferença para a leitura anterior DA
// MESMA PEÇA, e "anterior" depende da DATA — não da ordem de digitação. Alguém
// lança a leitura de segunda depois de já ter lançado a de quarta, e a action
// teria de recalcular as duas. No banco a regra fica num lugar só.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { apontamentoSchema } from "@/lib/apontamento";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

export async function salvarApontamento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para lançar apontamentos.");
  }

  const parsed = apontamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("apontamento_uso").update(campos).eq("id", id)
    : await supabase.from("apontamento_uso").insert({
        org_id: perfil.org_id,
        created_by: perfil.id,
        ...campos,
      });

  if (error) {
    console.error("salvarApontamento", error);
    const codigo = (error as { code?: string }).code;
    // `22023` é o `raise` do trigger quando a leitura anda para trás. A
    // mensagem dele foi escrita para o usuário e diz o conserto — repassá-la é
    // melhor do que substituir por um texto genérico.
    if (codigo === "22023") {
      return falha(
        (error as { message?: string }).message ??
          "A leitura é menor que a anterior.",
      );
    }
    // `23505` só pode ser `unique (unidade_id, data)`.
    if (codigo === "23505") {
      return falha(
        "Já existe uma leitura desta peça nesta data. O horímetro é acumulado — edite a leitura que já existe.",
      );
    }
    return falha("Não foi possível salvar o apontamento.");
  }

  revalidatePath(`/frota/${campos.unidade_id}`);
  revalidatePath("/frota/uso");
  return { ok: true };
}

export async function excluirApontamento(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir apontamentos." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const unidadeId = String(formData.get("unidade_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  // Exclusão de verdade: o apontamento não é documento, e o trigger
  // `trg_recalcular_seguinte` refaz as horas do apontamento posterior — sem
  // isso, tirar uma leitura do meio deixaria a seguinte contando um período
  // que não existe mais.
  const { error } = await supabase.from("apontamento_uso").delete().eq("id", id);
  if (error) {
    console.error("excluirApontamento", error);
    return { error: "Não foi possível excluir o apontamento." };
  }

  if (unidadeId) revalidatePath(`/frota/${unidadeId}`);
  revalidatePath("/frota/uso");
}
