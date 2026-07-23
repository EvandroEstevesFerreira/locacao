"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, type Papel } from "@/lib/auth";

function podeFinanceiro(papel: Papel | undefined) {
  return papel === "admin" || papel === "financeiro" || papel === "gestor";
}

export type LancamentoFormState = { error?: string };

const schema = z.object({
  obra_id: z.string().uuid("Selecione a obra."),
  contrato_id: z.string().uuid().optional().or(z.literal("")),
  descricao: z.string().trim().min(1, "Informe a descrição.").max(200),
  competencia: z.string().min(1, "Informe a competência."),
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
  if (!podeFinanceiro(perfil.papel)) return { error: "Sem permissão." };

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
    data_pagamento:
      parsed.data.status === "pago"
        ? (formData.get("data_pagamento") as string | null) ||
          parsed.data.vencimento
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
  if (!perfil?.org_id || !podeFinanceiro(perfil.papel)) return;
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

export async function excluirLancamento(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;
  if (perfil.papel !== "admin" && perfil.papel !== "financeiro") return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("lancamento_financeiro").delete().eq("id", id);
  revalidatePath("/financeiro");
}
