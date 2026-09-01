"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { fechamentoSchema, montarFechamento } from "@/lib/fechamento";
import { intervaloDoMes } from "@/lib/locacao";

/**
 * Fecha a competência de uma obra, gravando a fotografia.
 *
 * Os valores são LIDOS agora e GRAVADOS. Nunca recalculados depois: se o
 * fechamento fosse consulta sobre as tabelas vivas, mudar um preço no mês
 * seguinte reescreveria este mês em silêncio, e o e-mail que o diretor tem na
 * caixa deixaria de bater com o sistema.
 */
export async function fecharCompetencia(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para fechar a competência.");
  }

  const parsed = fechamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { obra_id, competencia } = parsed.data;
  const intervalo = intervaloDoMes(competencia.slice(0, 7));
  if (!intervalo) return falha("Competência inválida.");

  const supabase = await createClient();

  const { data: orc } = await supabase
    .from("orcamento_locacao")
    .select("valor_total")
    .eq("obra_id", obra_id)
    .eq("vigente", true)
    .maybeSingle();

  // Realizado: só o que tem contrato de locação (a definição do subprojeto B).
  // ACUMULADO até o fim da competência, e o do mês à parte — o saldo é sobre o
  // acumulado, porque ninguém orça locação por mês, orça a obra.
  const { data: lancamentos, error } = await supabase
    .from("lancamento_financeiro")
    .select("valor, competencia")
    .eq("obra_id", obra_id)
    .not("contrato_id", "is", null)
    .is("deleted_at", null)
    .lte("competencia", intervalo.fim);

  if (error) {
    console.error("fecharCompetencia/lancamentos", error);
    return falha("Não foi possível ler o realizado. Tente novamente.");
  }

  let acumulado = 0;
  let doMes = 0;
  for (const l of lancamentos ?? []) {
    const v = Number(l.valor);
    acumulado += v;
    if (l.competencia >= intervalo.inicio && l.competencia <= intervalo.fim) {
      doMes += v;
    }
  }

  // Avanço no fim da competência — não o de hoje. Fechar setembro em outubro
  // tem de fotografar o avanço de setembro.
  const { data: avanco } = await supabase
    .from("avanco_obra")
    .select("percentual")
    .eq("obra_id", obra_id)
    .lte("semana", intervalo.fim)
    .order("semana", { ascending: false })
    .limit(1)
    .maybeSingle();

  const f = montarFechamento(competencia, {
    orcado: orc ? Number(orc.valor_total) : 0,
    realizadoAcumulado: acumulado,
    realizadoMes: doMes,
    avancoFisico: avanco ? Number(avanco.percentual) : null,
  });

  const { error: erroInsert } = await supabase.from("fechamento_mensal").insert({
    org_id: perfil.org_id,
    obra_id,
    competencia: f.competencia,
    orcado: f.orcado,
    realizado_acumulado: f.realizadoAcumulado,
    realizado_mes: f.realizadoMes,
    saldo: f.saldo,
    avanco_fisico: f.avancoFisico,
    consumido: f.consumido,
    fechado_por: perfil.id,
  });

  if (erroInsert) {
    console.error("fecharCompetencia/inserir", erroInsert);
    if (erroInsert.code === "23505") {
      return falha("Esta competência já está fechada para esta obra.");
    }
    return falha("Não foi possível fechar. Tente novamente.");
  }

  revalidatePath(`/obras/${obra_id}`);
  return { ok: true };
}

/**
 * Reabre uma competência fechada.
 *
 * O trigger `trg_fechamento_imutavel` só aceita este UPDATE — passar
 * `reaberto_em` de nulo para preenchido. Depois disso a linha aceita correção, e
 * a reabertura fica registrada com autor e data: é o que torna a correção
 * auditável em vez de invisível.
 */
export async function reabrirCompetencia(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para reabrir a competência.");
  }

  const parsed = fechamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from("fechamento_mensal")
    .update({ reaberto_em: new Date().toISOString(), reaberto_por: perfil.id })
    .eq("obra_id", parsed.data.obra_id)
    .eq("competencia", parsed.data.competencia)
    .is("reaberto_em", null);

  if (error) {
    console.error("reabrirCompetencia", error);
    return falha("Não foi possível reabrir. Tente novamente.");
  }

  revalidatePath(`/obras/${parsed.data.obra_id}`);
  return { ok: true };
}
