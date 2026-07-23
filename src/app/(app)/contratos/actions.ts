"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";

export type ContratoFormState = { error?: string };

const contratoSchema = z.object({
  obra_id: z.string().uuid("Selecione a obra."),
  fornecedor_id: z.string().uuid("Selecione o fornecedor."),
  numero: z.string().trim().min(1, "Informe o número do contrato.").max(60),
  cadencia: z.enum(["diaria", "semanal", "quinzenal", "mensal"]),
  data_inicio: z.string().min(1, "Informe a data de início."),
  data_fim_prevista: z.string().optional(),
  status: z.enum(["ativo", "encerrado", "cancelado"]),
  observacoes: z.string().trim().max(1000).optional(),
});

function nuloSeVazio(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarContrato(
  _prev: ContratoFormState,
  formData: FormData,
): Promise<ContratoFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para editar contratos." };
  }

  const parsed = contratoSchema.safeParse({
    obra_id: formData.get("obra_id"),
    fornecedor_id: formData.get("fornecedor_id"),
    numero: formData.get("numero"),
    cadencia: formData.get("cadencia"),
    data_inicio: formData.get("data_inicio"),
    data_fim_prevista: formData.get("data_fim_prevista") ?? undefined,
    status: formData.get("status"),
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const dados = {
    obra_id: parsed.data.obra_id,
    fornecedor_id: parsed.data.fornecedor_id,
    numero: parsed.data.numero,
    cadencia: parsed.data.cadencia,
    data_inicio: parsed.data.data_inicio,
    data_fim_prevista: nuloSeVazio(parsed.data.data_fim_prevista),
    status: parsed.data.status,
    observacoes: nuloSeVazio(parsed.data.observacoes),
  };

  const supabase = await createClient();
  let contratoId = id;
  if (id) {
    const { error } = await supabase
      .from("contrato_locacao")
      .update(dados)
      .eq("id", id);
    if (error) return { error: "Não foi possível salvar. Tente novamente." };
  } else {
    const { data, error } = await supabase
      .from("contrato_locacao")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data)
      return { error: "Não foi possível salvar. Tente novamente." };
    contratoId = data.id;
  }

  revalidatePath("/contratos");
  redirect(`/contratos/${contratoId}`);
}

export async function excluirContrato(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("contrato_locacao").delete().eq("id", id);
  revalidatePath("/contratos");
  redirect("/contratos");
}

const itemLocadoSchema = z.object({
  contrato_id: z.string().uuid(),
  item_id: z.string().uuid("Selecione o item."),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  valor_unitario_periodo: z.coerce.number().min(0, "Valor inválido."),
  data_retirada: z.string().min(1, "Informe a data de retirada."),
  data_devolucao_prevista: z.string().optional(),
});

export type ItemLocadoFormState = { error?: string };

