"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { CATEGORIAS_BIBLIOTECA } from "@/lib/biblioteca";
import {
  medidaDisciplinarSchema,
  entregaOcupanteSchema,
  segundaFeiraDaSemana,
} from "@/lib/alojamento";
import { TAREFAS } from "@/lib/documentos/frm-rh-005";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import {
  contaConsumoSchema,
  contratoImovelSchema,
  imovelSchema,
  ocupanteSchema,
  reparoSchema,
} from "@/lib/imoveis";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

export type ImovelFormState = { error?: string; ok?: boolean };

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


// ---------------------------------------------------------------------------
// Imóvel
// ---------------------------------------------------------------------------
export async function salvarImovel(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para gerenciar imóveis.");
  }

  const parsed = imovelSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("imovel").update(dados).eq("id", id)
    : await supabase.from("imovel").insert({ org_id: perfil.org_id, ...dados });
  if (error) return falha("Não foi possível salvar. Tente novamente.");

  revalidatePath("/imoveis");
  return { ok: true, id: id ?? undefined };
}

export async function excluirImovel(formData: FormData): Promise<ImovelFormState | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir imóveis." };
  }
  const id = txt(formData.get("id"));
  if (!id) return { error: "Imóvel inválido." };
  const supabase = await createClient();
  // Soft-delete pela função `soft_delete` (migration 0041): a policy de SELECT
  // esconde linhas com deleted_at, o que faz o RLS recusar um UPDATE direto.
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "imovel",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir o imóvel. Tente novamente." };
  }
  revalidatePath("/imoveis");
  redirect("/imoveis");
}

// ---------------------------------------------------------------------------
// Contrato do imóvel
// ---------------------------------------------------------------------------
export async function salvarContratoImovel(
  raw: unknown,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para gerenciar contratos.");
  }

  const parsed = contratoImovelSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, imovel_id: imovelId, ...dados } = parsed.data;

  const supabase = await createClient();

  // Só um contrato vigente por imóvel.
  if (dados.vigente) {
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
  if (error) return falha("Não foi possível salvar o contrato.");

  revalidatePath(`/imoveis/${imovelId}`);
  return { ok: true, id: id ?? undefined };
}

export async function excluirContratoImovel(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir contratos de imóvel." };
  }
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("contrato_imovel").delete().eq("id", id);
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

// ---------------------------------------------------------------------------
// Aditivos / reajuste / encerramento (com histórico versionado)
// ---------------------------------------------------------------------------
type SupaAny = Awaited<ReturnType<typeof createClient>>;

async function logHistorico(
  supabase: SupaAny,
  base: { org_id: string; imovel_id: string; contrato_id: string },
  tipo: "aditivo" | "reajuste" | "encerramento" | "renovacao",
  descricao: string,
  dataEfeito: string,
) {
  await supabase
    .from("contrato_imovel_historico")
    .insert({ ...base, tipo, descricao, data_efeito: dataEfeito });
}

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function carregarContrato(supabase: SupaAny, id: string) {
  const { data } = await supabase
    .from("contrato_imovel")
    .select("id, imovel_id, valor_aluguel, valor_condominio, valor_iptu, data_fim, data_reajuste, vigente")
    .eq("id", id)
    .single();
  return data as
    | {
        id: string;
        imovel_id: string;
        valor_aluguel: number;
        valor_condominio: number;
        valor_iptu: number;
        data_fim: string | null;
        data_reajuste: string | null;
        vigente: boolean;
      }
    | null;
}

