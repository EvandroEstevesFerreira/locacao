"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeGerenciarFinanceiro,
  podeExcluirCritico,
} from "@/lib/auth";
import { periodosPorMes, type Cadencia, hojeISOSaoPaulo } from "@/lib/locacao";
import {
  mesesRecorrentes,
  lancamentoSchema,
  baixaSchema,
} from "@/lib/financeiro";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

export async function salvarLancamento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para lançar contas a pagar.");
  }

  const parsed = lancamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...campos } = parsed.data;
  const dados = {
    ...campos,
    // Consistente com alternarPago: marcado como pago sem data informada, usa
    // hoje (no fuso de Brasília — ver o fix da 0.22.0).
    data_pagamento:
      campos.status === "pago"
        ? campos.data_pagamento ?? hojeISOSaoPaulo()
        : null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("lancamento_financeiro").update(dados).eq("id", id)
    : await supabase
        .from("lancamento_financeiro")
        .insert({ org_id: perfil.org_id, ...dados });
  if (error) return falha("Não foi possível salvar. Tente novamente.");

  revalidatePath("/financeiro");
  return { ok: true, id: id ?? undefined };
}

export async function alternarPago(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeGerenciarFinanceiro(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const novo = formData.get("novo_status") as string | null;
  if (!id || !["pendente", "pago"].includes(novo ?? "")) return;

  const supabase = await createClient();
  const hoje = hojeISOSaoPaulo();
  await supabase
    .from("lancamento_financeiro")
    .update({
      status: novo,
      data_pagamento: novo === "pago" ? hoje : null,
    })
    .eq("id", id);
  revalidatePath("/financeiro");
}

/**
 * Materializa contas a pagar recorrentes (1 por mês) de um contrato de
 * locação (equipamento) ou de imóvel, do início até o mês escolhido.
 * Idempotente: nunca duplica competências já geradas como "recorrente".
 */
export async function gerarRecorrentes(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeGerenciarFinanceiro(perfil.papel)) return;

  const tipo = String(formData.get("tipo") ?? "");
  const id = String(formData.get("id") ?? "").trim();
  const ate = String(formData.get("ate") ?? "").trim();
  if (!id || !/^\d{4}-\d{2}$/.test(ate)) return;

  const supabase = await createClient();

  let obra_id: string | null = null;
  let inicio: string | null = null;
  let fim: string | null = null;
  let dia = 10;
  let valor = 0;
  let rotulo = "";

  if (tipo === "imovel") {
    const { data: c } = await supabase
      .from("contrato_imovel")
      .select(
        "id, data_inicio, data_fim, dia_vencimento, valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, imovel:imovel_id(apelido, obra_id)",
      )
      .eq("id", id)
      .single();
    if (!c) return;
    const imv = c.imovel as unknown as { apelido: string; obra_id: string | null } | null;
    obra_id = imv?.obra_id ?? null;
    inicio = c.data_inicio as string | null;
    fim = c.data_fim as string | null;
    dia = Number(c.dia_vencimento) || 10;
    valor =
      Number(c.valor_aluguel) +
      Number(c.valor_condominio) +
      Number(c.valor_iptu) +
      (c.seguro_fianca_mensal ? Number(c.seguro_fianca) : 0);
    rotulo = `Aluguel ${imv?.apelido ?? "imóvel"}`;
  } else if (tipo === "locacao") {
    const { data: c } = await supabase
      .from("contrato_locacao")
      .select(
        "id, numero, obra_id, data_inicio, data_fim_prevista, cadencia, item_locado(quantidade, valor_unitario_periodo, movimentacao(quantidade, tipo))",
      )
      .eq("id", id)
      .single();
    if (!c) return;
    obra_id = c.obra_id as string;
    inicio = c.data_inicio as string;
    fim = c.data_fim_prevista as string | null;
    const itens = (c.item_locado as Record<string, unknown>[]) ?? [];
    valor = itens.reduce((s, i) => {
      const movs = (i.movimentacao as Record<string, unknown>[]) ?? [];
      const devolvido = movs
        .filter((m) => m.tipo === "devolucao")
        .reduce((a, m) => a + Number(m.quantidade), 0);
      const saldo = Math.max(0, Number(i.quantidade) - devolvido);
      return (
        s +
        saldo *
          Number(i.valor_unitario_periodo) *
          periodosPorMes(c.cadencia as Cadencia)
      );
    }, 0);
    rotulo = `Locação contrato ${c.numero}`;
  } else {
    return;
  }

  if (!obra_id || !inicio || valor <= 0) return;

  const meses = mesesRecorrentes({ inicio, fim, ate, diaVencimento: dia });
  if (meses.length === 0) return;

  // Idempotência: pula competências já materializadas como recorrentes.
  let q = supabase
    .from("lancamento_financeiro")
    .select("competencia")
    .eq("origem", "recorrente")
    .is("deleted_at", null);
  q = tipo === "imovel" ? q.eq("contrato_imovel_id", id) : q.eq("contrato_id", id);
  const { data: existentes } = await q;
  const jaTem = new Set(
    (existentes ?? []).map((e) => String(e.competencia).slice(0, 10)),
  );

  const novos = meses
    .filter((m) => !jaTem.has(m.competencia))
    .map((m) => ({
      org_id: perfil.org_id,
      obra_id,
      contrato_id: tipo === "locacao" ? id : null,
      contrato_imovel_id: tipo === "imovel" ? id : null,
      descricao: `${rotulo} — ${m.label}`,
      competencia: m.competencia,
      valor,
      vencimento: m.vencimento,
      status: "pendente" as const,
      origem: "recorrente",
    }));

  if (novos.length > 0) {
    await supabase.from("lancamento_financeiro").insert(novos);
  }
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/recorrentes");
  redirect("/financeiro");
}

/**
 * Baixa (conciliação) de um lançamento: valor efetivamente pago, multa/juros,
 * nº da NF e comprovante (já enviado ao Storage pelo client).
 */
export async function darBaixa(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeGerenciarFinanceiro(perfil.papel)) {
    return falha("Você não tem permissão para dar baixa em lançamentos.");
  }

  const parsed = baixaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const d = parsed.data;
  const patch: Record<string, unknown> = {
    status: "pago",
    valor_pago: d.valorPago,
    multa: d.multa,
    juros: d.juros,
    nf_numero: d.nfNumero,
    data_pagamento: d.dataPagamento,
  };
  // Só sobrescreve o comprovante quando houve upload novo — senão uma segunda
  // baixa sem anexo apagaria o arquivo já enviado.
  if (d.comprovantePath) patch.comprovante_path = d.comprovantePath;

  const supabase = await createClient();
  const { error } = await supabase
    .from("lancamento_financeiro")
    .update(patch)
    .eq("id", d.id);
  if (error) return falha("Não foi possível registrar a baixa.");

  revalidatePath("/financeiro");
  return { ok: true, id: d.id };
}

export async function excluirLancamento(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeExcluirCritico(perfil.papel)) {
    return { error: "Somente o Master pode excluir lançamentos." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Lançamento inválido." };
  const supabase = await createClient();
  // Soft-delete pela função `soft_delete` (migration 0041): a policy de SELECT
  // esconde linhas com deleted_at, o que faz o RLS recusar um UPDATE direto.
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "lancamento_financeiro",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir o lançamento. Tente novamente." };
  }
  revalidatePath("/financeiro");
}
