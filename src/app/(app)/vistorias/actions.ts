"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeGerenciarFinanceiro } from "@/lib/auth";
import { hojeSaoPaulo } from "@/lib/locacao";
import { erroDeEscrita } from "@/lib/acoes";

export type VistoriaFormState = { error?: string; ok?: boolean };

const vistoriaSchema = z.object({
  contrato_id: z.string().uuid("Selecione o contrato."),
  tipo: z.enum(["entrada", "devolucao"]),
  data: z.string().min(1, "Informe a data."),
  responsavel: z.string().trim().max(200).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

function nuloSeVazio(v: string | undefined) {
  const t = (v ?? "").trim();
  return t === "" ? null : t;
}

export async function salvarVistoria(
  _prev: VistoriaFormState,
  formData: FormData,
): Promise<VistoriaFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const parsed = vistoriaSchema.safeParse({
    contrato_id: formData.get("contrato_id"),
    tipo: formData.get("tipo"),
    data: formData.get("data"),
    responsavel: formData.get("responsavel") ?? undefined,
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const id = (formData.get("id") as string | null)?.trim() || null;
  const dados = {
    contrato_id: parsed.data.contrato_id,
    tipo: parsed.data.tipo,
    data: parsed.data.data,
    responsavel: nuloSeVazio(parsed.data.responsavel),
    observacoes: nuloSeVazio(parsed.data.observacoes),
  };

  const supabase = await createClient();
  let vistoriaId = id;
  if (id) {
    const { error } = await supabase.from("vistoria").update(dados).eq("id", id);
    if (error) return { error: "Não foi possível salvar." };
  } else {
    const { data, error } = await supabase
      .from("vistoria")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return { error: "Não foi possível salvar." };
    vistoriaId = data.id;
  }

  revalidatePath("/vistorias");
  redirect(`/vistorias/${vistoriaId}`);
}

export async function excluirVistoria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir vistorias." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  // Remove as fotos do storage antes de apagar a vistoria.
  const { data: fotos } = await supabase
    .from("vistoria_foto")
    .select("path")
    .eq("vistoria_id", id);
  if (fotos?.length) {
    await supabase.storage.from("vistorias").remove(fotos.map((f) => f.path));
  }
  const erro = erroDeEscrita(
    await supabase.from("vistoria").delete().eq("id", id).select("id"),
    {
      registro: "vistoria",
      contexto: "excluirVistoria",
    },
  );
  if (erro) return { error: erro };
  revalidatePath("/vistorias");
  redirect("/vistorias");
}

/** Registra no banco uma foto já enviada ao storage pelo cliente. */
export async function registrarFoto(vistoriaId: string, path: string) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const supabase = await createClient();
  // O arquivo já subiu para o Storage. Sem a linha no banco ele vira órfão —
  // e a vistoria fica sem a prova que alguém acabou de tirar.
  const { error } = await supabase
    .from("vistoria_foto")
    .insert({ org_id: perfil.org_id, vistoria_id: vistoriaId, path });
  if (error) {
    console.error("registrarFoto", error);
    return { error: "A foto foi enviada, mas não ficou registrada na vistoria." };
  }
  revalidatePath(`/vistorias/${vistoriaId}`);
}

export async function excluirFoto(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir fotos." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const path = (formData.get("path") as string | null)?.trim();
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id || !path) return;
  const supabase = await createClient();
  await supabase.storage.from("vistorias").remove([path]);
  const erro = erroDeEscrita(
    await supabase.from("vistoria_foto").delete().eq("id", id).select("id"),
    {
      registro: "foto",
      contexto: "excluirFoto",
    },
  );
  if (erro) return { error: erro };
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

const avariaSchema = z.object({
  vistoria_id: z.string().uuid(),
  descricao: z.string().trim().min(1, "Descreva a avaria.").max(300),
  custo_estimado: z.coerce.number().min(0).default(0),
});

export type AvariaFormState = { error?: string };

export async function adicionarAvaria(
  _prev: AvariaFormState,
  formData: FormData,
): Promise<AvariaFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const parsed = avariaSchema.safeParse({
    vistoria_id: formData.get("vistoria_id"),
    descricao: formData.get("descricao"),
    custo_estimado: formData.get("custo_estimado") ?? 0,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("avaria").insert({
    org_id: perfil.org_id,
    vistoria_id: parsed.data.vistoria_id,
    descricao: parsed.data.descricao,
    custo_estimado: parsed.data.custo_estimado,
  });
  if (error) return { error: "Não foi possível adicionar a avaria." };
  revalidatePath(`/vistorias/${parsed.data.vistoria_id}`);
  return {};
}

export async function atualizarStatusAvaria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  const id = (formData.get("id") as string | null)?.trim();
  const status = formData.get("status") as string | null;
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id || !["aberta", "cobrada", "resolvida"].includes(status ?? "")) return;
  const supabase = await createClient();
  // `<form action={…}>` simples: o React exige retorno `void` ali, então a
  // mensagem NÃO sobe para a tela por este caminho. O que o usuário vê é o
  // valor voltando ao anterior quando a página revalida — feedback fraco, mas
  // não silêncio: o `erroDeEscrita` deixa a causa no log do servidor.
  // Surfacear exigiria transformar a linha num componente cliente.
  erroDeEscrita(
    await supabase.from("avaria").update({ status }).eq("id", id).select("id"),
    {
      registro: "avaria",
      contexto: "atualizarStatusAvaria",
      acao: "salvar",
    },
  );
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

/**
 * Gera uma conta a pagar (lançamento financeiro) a partir de uma avaria e a
 * marca como "cobrada". Idempotente: não duplica se já houver lançamento.
 */
export async function gerarLancamentoAvaria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;
  // Criar lançamento exige permissão financeira (alinha com a RLS de inserção).
  if (!podeGerenciarFinanceiro(perfil.papel)) return;

  const id = (formData.get("id") as string | null)?.trim();
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id) return;

  const supabase = await createClient();
  const { data: avaria } = await supabase
    .from("avaria")
    .select("id, descricao, custo_estimado, lancamento_id, vistoria:vistoria_id(contrato:contrato_id(obra_id, numero))")
    .eq("id", id)
    .single();
  if (!avaria || avaria.lancamento_id) {
    if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
    return;
  }

  const vist = avaria.vistoria as unknown as { contrato: { obra_id: string; numero: string } | null } | null;
  const obraId = vist?.contrato?.obra_id;
  const custo = Number(avaria.custo_estimado);
  if (!obraId || !(custo > 0)) {
    if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
    return;
  }

  const hoje = hojeSaoPaulo();
  const competencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  const venc = new Date(hoje);
  venc.setDate(venc.getDate() + 30);
  const vencISO = `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`;

  const { data: lanc, error } = await supabase
    .from("lancamento_financeiro")
    .insert({
      org_id: perfil.org_id,
      obra_id: obraId,
      descricao: `Avaria (contrato ${vist?.contrato?.numero ?? "—"}): ${avaria.descricao}`.slice(0, 200),
      competencia,
      valor: custo,
      vencimento: vencISO,
      status: "pendente",
      origem: "avaria",
    })
    .select("id")
    .single();
  if (error || !lanc) return;

  // O lançamento financeiro JÁ foi criado. Se a avaria não ficar marcada como
  // cobrada, ela continua oferecendo o botão "Gerar cobrança" — e o segundo
  // clique cria uma SEGUNDA conta a pagar para o mesmo dano. A idempotência
  // desta ação depende inteiramente desta escrita.
  const erroMarcar = erroDeEscrita(
    await supabase
      .from("avaria")
      .update({ status: "cobrada", lancamento_id: lanc.id })
      .eq("id", id)
      .select("id"),
    {
      registro: "avaria",
      contexto: "gerarLancamentoAvaria/marcar",
      acao: "salvar",
    },
  );
  if (erroMarcar) {
    // `<form action={…}>`: não há canal de retorno. O que se pode fazer é não
    // deixar o rastro sumir do log — e a tela continua mostrando a avaria como
    // não cobrada, que é a verdade do banco.
    console.error("gerarLancamentoAvaria: lançamento", lanc.id, "criado sem marcar a avaria", id);
  }

  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
  revalidatePath("/financeiro");
}