/** Reajuste percentual do aluguel: gera histórico e adianta a data de reajuste. */
export async function aplicarReajuste(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const contratoId = txt(formData.get("contrato_id"));
  const pct = num(formData.get("percentual"));
  const dataEfeito = txt(formData.get("data_efeito"));
  if (!contratoId) return { error: "Contrato inválido." };
  if (pct == null || pct <= 0) return { error: "Informe um percentual válido." };
  if (!dataEfeito) return { error: "Informe a data de efeito." };

  const supabase = await createClient();
  const c = await carregarContrato(supabase, contratoId);
  if (!c) return { error: "Contrato não encontrado." };

  const novo = Math.round((Number(c.valor_aluguel) * (1 + pct / 100) + Number.EPSILON) * 100) / 100;
  // Próximo reajuste ~12 meses após o efeito.
  const prox = new Date(dataEfeito + "T00:00:00");
  prox.setFullYear(prox.getFullYear() + 1);
  const proxISO = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}-${String(prox.getDate()).padStart(2, "0")}`;

  const { error } = await supabase
    .from("contrato_imovel")
    .update({ valor_aluguel: novo, data_reajuste: proxISO })
    .eq("id", contratoId);
  if (error) return { error: "Não foi possível aplicar o reajuste." };

  await logHistorico(
    supabase,
    { org_id: perfil.org_id, imovel_id: c.imovel_id, contrato_id: contratoId },
    "reajuste",
    `Reajuste de ${pct}%: aluguel ${brl(Number(c.valor_aluguel))} → ${brl(novo)}`,
    dataEfeito,
  );

  revalidatePath(`/imoveis/${c.imovel_id}`);
  redirect(`/imoveis/${c.imovel_id}`);
}

/** Aditivo com efeito no valor e/ou no prazo, preservando o histórico. */
export async function registrarAditivo(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const contratoId = txt(formData.get("contrato_id"));
  const dataEfeito = txt(formData.get("data_efeito"));
  const motivo = txt(formData.get("motivo"));
  const novoAluguel = num(formData.get("novo_aluguel"));
  const novaDataFim = txt(formData.get("nova_data_fim"));
  if (!contratoId) return { error: "Contrato inválido." };
  if (!dataEfeito) return { error: "Informe a data de efeito." };
  if (novoAluguel == null && !novaDataFim) {
    return { error: "Informe um novo valor de aluguel e/ou novo prazo." };
  }

  const supabase = await createClient();
  const c = await carregarContrato(supabase, contratoId);
  if (!c) return { error: "Contrato não encontrado." };

  const patch: Record<string, unknown> = {};
  const partes: string[] = [];
  if (novoAluguel != null && novoAluguel !== Number(c.valor_aluguel)) {
    patch.valor_aluguel = novoAluguel;
    partes.push(`aluguel ${brl(Number(c.valor_aluguel))} → ${brl(novoAluguel)}`);
  }
  if (novaDataFim && novaDataFim !== c.data_fim) {
    patch.data_fim = novaDataFim;
    partes.push(`prazo até ${novaDataFim.split("-").reverse().join("/")}`);
  }
  if (Object.keys(patch).length === 0) {
    return { error: "Nenhuma alteração em relação ao contrato atual." };
  }

  const { error } = await supabase.from("contrato_imovel").update(patch).eq("id", contratoId);
  if (error) return { error: "Não foi possível registrar o aditivo." };

  await logHistorico(
    supabase,
    { org_id: perfil.org_id, imovel_id: c.imovel_id, contrato_id: contratoId },
    "aditivo",
    `Aditivo: ${partes.join("; ")}${motivo ? ` — ${motivo}` : ""}`,
    dataEfeito,
  );

  revalidatePath(`/imoveis/${c.imovel_id}`);
  redirect(`/imoveis/${c.imovel_id}`);
}

/** Encerramento/distrato: encerra a vigência e registra data + motivo. */
export async function encerrarContrato(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const contratoId = txt(formData.get("contrato_id"));
  const dataEnc = txt(formData.get("data_encerramento"));
  const motivo = txt(formData.get("motivo"));
  if (!contratoId) return { error: "Contrato inválido." };
  if (!dataEnc) return { error: "Informe a data de encerramento." };

  const supabase = await createClient();
  const c = await carregarContrato(supabase, contratoId);
  if (!c) return { error: "Contrato não encontrado." };

  const { error } = await supabase
    .from("contrato_imovel")
    .update({ vigente: false, data_encerramento: dataEnc, motivo_encerramento: motivo })
    .eq("id", contratoId);
  if (error) return { error: "Não foi possível encerrar o contrato." };

  await logHistorico(
    supabase,
    { org_id: perfil.org_id, imovel_id: c.imovel_id, contrato_id: contratoId },
    "encerramento",
    `Encerramento${motivo ? `: ${motivo}` : ""}`,
    dataEnc,
  );

  revalidatePath(`/imoveis/${c.imovel_id}`);
  redirect(`/imoveis/${c.imovel_id}`);
}

// ---------------------------------------------------------------------------
// Anexos (bucket "imoveis"): contrato do proprietário e comprovante de caução
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Contas de consumo (Fase 2) — mês a mês, com integração opcional ao financeiro
// ---------------------------------------------------------------------------
const CONSUMO_LABEL: Record<string, string> = {
  agua: "Água", luz: "Luz", gas: "Gás", internet: "Internet", iptu: "IPTU", outro: "Consumo",
};

export async function salvarContaConsumo(
  raw: unknown,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para lançar contas de consumo.");
  }

  const parsed = contaConsumoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const {
    imovel_id: imovelId,
    competencia,
    tipo,
    valor,
    vencimento,
    pago,
    lancar,
    observacoes,
  } = parsed.data;
  const competenciaData =
    competencia.length === 7 ? `${competencia}-01` : competencia;

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
      return falha(
        "Para lançar no financeiro, o imóvel precisa estar vinculado a uma obra/centro de custo.",
      );
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
    if (eLanc) return falha("Não foi possível criar o lançamento financeiro.");
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
    observacoes,
  });
  if (error) return falha("Não foi possível salvar a conta.");

  revalidatePath(`/imoveis/${imovelId}`);
  return { ok: true };
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
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir contas de consumo." };
  }
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

export async function salvarReparo(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar reparos.");
  }

  const parsed = reparoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { imovel_id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("reparo_imovel").insert({
    org_id: perfil.org_id,
    imovel_id,
    ...campos,
  });
  if (error) return falha("Não foi possível salvar o reparo.");

  // Sem `redirect()`: a action devolve {ok} e o form chama router.refresh().
  // Um redirect aqui faria o NEXT_REDIRECT propagar e matar todo o código
  // depois do await no client.
  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}

export async function excluirReparo(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir reparos." };
  }
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
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir ocorrências." };
  }
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
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir vistorias do imóvel." };
  }
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
export async function salvarOcupante(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para cadastrar ocupantes.");
  }

  const parsed = ocupanteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { imovel_id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ocupante_imovel").insert({
    org_id: perfil.org_id,
    imovel_id,
    ...campos,
  });
  if (error) return falha("Não foi possível salvar o ocupante.");

  // Sem `redirect()`: a action devolve {ok} e o form chama router.refresh().
  // Um redirect aqui faria o NEXT_REDIRECT propagar e matar todo o código
  // depois do await no client.
  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}

export async function excluirOcupante(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir ocupantes." };
  }
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

// ---------------------------------------------------------------------------
// Biblioteca de documentos do alojamento (nível organização, bucket "imoveis").
// ---------------------------------------------------------------------------
export async function salvarDocumentoBiblioteca(
  path: string,
  categoria: string,
  titulo: string,
  descricao: string | null,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) return;
  if (!path || !titulo.trim()) return;
  const supabase = await createClient();
  await supabase.from("biblioteca_documento").insert({
    org_id: perfil.org_id,
    categoria: CATEGORIAS_BIBLIOTECA.includes(categoria as never) ? categoria : "outro",
    titulo: titulo.trim(),
    descricao: descricao?.trim() || null,
    path,
  });
  revalidatePath("/imoveis/documentos");
}

export async function atualizarDocumentoBiblioteca(
  _prev: ImovelFormState,
  formData: FormData,
): Promise<ImovelFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Sem permissão." };
  }
  const id = txt(formData.get("id"));
  const titulo = txt(formData.get("titulo"));
  if (!id) return { error: "Documento inválido." };
  if (!titulo) return { error: "Informe o título do documento." };
  const categoria = String(formData.get("categoria") ?? "outro");
  const supabase = await createClient();
  const { error } = await supabase
    .from("biblioteca_documento")
    .update({
      titulo,
      descricao: txt(formData.get("descricao")),
      categoria: CATEGORIAS_BIBLIOTECA.includes(categoria as never) ? categoria : "outro",
    })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar." };
  revalidatePath("/imoveis/documentos");
  return { ok: true };
}

export async function excluirDocumentoBiblioteca(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir documentos." };
  }
  const id = txt(formData.get("id"));
  const path = txt(formData.get("path"));
  if (!id) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("imoveis").remove([path]);
  await supabase.from("biblioteca_documento").delete().eq("id", id);
  revalidatePath("/imoveis/documentos");
}

export async function removerAnexoImovelContrato(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para remover anexos do imóvel." };
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// Alojamento — medida disciplinar e entregas ao ocupante (fase 3)
// ═══════════════════════════════════════════════════════════════════════════

export async function salvarMedidaDisciplinar(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  // Registro disciplinar é documento de pasta funcional: só quem gere cadastros
  // registra. A RLS repete a regra — isto aqui é a mensagem amigável.
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para registrar medidas disciplinares.");
  }

  const parsed = medidaDisciplinarSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { imovel_id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("medida_disciplinar").insert({
    org_id: perfil.org_id,
    imovel_id,
    ...campos,
  });
  if (error) return falha("Não foi possível registrar a medida disciplinar.");

  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}

export async function excluirMedidaDisciplinar(formData: FormData) {
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  // Sempre pelo RPC: a policy de SELECT esconde linhas com deleted_at, então um
  // `.update({ deleted_at })` aborta o próprio comando (incidente da 0.19.4).
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "medida_disciplinar",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir a medida disciplinar." };
  }
  revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarEntregaOcupante(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar entregas.");
  }

  const parsed = entregaOcupanteSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { imovel_id, itens, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("entrega_ocupante").insert({
    org_id: perfil.org_id,
    imovel_id,
    itens,
    ...campos,
  });
  if (error) return falha("Não foi possível registrar a entrega.");

  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}

export async function excluirEntregaOcupante(formData: FormData) {
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "entrega_ocupante",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir a entrega." };
  }
  revalidatePath(`/imoveis/${imovelId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Rotina semanal de limpeza (fase 4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Semeia o catálogo de tarefas da organização a partir do embutido no código.
 *
 * Existe porque a folha impressa precisa das tarefas ANTES de alguém as
 * cadastrar uma a uma: são 44. Depois de semeado, o catálogo é da organização e
 * pode ser editado — a semeadura não roda de novo se já houver tarefa.
 */
export async function semearTarefasLimpeza(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    throw new Error("Sem permissão para configurar o catálogo de limpeza.");
  }
  const imovelId = txt(formData.get("imovel_id"));

  const supabase = await createClient();
  const { count } = await supabase
    .from("tarefa_limpeza")
    .select("id", { count: "exact", head: true });
  // Idempotente: já semeado, não faz nada. Dois cliques não duplicam 44 linhas.
  if ((count ?? 0) > 0) return;

  const linhas = TAREFAS.map((t, i) => ({
    org_id: perfil.org_id,
    grupo: t.grupo,
    descricao: t.descricao,
    frequencia: t.frequencia,
    ordem: i,
  }));
  const { error } = await supabase.from("tarefa_limpeza").insert(linhas);
  if (error) throw new Error("Não foi possível criar o catálogo de tarefas.");

  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
  revalidatePath("/configuracoes");
}

/**
 * Abre o checklist da semana corrente de um imóvel.
 *
 * Chamada direto de um `<form action>`, então devolve `{error}` e não
 * `ActionResult`: o React exige `void | Promise<void>` nessa posição.
 */
export async function abrirChecklistSemana(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    throw new Error("Você não tem permissão para abrir checklists.");
  }
  const imovelId = txt(formData.get("imovel_id"));
  if (!imovelId) return;

  // `hojeISOSaoPaulo()`, nunca `new Date()`: o Vercel roda em UTC e das 21h à
  // meia-noite em Brasília a semana viraria antes da hora.
  const semana = segundaFeiraDaSemana(hojeISOSaoPaulo());

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_limpeza").insert({
    org_id: perfil.org_id,
    imovel_id: imovelId,
    semana_inicio: semana,
  });
  // 23505 = unique violation. O `unique (imovel_id, semana_inicio)` existe
  // justamente para isto: dois checklists da mesma semana deixariam a obra com
  // duas folhas divergentes e nenhuma delas oficial.
  // 23505 = unique violation. O botão só aparece quando a semana não está
  // aberta, então isto é corrida entre dois cliques: o estado desejado já vale,
  // e insistir num erro só confundiria. Qualquer outra falha sobe para o
  // error boundary de (app).
  if (error && error.code !== "23505") {
    throw new Error("Não foi possível abrir o checklist da semana.");
  }

  revalidatePath(`/imoveis/${imovelId}`);
}

export async function excluirChecklistLimpeza(formData: FormData) {
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "checklist_limpeza",
    p_id: id,
  });
  if (error || data !== true) return { error: "Não foi possível excluir o checklist." };
  revalidatePath(`/imoveis/${imovelId}`);
}
