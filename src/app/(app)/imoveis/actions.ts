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
  await supabase.from("imovel").delete().eq("id", id);
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
