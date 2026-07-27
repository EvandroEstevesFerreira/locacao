"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeGerenciarFinanceiro,
  podeExcluirCritico,
} from "@/lib/auth";
import { periodosPorMes, type Cadencia } from "@/lib/locacao";
import { mesesRecorrentes } from "@/lib/financeiro";

export type LancamentoFormState = { error?: string };

const schema = z.object({
  obra_id: z.string().uuid("Selecione a obra."),
  contrato_id: z.string().uuid().optional().or(z.literal("")),
  descricao: z.string().trim().min(1, "Informe a descrição.").max(200),
  competencia: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Competência inválida (use AAAA-MM)."),
  valor: z.coerce.number().positive("Valor deve ser maior que zero."),
  vencimento: z.string().min(1, "Informe o vencimento."),
  status: z.enum(["pendente", "pago"]),
});

/** 'yyyy-mm' (input month) ou 'yyyy-mm-dd' → 'yyyy-mm-01'. */
function competenciaParaData(v: string) {
  const base = v.length === 7 ? `${v}-01` : v;
  return `${base.slice(0, 7)}-01`;
}

export async function salvarLancamento(
  _prev: LancamentoFormState,
  formData: FormData,
): Promise<LancamentoFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeGerenciarFinanceiro(perfil.papel)) return { error: "Sem permissão." };

  const parsed = schema.safeParse({
    obra_id: formData.get("obra_id"),
    contrato_id: formData.get("contrato_id") ?? "",
    descricao: formData.get("descricao"),
    competencia: formData.get("competencia"),
    valor: formData.get("valor"),
    vencimento: formData.get("vencimento"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const dados = {
    obra_id: parsed.data.obra_id,
    contrato_id: parsed.data.contrato_id ? parsed.data.contrato_id : null,
    descricao: parsed.data.descricao,
    competencia: competenciaParaData(parsed.data.competencia),
    valor: parsed.data.valor,
    vencimento: parsed.data.vencimento,
    status: parsed.data.status,
    // Consistente com alternarPago: sem data informada, usa hoje (pagamento agora).
    data_pagamento:
      parsed.data.status === "pago"
        ? (formData.get("data_pagamento") as string | null) ||
          new Date().toISOString().slice(0, 10)
        : null,
  };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("lancamento_financeiro").update(dados).eq("id", id)
    : await supabase
        .from("lancamento_financeiro")
        .insert({ org_id: perfil.org_id, ...dados });
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/financeiro");
  redirect("/financeiro");
}

export async function alternarPago(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeGerenciarFinanceiro(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const novo = formData.get("novo_status") as string | null;
  if (!id || !["pendente", "pago"].includes(novo ?? "")) return;

  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);
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
export async function darBaixa(input: {
  id: string;
  valorPago: number;
  multa: number;
  juros: number;
  nfNumero: string;
  dataPagamento: string;
  comprovantePath: string | null;
}): Promise<{ error?: string }> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeGerenciarFinanceiro(perfil.papel)) return { error: "Sem permissão." };

  const id = input.id?.trim();
  if (!id) return { error: "Lançamento inválido." };
  if (!(input.valorPago > 0)) return { error: "Informe o valor pago." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataPagamento))
    return { error: "Data de pagamento inválida." };

  const supabase = await createClient();
  const patch: Record<string, unknown> = {
    status: "pago",
    valor_pago: input.valorPago,
    multa: Math.max(0, input.multa || 0),
    juros: Math.max(0, input.juros || 0),
    nf_numero: input.nfNumero?.trim() || null,
    data_pagamento: input.dataPagamento,
  };
  if (input.comprovantePath) patch.comprovante_path = input.comprovantePath;

  const { error } = await supabase
    .from("lancamento_financeiro")
    .update(patch)
    .eq("id", id);
  if (error) return { error: "Não foi possível registrar a baixa." };

  revalidatePath("/financeiro");
  return {};
}

export async function excluirLancamento(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;
  if (!podeExcluirCritico(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  // Soft-delete: preserva histórico e auditoria.
  await supabase.from("lancamento_financeiro").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/financeiro");
}
