"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { movimentoSchema, sinalDoTipo, type TipoMovimento } from "@/lib/estoque";

/**
 * Lança um movimento no razão.
 *
 * Só INSERT: o razão é append-only e o trigger
 * `trg_movimento_estoque_imutavel` recusa UPDATE e DELETE. Corrigir é
 * estornar, não editar — ver `estornarMovimento`.
 */
export async function lancarMovimento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para lançar movimento de estoque.");
  }

  const parsed = movimentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const d = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.from("movimento_estoque").insert({
    org_id: perfil.org_id,
    item_id: d.item_id,
    obra_id: d.obra_id,
    tipo: d.tipo,
    quantidade: d.quantidade,
    data: d.data,
    origem: "manual",
    documento: d.documento,
    observacoes: d.observacoes,
    registrado_por: perfil.id,
  });

  if (error) {
    console.error("lancarMovimento", error);
    return falha("Não foi possível lançar. Tente novamente.");
  }

  revalidatePath("/estoque");
  return { ok: true };
}

const estornoSchema = z.object({
  movimento_id: z.string().uuid("Movimento inválido."),
  motivo: z.string().trim().min(1, "Informe o motivo do estorno.").max(300),
});

/** O tipo que anula cada tipo. Estorno é um movimento CONTRÁRIO, não uma exclusão. */
const CONTRARIO: Record<TipoMovimento, TipoMovimento> = {
  entrada: "saida",
  saida: "entrada",
  ajuste_positivo: "ajuste_negativo",
  ajuste_negativo: "ajuste_positivo",
  // Baixa é saída de estoque; anulá-la é devolver ao saldo.
  baixa: "entrada",
};

/**
 * Estorna um movimento lançado por engano.
 *
 * Grava um movimento CONTRÁRIO apontando para o original, em vez de apagar. As
 * duas linhas ficam visíveis: apagar faria o saldo bater sem que ninguém
 * pudesse explicar a diferença depois — e é justamente a explicação que um
 * razão existe para dar.
 */
export async function estornarMovimento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para estornar movimento de estoque.");
  }

  const parsed = estornoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();

  const { data: original, error: erroLeitura } = await supabase
    .from("movimento_estoque")
    .select("id, item_id, obra_id, tipo, quantidade, data")
    .eq("id", parsed.data.movimento_id)
    .maybeSingle();

  if (erroLeitura || !original) {
    console.error("estornarMovimento/leitura", erroLeitura);
    return falha("Movimento não encontrado.");
  }

  const { error } = await supabase.from("movimento_estoque").insert({
    org_id: perfil.org_id,
    item_id: original.item_id,
    obra_id: original.obra_id,
    tipo: CONTRARIO[original.tipo as TipoMovimento],
    quantidade: original.quantidade,
    // A data do estorno é a de HOJE, não a do original: o estorno aconteceu
    // agora, e datá-lo no passado reescreveria o saldo de um período já lido.
    data: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    origem: "manual",
    observacoes: `Estorno: ${parsed.data.motivo}`,
    estorna_id: original.id,
    registrado_por: perfil.id,
  });

  if (error) {
    console.error("estornarMovimento/inserir", error);
    // O índice parcial `idx_mov_estoque_estorno` garante um estorno por
    // movimento; sem esta mensagem o usuário veria erro cru de unique.
    if (error.code === "23505") {
      return falha("Este movimento já foi estornado.");
    }
    return falha("Não foi possível estornar. Tente novamente.");
  }

  revalidatePath("/estoque");
  return { ok: true };
}

/** Só para a tela saber o efeito do estorno antes de confirmá-lo. */
export async function sinalDe(tipo: TipoMovimento): Promise<1 | -1> {
  return sinalDoTipo(tipo);
}