export async function adicionarItemLocado(
  _prev: ItemLocadoFormState,
  formData: FormData,
): Promise<ItemLocadoFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeEditarCadastros(perfil.papel)) return { error: "Sem permissão." };

  const parsed = itemLocadoSchema.safeParse({
    contrato_id: formData.get("contrato_id"),
    item_id: formData.get("item_id"),
    quantidade: formData.get("quantidade"),
    valor_unitario_periodo: formData.get("valor_unitario_periodo"),
    data_retirada: formData.get("data_retirada"),
    data_devolucao_prevista: formData.get("data_devolucao_prevista") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("item_locado").insert({
    org_id: perfil.org_id,
    contrato_id: parsed.data.contrato_id,
    item_id: parsed.data.item_id,
    quantidade: parsed.data.quantidade,
    valor_unitario_periodo: parsed.data.valor_unitario_periodo,
    data_retirada: parsed.data.data_retirada,
    data_devolucao_prevista: nuloSeVazio(parsed.data.data_devolucao_prevista),
  });
  if (error) return { error: "Não foi possível adicionar o item." };

  revalidatePath(`/contratos/${parsed.data.contrato_id}`);
  return {};
}

export async function excluirItemLocado(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("item_locado").delete().eq("id", id);
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}

const devolucaoSchema = z.object({
  item_locado_id: z.string().uuid(),
  contrato_id: z.string().uuid(),
  quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
  data: z.string().min(1, "Informe a data."),
});

export type DevolucaoFormState = { error?: string };

export async function registrarDevolucao(
  _prev: DevolucaoFormState,
  formData: FormData,
): Promise<DevolucaoFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  const papel = perfil.papel;
  if (!["admin", "gestor", "operacional"].includes(papel)) {
    return { error: "Sem permissão para registrar devolução." };
  }

  const parsed = devolucaoSchema.safeParse({
    item_locado_id: formData.get("item_locado_id"),
    contrato_id: formData.get("contrato_id"),
    quantidade: formData.get("quantidade"),
    data: formData.get("data"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { data: item } = await supabase
    .from("item_locado")
    .select("quantidade")
    .eq("id", parsed.data.item_locado_id)
    .single();
  if (!item) return { error: "Item não encontrado." };

  const { data: movs } = await supabase
    .from("movimentacao")
    .select("quantidade")
    .eq("item_locado_id", parsed.data.item_locado_id)
    .eq("tipo", "devolucao");
  const jaDevolvido = (movs ?? []).reduce(
    (s, m) => s + Number(m.quantidade),
    0,
  );
  const saldo = Number(item.quantidade) - jaDevolvido;
  if (parsed.data.quantidade > saldo) {
    return { error: `Quantidade acima do saldo em aberto (${saldo}).` };
  }

  // Cria o relatório fotográfico (vistoria) desta devolução.
  const { data: vistoria } = await supabase
    .from("vistoria")
    .insert({
      org_id: perfil.org_id,
      contrato_id: parsed.data.contrato_id,
      tipo: "devolucao",
      data: parsed.data.data,
    })
    .select("id")
    .single();

  const { error } = await supabase.from("movimentacao").insert({
    org_id: perfil.org_id,
    item_locado_id: parsed.data.item_locado_id,
    tipo: "devolucao",
    quantidade: parsed.data.quantidade,
    data: parsed.data.data,
    vistoria_id: vistoria?.id ?? null,
  });
  if (error) return { error: "Não foi possível registrar a devolução." };

  // Se zerou o saldo, marca como devolvido.
  if (jaDevolvido + parsed.data.quantidade >= Number(item.quantidade)) {
    await supabase
      .from("item_locado")
      .update({ status: "devolvido", data_devolucao: parsed.data.data })
      .eq("id", parsed.data.item_locado_id);
  }

  revalidatePath(`/contratos/${parsed.data.contrato_id}`);
  // Abre o relatório fotográfico para anexar as fotos da devolução.
  if (vistoria?.id) redirect(`/vistorias/${vistoria.id}`);
  return {};
}

/** Cria (se ainda não existir) o relatório fotográfico de retirada do contrato. */
export async function criarRelatorioRetirada(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;
  if (!["admin", "gestor", "operacional"].includes(perfil.papel)) return;

  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  if (!contratoId) return;

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("id, data_inicio, vistoria_retirada_id")
    .eq("id", contratoId)
    .single();
  if (!contrato) return;

  let vistoriaId = contrato.vistoria_retirada_id as string | null;
  if (!vistoriaId) {
    const { data: vistoria } = await supabase
      .from("vistoria")
      .insert({
        org_id: perfil.org_id,
        contrato_id: contratoId,
        tipo: "entrada",
        data: contrato.data_inicio,
      })
      .select("id")
      .single();
    vistoriaId = vistoria?.id ?? null;
    if (vistoriaId) {
      await supabase
        .from("contrato_locacao")
        .update({ vistoria_retirada_id: vistoriaId })
        .eq("id", contratoId);
    }
  }

  revalidatePath(`/contratos/${contratoId}`);
  if (vistoriaId) redirect(`/vistorias/${vistoriaId}`);
}
