"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeOperar,
  podeEditarCadastros,
  type Papel,
} from "@/lib/auth";
import { CATEGORIAS_BIBLIOTECA } from "@/lib/biblioteca";
import {
  medidaDisciplinarSchema,
  entregaOcupanteSchema,
  fechamentoLimpezaSchema,
  segundaFeiraDaSemana,
} from "@/lib/alojamento";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import {
  contaConsumoSchema,
  contratoImovelSchema,
  imovelSchema,
  ocupanteSchema,
  reparoSchema,
} from "@/lib/imoveis";
import {
  erroDeEscrita,
  falha,
  primeiroErro,
  type ActionResult,
} from "@/lib/acoes";

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
  //
  // Falhar aqui em silêncio é caro: o contrato novo entra como vigente e o
  // antigo continua vigente também, então o imóvel passa a somar DOIS custos
  // mensais — no indicador da lista, no relatório de custo de imóveis e na
  // projeção do fluxo de caixa. Zero linhas é legítimo (primeiro contrato do
  // imóvel), por isso aqui se checa o erro, não a contagem.
  if (dados.vigente) {
    const { error: erroVigencia } = await supabase
      .from("contrato_imovel")
      .update({ vigente: false })
      .eq("imovel_id", imovelId);
    if (erroVigencia) {
      console.error("salvarContratoImovel/vigencia", erroVigencia);
      return falha(
        "Não foi possível encerrar a vigência do contrato anterior. " +
          "Nada foi salvo — tente de novo.",
      );
    }
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
  const erro = erroDeEscrita(
    await supabase.from("contrato_imovel").delete().eq("id", id).select("id"),
    {
      registro: "contrato do imóvel",
      contexto: "excluirContratoImovel",
    },
  );
  if (erro) return { error: erro };
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
  // Trilha de auditoria: falhar aqui não desfaz o aditivo nem o reajuste que
  // acabaram de ser gravados, então não é erro para devolver ao usuário — mas
  // é o registro de POR QUE o valor mudou que deixa de existir.
  const { error } = await supabase
    .from("contrato_imovel_historico")
    .insert({ ...base, tipo, descricao, data_efeito: dataEfeito });
  if (error) console.error("logHistorico", tipo, error);
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
  // `<form action={…}>` simples: o React exige retorno `void` ali, então a
  // mensagem NÃO sobe para a tela por este caminho. O que o usuário vê é o
  // valor voltando ao anterior quando a página revalida — feedback fraco, mas
  // não silêncio: o `erroDeEscrita` deixa a causa no log do servidor.
  // Surfacear exigiria transformar a linha num componente cliente.
  erroDeEscrita(
    await supabase
      .from("conta_consumo")
      .update({ pago: novo })
      .eq("id", id)
      .select("id"),
    {
      registro: "conta de consumo",
      contexto: "alternarPagoConsumo",
      acao: "salvar",
    },
  );
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
  const erro = erroDeEscrita(
    await supabase.from("conta_consumo").delete().eq("id", id).select("id"),
    {
      registro: "conta de consumo",
      contexto: "excluirContaConsumo",
    },
  );
  if (erro) return { error: erro };
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
  if (error) {
    console.error("salvarReparo", error);
    return falha("Não foi possível salvar o reparo.");
  }

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
  const erro = erroDeEscrita(
    await supabase.from("reparo_imovel").delete().eq("id", id).select("id"),
    {
      registro: "reparo",
      contexto: "excluirReparo",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase.from("ocorrencia_imovel").delete().eq("id", id).select("id"),
    {
      registro: "registro",
      contexto: "excluirOcorrencia",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase.from("vistoria_imovel").delete().eq("id", id).select("id"),
    {
      registro: "vistoria",
      contexto: "excluirVistoriaImovel",
    },
  );
  if (erro) return { error: erro };
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
  // O arquivo já subiu para o Storage. Sem a linha no banco ele vira órfão:
  // ocupa espaço e nenhuma tela o mostra.
  const { error } = await supabase
    .from("vistoria_imovel_foto")
    .insert({ org_id: perfil.org_id, vistoria_id: vistoriaId, path });
  if (error) {
    console.error("salvarFotoVistoriaImovel", error);
    return { error: "A foto foi enviada, mas não ficou registrada na vistoria." };
  }
  revalidatePath(`/imoveis/${imovelId}`);
}

export async function salvarAnexoReparo(reparoId: string, imovelId: string, path: string) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from("reparo_imovel")
      .update({ anexo_path: path })
      .eq("id", reparoId)
      .select("id"),
    {
      registro: "anexo do reparo",
      contexto: "salvarAnexoReparo",
      acao: "salvar",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase
      .from("ocorrencia_imovel")
      .update({ anexo_path: path })
      .eq("id", ocorrenciaId)
      .select("id"),
    {
      registro: "anexo da ocorrência",
      contexto: "salvarAnexoOcorrencia",
      acao: "salvar",
    },
  );
  if (erro) return { error: erro };
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
  if (!parsed.success) {
    // A causa completa no log: a mensagem que vai ao usuário é a primeira, e
    // sozinha ela não diz QUAL campo recusou. Foi o que tornou o defeito de
    // idempotência dos schemas tão difícil de achar.
    console.error("salvarOcupante — validação", parsed.error.issues);
    return falha(primeiroErro(parsed.error.issues));
  }
  const { imovel_id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("ocupante_imovel").insert({
    org_id: perfil.org_id,
    imovel_id,
    ...campos,
  });
  if (error) {
    console.error("salvarOcupante", error);
    return falha("Não foi possível salvar o ocupante.");
  }

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
  const erro = erroDeEscrita(
    await supabase.from("ocupante_imovel").delete().eq("id", id).select("id"),
    {
      registro: "ocupante",
      contexto: "excluirOcupante",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase
      .from("contrato_imovel")
      .update({ [campo]: path })
      .eq("id", contratoId)
      .select("id"),
    {
      registro: "anexo do contrato",
      contexto: "salvarAnexoImovelContrato",
      acao: "salvar",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase.from("biblioteca_documento").delete().eq("id", id).select("id"),
    {
      registro: "documento",
      contexto: "excluirDocumentoBiblioteca",
    },
  );
  if (erro) return { error: erro };
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
  const erro = erroDeEscrita(
    await supabase
      .from("contrato_imovel")
      .update({ [campo]: null })
      .eq("id", contratoId)
      .select("id"),
    {
      registro: "anexo do contrato",
      contexto: "removerAnexoImovelContrato",
    },
  );
  if (erro) return { error: erro };
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
  if (error) {
    console.error("salvarMedidaDisciplinar", error);
    return falha("Não foi possível registrar a medida disciplinar.");
  }

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
  if (error) {
    console.error("salvarEntregaOcupante", error);
    return falha("Não foi possível registrar a entrega.");
  }

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
//
// O catálogo de tarefas mora em `configuracoes/limpeza-actions.ts`: é cadastro
// da organização, não do imóvel.
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * Fechamento da semana: quem limpou e como o Encarregado avaliou.
 *
 * Recebe `FormData` e devolve `ActionResult`: são três campos sem validação
 * cruzada, então não há react-hook-form — o formulário chama a action dentro de
 * um `useTransition` e fecha o painel com o resultado em mãos. `useActionState`
 * não serviria: fechar o painel a partir do estado exigiria um `useEffect` que
 * chama `setState`, que é justamente o que o `react-hooks/set-state-in-effect`
 * proíbe.
 *
 * Só atualiza; a linha nasce em `abrirChecklistSemana`. Abrir e avaliar são
 * momentos diferentes de propósito: a folha é impressa na segunda e conferida
 * na sexta, muitas vezes por pessoas diferentes.
 */
export async function salvarFechamentoLimpeza(
  formData: FormData,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para avaliar a semana.");
  }

  const parsed = fechamentoLimpezaSchema.safeParse({
    id: formData.get("id"),
    imovel_id: formData.get("imovel_id"),
    auxiliar_nome: formData.get("auxiliar_nome"),
    avaliacao: formData.get("avaliacao"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, imovel_id, ...campos } = parsed.data;

  const supabase = await createClient();
  // `updated_at` fica com o trigger `trg_checklist_limpeza_updated_at`
  // (migration 0045) — mandá-lo daqui só criaria uma segunda verdade.
  const { error } = await supabase
    .from("checklist_limpeza")
    .update(campos)
    .eq("id", id);
  if (error) {
    console.error("salvarFechamentoLimpeza", error);
    return falha("Não foi possível salvar a avaliação da semana.");
  }

  revalidatePath(`/imoveis/${imovel_id}`);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Aceite eletrônico do Termo de Compromisso (fase 5)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Registra o aceite eletrônico do FRM-RH-001 por um ocupante.
 *
 * As colunas `aceite_em` e `aceite_ip` existem, nulas, desde a migration 0043 —
 * criá-las junto evitou uma migration só para isto. O primitivo
 * `<Assinaturas modo="aceite">` também já existia: esta fase é troca de props,
 * não mudança de layout.
 *
 * O IP vem do cabeçalho `x-forwarded-for` da Vercel. Ele NÃO prova identidade —
 * prova que a confirmação partiu daquela sessão autenticada, naquele momento.
 * A prova de identidade continua sendo o vínculo do usuário logado. Por isso o
 * termo em papel segue valendo enquanto o Jurídico não se manifestar: este
 * registro é complemento, não substituto.
 */
export async function registrarAceiteTermo(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    throw new Error("Você não tem permissão para registrar o aceite.");
  }
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;

  const cabecalhos = await headers();
  // x-forwarded-for pode trazer uma cadeia de proxies; o primeiro é o cliente.
  const ip =
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    cabecalhos.get("x-real-ip") ||
    null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ocupante_imovel")
    .update({ aceite_em: new Date().toISOString(), aceite_ip: ip })
    .eq("id", id)
    // Não sobrescreve um aceite já dado: a data do primeiro aceite é a que
    // importa, e regravá-la apagaria a prova do momento original.
    .is("aceite_em", null);

  if (error) throw new Error("Não foi possível registrar o aceite.");
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

/** Desfaz um aceite registrado por engano. Só master. */
export async function desfazerAceiteTermo(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    throw new Error("Você não tem permissão para desfazer o aceite.");
  }
  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("ocupante_imovel")
    .update({ aceite_em: null, aceite_ip: null })
    .eq("id", id);

  if (error) throw new Error("Não foi possível desfazer o aceite.");
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// Documento assinado — o PDF de volta do papel
// ═══════════════════════════════════════════════════════════════════════════

/**
 * As três tabelas do alojamento que guardam o digitalizado, e quem pode anexá-lo.
 *
 * A coluna `documento_path` existe nas três desde as migrations 0044 e 0045, e
 * até aqui ninguém escrevia nela: o sistema gerava o PDF, alguém imprimia,
 * colhia as assinaturas — e o papel assinado voltava para a gaveta da obra. Era
 * exatamente o problema que originou este módulo, sobrevivendo na última etapa.
 *
 * A permissão espelha a de escrita de cada tabela: a medida disciplinar é
 * registro de pasta funcional e exige quem gere cadastros; entrega e checklist
 * são rotina de obra.
 */
const ENTIDADES_DOC = {
  medida_disciplinar: "cadastros",
  entrega_ocupante: "operar",
  checklist_limpeza: "operar",
} as const;

export type EntidadeDocumento = keyof typeof ENTIDADES_DOC;

function podeAnexar(entidade: EntidadeDocumento, papel: Papel | undefined) {
  return ENTIDADES_DOC[entidade] === "cadastros"
    ? podeEditarCadastros(papel)
    : podeOperar(papel);
}

/**
 * Grava o caminho do digitalizado depois que o cliente subiu o arquivo.
 *
 * O upload em si acontece no navegador, direto para o Storage — mesmo caminho
 * do `ImovelAnexoUploader`. Mandar o arquivo por server action o faria passar
 * pelo limite de corpo da action e ocupar memória da função sem necessidade.
 */
export async function salvarDocumentoAssinado(
  entidade: EntidadeDocumento,
  registroId: string,
  imovelId: string,
  path: string,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!ENTIDADES_DOC[entidade]) return falha("Registro inválido.");
  if (!perfil?.org_id || !podeAnexar(entidade, perfil.papel)) {
    return falha("Você não tem permissão para anexar este documento.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(entidade)
    .update({ documento_path: path })
    .eq("id", registroId);
  if (error) {
    console.error("salvarDocumentoAssinado", entidade, error);
    return falha("Não foi possível anexar o documento.");
  }

  revalidatePath(`/imoveis/${imovelId}`);
  return { ok: true };
}

/** Remove o digitalizado — do banco e do Storage, para não deixar órfão. */
export async function removerDocumentoAssinado(formData: FormData) {
  const perfil = await getCurrentPerfil();
  const entidade = String(formData.get("entidade") ?? "") as EntidadeDocumento;
  if (!ENTIDADES_DOC[entidade]) return;
  if (!perfil?.org_id || !podeAnexar(entidade, perfil.papel)) {
    return { error: "Você não tem permissão para remover este documento." };
  }

  const id = txt(formData.get("id"));
  const imovelId = txt(formData.get("imovel_id"));
  if (!id) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from(entidade)
    .select("documento_path")
    .eq("id", id)
    .maybeSingle();
  const path = (data as { documento_path: string | null } | null)?.documento_path;

  // Banco primeiro: se o Storage falhar, sobra um arquivo órfão que ninguém
  // alcança. Na ordem inversa, o registro apontaria para um arquivo que já não
  // existe e a tela mostraria um link quebrado.
  const { error } = await supabase
    .from(entidade)
    .update({ documento_path: null })
    .eq("id", id);
  if (error) return { error: "Não foi possível remover o documento." };
  if (path) await supabase.storage.from("imoveis").remove([path]);

  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}
