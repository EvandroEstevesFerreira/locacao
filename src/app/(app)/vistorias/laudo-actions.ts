"use server";

// O laudo de uma avaria — fase 2b.
//
// Separado de `actions.ts` porque é outro assunto: aquele arquivo cuida da
// vistoria e do ciclo financeiro da avaria (status, lançamento). Este cuida da
// APURAÇÃO — quem responde, sobre qual peça, e o texto que sustenta a cobrança.
//
// A separação também é uma trava: salvar o laudo NÃO toca em `descricao`,
// `custo_estimado` nem `status`. Duas pessoas editando a mesma avaria — uma
// escrevendo o laudo, outra corrigindo o custo — não se sobrescrevem.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { laudoAvariaSchema } from "@/lib/avaria";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { buscarAvaria } from "@/lib/data/avarias";

export async function salvarLaudoAvaria(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar laudos.");
  }

  const parsed = laudoAvariaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const avaria = await buscarAvaria(id);
  if (!avaria) return falha("Avaria não encontrada.");

  // Avaria já COBRADA não recebe laudo novo. O lançamento financeiro foi criado
  // com base na apuração que estava escrita ali: mudar o texto depois deixaria
  // a conta a pagar apoiada num laudo que já não diz o que dizia quando ela
  // nasceu — e é esse laudo que alguém vai ler se a cobrança for contestada.
  if (avaria.status === "cobrada") {
    return falha(
      "Esta avaria já virou lançamento financeiro. O laudo que sustentou a cobrança não pode ser reescrito.",
    );
  }

  // A peça, quando informada, tem de ser do contrato desta avaria. Sem esta
  // conferência, um laudo que vai ao fornecedor A poderia apontar uma peça
  // alugada do fornecedor B — e a tela oferece só as certas, mas a tela pode
  // ser contornada.
  if (campos.unidade_id && avaria.contrato) {
    const supabase = await createClient();
    const { count } = await supabase
      .from("item_locado")
      .select("id", { count: "exact", head: true })
      .eq("contrato_id", avaria.contrato.id)
      .eq("unidade_id", campos.unidade_id);
    if (!count) {
      return falha("Esta peça não pertence ao contrato desta avaria.");
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaria")
    .update(campos)
    .eq("id", id)
    // A mesma trava do `if` acima, mas contra a corrida: entre a leitura e o
    // update, alguém pode ter gerado o lançamento.
    .neq("status", "cobrada")
    .select("id");

  if (error) {
    console.error("salvarLaudoAvaria", error);
    return falha("Não foi possível salvar o laudo.");
  }
  if (!data || data.length === 0) {
    return falha("Esta avaria acabou de ser cobrada — o laudo não pode mais ser alterado.");
  }

  revalidatePath("/vistorias/avarias");
  revalidatePath(`/vistorias/avarias/${id}`);
  revalidatePath(`/vistorias/${avaria.vistoria_id}`);
  return { ok: true, id };
}

/**
 * Atualiza só o custo estimado.
 *
 * Separado do laudo de propósito: o custo costuma chegar depois, num orçamento
 * do fornecedor, e quem o digita não é quem escreveu a apuração. Exigir que os
 * dois viessem juntos faria o segundo sobrescrever o texto do primeiro com o
 * que estava na tela dele.
 */
export async function salvarCustoAvaria(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar avarias.");
  }

  const id = String((raw as { id?: string })?.id ?? "").trim();
  const bruto = String((raw as { custo_estimado?: string })?.custo_estimado ?? "").trim();
  if (!id) return falha("Avaria não informada.");

  const custo = Number(bruto.replace(",", "."));
  if (!Number.isFinite(custo) || custo < 0) {
    return falha("Informe um custo válido, igual ou maior que zero.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaria")
    .update({ custo_estimado: custo })
    .eq("id", id)
    .neq("status", "cobrada")
    .select("id");

  if (error) {
    console.error("salvarCustoAvaria", error);
    return falha("Não foi possível salvar o custo.");
  }
  if (!data || data.length === 0) {
    return falha("Avaria não encontrada ou já cobrada.");
  }

  revalidatePath("/vistorias/avarias");
  revalidatePath(`/vistorias/avarias/${id}`);
  return { ok: true, id };
}