export async function excluirAvaria(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir avarias." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const vistoriaId = (formData.get("vistoria_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase.from("avaria").delete().eq("id", id).select("id"),
    {
      registro: "avaria",
      contexto: "excluirAvaria",
    },
  );
  if (erro) return { error: erro };
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

/** Salva/atualiza a legenda de uma foto da vistoria. */
export async function salvarLegendaFoto(
  fotoId: string,
  vistoriaId: string,
  legenda: string,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  if (!fotoId) return;
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from("vistoria_foto")
      .update({ legenda: legenda.trim() || null })
      .eq("id", fotoId)
      .select("id"),
    { registro: "legenda", contexto: "salvarLegendaFoto", acao: "salvar" },
  );
  if (erro) return { error: erro };
  if (vistoriaId) revalidatePath(`/vistorias/${vistoriaId}`);
}

// ---------------------------------------------------------------------------
// Observações + assinaturas (representante da empresa e quem retira).
// Assinatura = nome (sempre) + imagem desenhada opcional (data URI PNG).
// ---------------------------------------------------------------------------
function assinaturaValida(img: string) {
  return img === "" || img.startsWith("data:image/");
}

export async function salvarRelatorioVistoria(
  _prev: VistoriaFormState,
  formData: FormData,
): Promise<VistoriaFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeOperar(perfil.papel)) return { error: "Sem permissão." };

  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Vistoria inválida." };

  const empresaImg = String(formData.get("assinatura_empresa_img") ?? "").trim();
  const retiranteImg = String(formData.get("assinatura_retirante_img") ?? "").trim();
  if (!assinaturaValida(empresaImg) || !assinaturaValida(retiranteImg)) {
    return { error: "Assinatura inválida." };
  }

  const supabase = await createClient();

  // Carimba a data/hora de cada assinatura: agora quando ela surge ou muda;
  // mantém a anterior se não mudou; limpa quando a assinatura é removida.
  const { data: atual } = await supabase
    .from("vistoria")
    .select(
      "assinatura_empresa_img, assinatura_empresa_em, assinatura_retirante_img, assinatura_retirante_em",
    )
    .eq("id", id)
    .single();
  const agora = new Date().toISOString();
  const carimbo = (
    novoImg: string,
    imgAntigo: string | null,
    emAntigo: string | null,
  ) => (novoImg ? (novoImg === imgAntigo ? (emAntigo ?? agora) : agora) : null);

  const { error } = await supabase
    .from("vistoria")
    .update({
      observacoes: nuloSeVazio(String(formData.get("observacoes") ?? "")),
      assinatura_empresa_nome: nuloSeVazio(
        String(formData.get("assinatura_empresa_nome") ?? ""),
      ),
      assinatura_empresa_img: empresaImg || null,
      assinatura_empresa_em: carimbo(
        empresaImg,
        (atual?.assinatura_empresa_img as string | null) ?? null,
        (atual?.assinatura_empresa_em as string | null) ?? null,
      ),
      assinatura_retirante_nome: nuloSeVazio(
        String(formData.get("assinatura_retirante_nome") ?? ""),
      ),
      assinatura_retirante_img: retiranteImg || null,
      assinatura_retirante_em: carimbo(
        retiranteImg,
        (atual?.assinatura_retirante_img as string | null) ?? null,
        (atual?.assinatura_retirante_em as string | null) ?? null,
      ),
    })
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };

  revalidatePath(`/vistorias/${id}`);
  return { ok: true };
}
