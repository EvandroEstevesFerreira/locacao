"use server";

// Catálogo de tarefas de limpeza — a configuração por trás do FRM-RH-005.
//
// Mora em Configurações, e não no imóvel, porque a policy `tarefa_limpeza_write`
// (migration 0045) o trata como cadastro da organização: mudar uma tarefa muda a
// folha de TODOS os alojamentos. Editá-lo de dentro de um imóvel daria a
// impressão contrária.
//
// A semeadura veio de `imoveis/actions.ts` junto com a tela: manter a criação
// num lugar e a edição em outro era convidar as duas a divergirem.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { tarefaLimpezaSchema } from "@/lib/alojamento";
import { TAREFAS } from "@/lib/documentos/frm-rh-005";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";

/** Revalida as duas telas que leem o catálogo. */
function revalidarCatalogo(imovelId?: string | null) {
  revalidatePath("/configuracoes/limpeza");
  if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
}

/**
 * Semeia o catálogo da organização a partir do embutido no código.
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
  const imovelId = String(formData.get("imovel_id") ?? "").trim() || null;

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
    // A ordem é a do array e não a alfabética: é a sequência em que o auxiliar
    // percorre o alojamento, e a folha impressa a reproduz.
    ordem: i,
  }));
  const { error } = await supabase.from("tarefa_limpeza").insert(linhas);
  if (error) throw new Error("Não foi possível criar o catálogo de tarefas.");

  revalidarCatalogo(imovelId);
}

/**
 * Cria ou edita uma tarefa. Sem `id`, cria; com `id`, atualiza.
 *
 * A tarefa nova entra no fim do grupo quando a ordem não é informada: a folha é
 * lida de cima para baixo enquanto se anda pelo alojamento, e jogar um item novo
 * no meio da sequência quebraria o percurso de quem limpa.
 */
export async function salvarTarefaLimpeza(
  formData: FormData,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar o catálogo.");
  }

  const parsed = tarefaLimpezaSchema.safeParse({
    id: formData.get("id"),
    grupo: formData.get("grupo"),
    descricao: formData.get("descricao"),
    frequencia: formData.get("frequencia"),
    ordem: formData.get("ordem"),
  });
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const supabase = await createClient();

  if (id) {
    const { error } = await supabase
      .from("tarefa_limpeza")
      .update(campos)
      .eq("id", id);
    if (error) {
      console.error("salvarTarefaLimpeza(update)", error);
      return falha("Não foi possível salvar a tarefa.");
    }
  } else {
    let ordem = campos.ordem;
    if (ordem === 0) {
      // Sem ordem informada, entra no fim do grupo — não no fim da folha, que
      // deixaria uma tarefa de banheiro depois das áreas externas.
      const { data } = await supabase
        .from("tarefa_limpeza")
        .select("ordem")
        .eq("grupo", campos.grupo)
        .order("ordem", { ascending: false })
        .limit(1);
      ordem = (data?.[0]?.ordem ?? 0) + 1;
    }
    const { error } = await supabase
      .from("tarefa_limpeza")
      .insert({ org_id: perfil.org_id, ...campos, ordem });
    if (error) {
      console.error("salvarTarefaLimpeza(insert)", error);
      return falha("Não foi possível criar a tarefa.");
    }
  }

  revalidarCatalogo();
  return { ok: true };
}

/**
 * Liga e desliga uma tarefa sem apagá-la.
 *
 * É o caminho normal: um alojamento sem máquina de lavar não precisa da tarefa
 * do tanque, mas apagá-la faria a folha das outras obras perder o item. Desligar
 * tira do papel e mantém o histórico das semanas que já a marcaram.
 */
export async function alternarTarefaLimpeza(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    throw new Error("Sem permissão para editar o catálogo.");
  }
  const id = String(formData.get("id") ?? "").trim();
  const ativo = String(formData.get("ativo") ?? "") === "true";
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tarefa_limpeza")
    .update({ ativo })
    .eq("id", id);
  if (error) throw new Error("Não foi possível alterar a tarefa.");

  revalidarCatalogo();
}

export async function excluirTarefaLimpeza(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  // Sempre pelo RPC: a policy de SELECT esconde linhas com `deleted_at`, e o
  // Postgres a aplica também à linha NOVA de um UPDATE — um
  // `.update({ deleted_at })` abortaria o próprio comando (incidente da 0.19.4).
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "tarefa_limpeza",
    p_id: id,
  });
  if (error || data !== true) {
    return { error: "Não foi possível excluir a tarefa." };
  }

  revalidarCatalogo();
}
