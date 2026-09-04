"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeOperar,
  podeExcluirCritico,
} from "@/lib/auth";
import {
  erroDeEscrita,
  falha,
  primeiroErro,
  type ActionResult,
} from "@/lib/acoes";
import { contratoSchema, itemLocadoSchema } from "@/lib/locacao";


export async function salvarContrato(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar contratos.");
  }

  const parsed = contratoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  let contratoId = id ?? null;
  if (id) {
    const { error } = await supabase
      .from("contrato_locacao")
      .update(dados)
      .eq("id", id);
    if (error) return falha("Não foi possível salvar. Tente novamente.");
  } else {
    const { data, error } = await supabase
      .from("contrato_locacao")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return falha("Não foi possível salvar. Tente novamente.");
    contratoId = data.id;
  }

  revalidatePath("/contratos");
  // Devolve o id: o cliente navega para o detalhe, onde se adicionam os itens.
  return { ok: true, id: contratoId ?? undefined };
}

export async function excluirContrato(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeExcluirCritico(perfil.papel)) {
    return { error: "Somente o Master pode excluir contratos." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Contrato inválido." };
  const supabase = await createClient();
  // Soft-delete pela função `soft_delete` (migration 0041): a policy de SELECT
  // esconde linhas com deleted_at, o que faz o RLS recusar um UPDATE direto.
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "contrato_locacao",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir o contrato. Tente novamente." };
  }
  revalidatePath("/contratos");
}

export async function adicionarItemLocado(
  raw: unknown,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para adicionar itens.");
  }

  const parsed = itemLocadoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase.from("item_locado").insert({
    org_id: perfil.org_id,
    ...parsed.data,
  });
  if (error) return falha("Não foi possível adicionar o item.");

  revalidatePath(`/contratos/${parsed.data.contrato_id}`);
  return { ok: true };
}

export async function excluirItemLocado(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para excluir itens do contrato." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase.from("item_locado").delete().eq("id", id).select("id"),
    {
      registro: "item do contrato",
      contexto: "excluirItemLocado",
    },
  );
  if (erro) return { error: erro };
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
  if (!podeOperar(perfil.papel)) {
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
  //
  // A devolução já foi gravada acima, então falhar AQUI não invalida o que
  // aconteceu — mas deixa o item eternamente "em uso" com saldo zero, e é o
  // custo estimado dele que continua correndo. O usuário precisa saber.
  if (jaDevolvido + parsed.data.quantidade >= Number(item.quantidade)) {
    const erroStatus = erroDeEscrita(
      await supabase
        .from("item_locado")
        .update({ status: "devolvido", data_devolucao: parsed.data.data })
        .eq("id", parsed.data.item_locado_id)
        .select("id"),
      {
        registro: "item do contrato",
        contexto: "registrarDevolucao/status",
        acao: "salvar",
      },
    );
    if (erroStatus) {
      return {
        error:
          "A devolução foi registrada, mas o item não ficou marcado como " +
          "devolvido — ele continua acumulando custo. Avise um administrador.",
      };
    }
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
  if (!podeOperar(perfil.papel)) return;

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
      // Sem esta amarração, o contrato continua "sem vistoria de retirada" e o
      // próximo clique cria OUTRA vistoria — uma por clique, todas vazias. A
      // action redireciona, então não há retorno para o usuário: resta o log.
      const { error: erroAmarrar } = await supabase
        .from("contrato_locacao")
        .update({ vistoria_retirada_id: vistoriaId })
        .eq("id", contratoId);
      if (erroAmarrar) {
        console.error("abrirVistoriaRetirada/amarrar", erroAmarrar);
      }
    }
  }

  revalidatePath(`/contratos/${contratoId}`);
  if (vistoriaId) redirect(`/vistorias/${vistoriaId}`);
}

// ---------------------------------------------------------------------------
// Anexo do contrato original (arquivo no Storage, bucket "contratos").
// ---------------------------------------------------------------------------
export async function salvarAnexoContrato(contratoId: string, path: string) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  if (!contratoId || !path) return;
  const supabase = await createClient();
  const erro = erroDeEscrita(
    await supabase
      .from("contrato_locacao")
      .update({ anexo_path: path })
      .eq("id", contratoId)
      .select("id"),
    {
      registro: "anexo do contrato",
      contexto: "salvarAnexoContrato",
      acao: "salvar",
    },
  );
  // O arquivo JÁ subiu para o Storage neste ponto. Se o caminho não foi
  // gravado no contrato, o anexo existe e ninguém o encontra — dizer isso é
  // melhor que deixar o uploader anunciar sucesso.
  if (erro) return { error: erro };
  revalidatePath(`/contratos/${contratoId}`);
}

export async function removerAnexoContrato(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para remover anexos do contrato." };
  }
  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  const path = (formData.get("path") as string | null)?.trim();
  if (!contratoId) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("contratos").remove([path]);
  const erro = erroDeEscrita(
    await supabase
      .from("contrato_locacao")
      .update({ anexo_path: null })
      .eq("id", contratoId)
      .select("id"),
    { registro: "anexo do contrato", contexto: "removerAnexoContrato" },
  );
  if (erro) return { error: erro };
  revalidatePath(`/contratos/${contratoId}`);
}

// ---------------------------------------------------------------------------
// Documentos adicionais do contrato: aditivos e renovações (bucket "contratos").
// ---------------------------------------------------------------------------
const TIPOS_DOC = ["aditivo", "renovacao", "outro"];

export async function salvarContratoDoc(
  contratoId: string,
  path: string,
  tipo: string,
  descricao: string | null,
  data: string | null,
) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) return;
  if (!contratoId || !path) return;
  const supabase = await createClient();
  await supabase.from("contrato_anexo").insert({
    org_id: perfil.org_id,
    contrato_id: contratoId,
    tipo: TIPOS_DOC.includes(tipo) ? tipo : "outro",
    descricao: descricao?.trim() || null,
    path,
    data: data || null,
  });
  revalidatePath(`/contratos/${contratoId}`);
}

export async function removerContratoDoc(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para remover documentos do contrato." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const contratoId = (formData.get("contrato_id") as string | null)?.trim();
  const path = (formData.get("path") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();
  if (path) await supabase.storage.from("contratos").remove([path]);
  const erro = erroDeEscrita(
    await supabase.from("contrato_anexo").delete().eq("id", id).select("id"),
    {
      registro: "documento",
      contexto: "removerContratoDoc",
    },
  );
  if (erro) return { error: erro };
  if (contratoId) revalidatePath(`/contratos/${contratoId}`);
}
