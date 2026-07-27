"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";

export type ImovelFormState = { error?: string };

function txt(v: FormDataEntryValue | null): string | null {
  const t = String(v ?? "").trim();
  return t === "" ? null : t;
}
function num(v: FormDataEntryValue | null): number | null {
  const t = String(v ?? "").trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const TIPOS = ["kitnet", "apartamento", "casa", "galpao", "escritorio", "outro"];
const STATUS = ["ativo", "desocupacao", "encerrado"];
const STATUS_CAUCAO = ["em_aberto", "devolvida", "retida"];

// ---------------------------------------------------------------------------
// Imóvel
// ---------------------------------------------------------------------------
export async function salvarImovel(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida. Entre novamente." };
  if (!podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para gerenciar imóveis." };
  }

  const apelido = txt(formData.get("apelido"));
  if (!apelido) return { error: "Informe uma identificação (apelido) do imóvel." };

  const tipo = String(formData.get("tipo") ?? "outro");
  const status = String(formData.get("status") ?? "ativo");
  const dados = {
    tipo: TIPOS.includes(tipo) ? tipo : "outro",
    apelido,
    endereco: txt(formData.get("endereco")),
    cidade: txt(formData.get("cidade")),
    uf: txt(formData.get("uf")),
    capacidade_pessoas: num(formData.get("capacidade_pessoas")),
    area_m2: num(formData.get("area_m2")),
    obra_id: txt(formData.get("obra_id")),
    status: STATUS.includes(status) ? status : "ativo",
    proprietario_nome: txt(formData.get("proprietario_nome")),
    proprietario_telefone: txt(formData.get("proprietario_telefone")),
    proprietario_email: txt(formData.get("proprietario_email")),
    imobiliaria_nome: txt(formData.get("imobiliaria_nome")),
    imobiliaria_telefone: txt(formData.get("imobiliaria_telefone")),
    imobiliaria_email: txt(formData.get("imobiliaria_email")),
    banco: txt(formData.get("banco")),
    agencia: txt(formData.get("agencia")),
    conta: txt(formData.get("conta")),
    tipo_conta: ["corrente", "poupanca"].includes(String(formData.get("tipo_conta")))
      ? String(formData.get("tipo_conta"))
      : null,
    titular_conta: txt(formData.get("titular_conta")),
    pix_chave: txt(formData.get("pix_chave")),
    observacoes: txt(formData.get("observacoes")),
  };

  const id = txt(formData.get("id"));
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("imovel").update(dados).eq("id", id)
    : await supabase.from("imovel").insert({ org_id: perfil.org_id, ...dados });
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath("/imoveis");
  redirect(id ? `/imoveis/${id}` : "/imoveis");
}

export async function excluirImovel(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  // Soft-delete: preserva histórico e auditoria.
  await supabase.from("imovel").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/imoveis");
  redirect("/imoveis");
}

// ---------------------------------------------------------------------------
// Contrato do imóvel
// ---------------------------------------------------------------------------
export async function salvarContratoImovel(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para gerenciar contratos." };
  }

  const imovelId = txt(formData.get("imovel_id"));
  if (!imovelId) return { error: "Imóvel inválido." };

  const caucaoStatus = String(formData.get("caucao_status") ?? "");
  const vigente =
    formData.get("vigente") === "on" || formData.get("vigente") === "true";
  const dados = {
    data_inicio: txt(formData.get("data_inicio")),
    data_fim: txt(formData.get("data_fim")),
    valor_aluguel: num(formData.get("valor_aluguel")) ?? 0,
    valor_condominio: num(formData.get("valor_condominio")) ?? 0,
    valor_iptu: num(formData.get("valor_iptu")) ?? 0,
    seguro_fianca: num(formData.get("seguro_fianca")) ?? 0,
    seguro_fianca_mensal:
      formData.get("seguro_fianca_mensal") === "on" ||
      formData.get("seguro_fianca_mensal") === "true",
    dia_vencimento: num(formData.get("dia_vencimento")),
    indice_reajuste: txt(formData.get("indice_reajuste")),
    data_reajuste: txt(formData.get("data_reajuste")),
    caucao_valor: num(formData.get("caucao_valor")),
    caucao_status: STATUS_CAUCAO.includes(caucaoStatus) ? caucaoStatus : null,
    vigente,
    observacoes: txt(formData.get("observacoes")),
  };

  const id = txt(formData.get("id"));
  const supabase = await createClient();

  // Só um contrato vigente por imóvel.
  if (vigente) {
    await supabase
      .from("contrato_imovel")
      .update({ vigente: false })
      .eq("imovel_id", imovelId);
  }

  const { error } = id
    ? await supabase.from("contrato_imovel").update(dados).eq("id", id)
    : await supabase
        .from("contrato_imovel")
        .insert({ org_id: perfil.org_id, imovel_id: imovelId, ...dados });
  if (error) return { error: "Não foi possível salvar o contrato." };

  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function excluirContratoImovel(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("contrato_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

// ---------------------------------------------------------------------------
// Anexos (bucket "imoveis"): contrato do proprietário e comprovante de caução
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Contas de consumo (Fase 2) — mês a mês, com integração opcional ao financeiro
// ---------------------------------------------------------------------------
const TIPOS_CONSUMO = ["agua", "luz", "gas", "internet", "iptu", "outro"];
const CONSUMO_LABEL: Record<string, string> = {
  agua: "Água", luz: "Luz", gas: "Gás", internet: "Internet", iptu: "IPTU", outro: "Consumo",
};

export async function salvarContaConsumo(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const imovelId = txt(formData.get("imovel_id"));
  if (!imovelId) return { error: "Imóvel inválido." };
  const competencia = txt(formData.get("competencia")); // yyyy-MM (input month) ou yyyy-MM-dd
  if (!competencia) return { error: "Informe a competência (mês)." };
  const competenciaData = competencia.length === 7 ? `${competencia}-01` : competencia;

  const tipoRaw = String(formData.get("tipo") ?? "outro");
  const tipo = TIPOS_CONSUMO.includes(tipoRaw) ? tipoRaw : "outro";
  const valor = num(formData.get("valor")) ?? 0;
  const vencimento = txt(formData.get("vencimento"));
  const pago = formData.get("pago") === "on" || formData.get("pago") === "true";
  const lancar = formData.get("lancar") === "on" || formData.get("lancar") === "true";

  const supabase = await createClient();

  // Integração financeira: cria um lançamento vinculado à obra do imóvel.
  let lancamentoId: string | null = null;
  if (lancar) {
    const { data: imv } = await supabase
      .from("imovel")
      .select("apelido, obra_id")
      .eq("id", imovelId)
      .single();
    if (!imv?.obra_id) {
      return {
        error:
          "Para lançar no financeiro, o imóvel precisa estar vinculado a uma obra/centro de custo.",
      };
    }
    const mm = competenciaData.slice(0, 7).split("-").reverse().join("/");
    const { data: lanc, error: eLanc } = await supabase
      .from("lancamento_financeiro")
      .insert({
        org_id: perfil.org_id,
        obra_id: imv.obra_id,
        descricao: `[Imóvel ${imv.apelido}] ${CONSUMO_LABEL[tipo]} ${mm}`,
        competencia: competenciaData,
        valor,
        vencimento: vencimento ?? competenciaData,
        status: pago ? "pago" : "pendente",
        data_pagamento: pago ? (vencimento ?? competenciaData) : null,
      })
      .select("id")
      .single();
    if (eLanc) return { error: "Não foi possível criar o lançamento financeiro." };
    lancamentoId = lanc?.id ?? null;
  }

  const { error } = await supabase.from("conta_consumo").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    tipo,
    competencia: competenciaData,
    valor,
    vencimento,
    pago,
    lancamento_id: lancamentoId,
    observacoes: txt(formData.get("observacoes")),
  });
  if (error) return { error: "Não foi possível salvar a conta." };

  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function alternarPagoConsumo(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  const novo = formData.get("novo_status") === "pago";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("conta_consumo").update({ pago: novo }).eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

export async function excluirContaConsumo(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("conta_consumo").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

// ---------------------------------------------------------------------------
// Fase 3: vistorias, reparos e ocorrências
// ---------------------------------------------------------------------------
const TIPOS_OCORRENCIA = ["avaria", "reparo", "desentendimento", "outro"];

export async function salvarReparo(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return { error: "Sem permissão." };
  const imovelId = txt(formData.get("imovel_id"));
  const data = txt(formData.get("data"));
  const descricao = txt(formData.get("descricao"));
  if (!imovelId || !data || !descricao)
    return { error: "Preencha data e descrição do reparo." };
  const supabase = await createClient();
  const { error } = await supabase.from("reparo_imovel").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    data,
    descricao,
    valor: num(formData.get("valor")) ?? 0,
    executor: txt(formData.get("executor")),
  });
  if (error) return { error: "Não foi possível salvar o reparo." };
  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function excluirReparo(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("reparo_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarOcorrencia(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return { error: "Sem permissão." };
  const imovelId = txt(formData.get("imovel_id"));
  const data = txt(formData.get("data"));
  const descricao = txt(formData.get("descricao"));
  if (!imovelId || !data || !descricao)
    return { error: "Preencha data e descrição da ocorrência." };
  const tipoRaw = String(formData.get("tipo") ?? "outro");
  const supabase = await createClient();
  const { error } = await supabase.from("ocorrencia_imovel").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    data,
    tipo: TIPOS_OCORRENCIA.includes(tipoRaw) ? tipoRaw : "outro",
    descricao,
  });
  if (error) return { error: "Não foi possível salvar a ocorrência." };
  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function excluirOcorrencia(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("ocorrencia_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarVistoriaImovel(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return { error: "Sem permissão." };
  const imovelId = txt(formData.get("imovel_id"));
  const data = txt(formData.get("data"));
  if (!imovelId || !data) return { error: "Informe a data da vistoria." };
  const supabase = await createClient();
  const { error } = await supabase.from("vistoria_imovel").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    data,
    responsavel: txt(formData.get("responsavel")),
    observacoes: txt(formData.get("observacoes")),
  });
  if (error) return { error: "Não foi possível salvar a vistoria." };
  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function excluirVistoriaImovel(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("vistoria_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

// Anexos/fotos da Fase 3 (bucket "imoveis")
export async function salvarFotoVistoriaImovel(
  vistoriaId: string,
  imovelId: string,
  path: string,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const supabase = await createClient();
  await supabase
    .from("vistoria_imovel_foto")
    .insert({ org_id: perfil.org_id, vistoria_id: vistoriaId, path });
  revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarAnexoReparo(reparoId: string, imovelId: string, path: string) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const supabase = await createClient();
  await supabase.from("reparo_imovel").update({ anexo_path: path }).eq("id", reparoId);
  revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarAnexoOcorrencia(
  ocorrenciaId: string,
  imovelId: string,
  path: string,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const supabase = await createClient();
  await supabase
    .from("ocorrencia_imovel")
    .update({ anexo_path: path })
    .eq("id", ocorrenciaId);
  revalidatePath(`/imoveis/${imovelId}`);
}

// ---------------------------------------------------------------------------
// Fase 4: ocupantes
// ---------------------------------------------------------------------------
export async function salvarOcupante(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return { error: "Sem permissão." };
  const imovelId = txt(formData.get("imovel_id"));
  const nome = txt(formData.get("nome"));
  if (!imovelId || !nome) return { error: "Informe o nome do ocupante." };
  const supabase = await createClient();
  const { error } = await supabase.from("ocupante_imovel").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    nome,
    cpf: txt(formData.get("cpf")),
    contato: txt(formData.get("contato")),
    data_entrada: txt(formData.get("data_entrada")),
    data_saida: txt(formData.get("data_saida")),
  });
  if (error) return { error: "Não foi possível salvar o ocupante." };
  revalidatePath(`/imoveis/${imovelId}`);
  redirect(`/imoveis/${imovelId}`);
}

export async function excluirOcupante(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("ocupante_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

const CAMPOS_ANEXO = ["anexo_contrato_path", "caucao_comprovante_path"] as const;
type CampoAnexo = (typeof CAMPOS_ANEXO)[number];

export async function salvarAnexoImovelContrato(
  contratoId: string,
  campo: CampoAnexo,
  path: string,
  imovelId: string,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  if (!CAMPOS_ANEXO.includes(campo)) return;
  const supabase = await createClient();
  await supabase.from("contrato_imovel").update({ [campo]: path }).eq("id", contratoId);
  revalidatePath(`/imoveis/${imovelId}`);
}

export async function removerAnexoImovelContrato(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const contratoId = txt(formData.get("contrato_id"));
  const imovelId = txt(formData.get("imovel_id"));
  const campo = String(formData.get("campo") ?? "") as CampoAnexo;
  if (!contratoId || !CAMPOS_ANEXO.includes(campo)) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_imovel")
    .select(campo)
    .eq("id", contratoId)
    .single();
  const path = (data as Record<string, string | null> | null)?.[campo];
  if (path) await supabase.storage.from("imoveis").remove([path]);
  await supabase.from("contrato_imovel").update({ [campo]: null }).eq("id", contratoId);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}
