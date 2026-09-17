"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { obraSchema } from "@/lib/obra";
import { paiPermitido } from "@/lib/centro-custo";

export async function salvarObra(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar centros de custo.");
  }

  const parsed = obraSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();

  // O pai é conferido CONTRA O BANCO, e não só contra o que o formulário
  // mandou: o schema não sabe se o candidato é departamento nem se ele já tem
  // pai. A trava de verdade é o trigger da 0114 — esta checagem existe para o
  // usuário receber a frase em vez do erro cru do Postgres.
  if (dados.pai_id) {
    const { data: pai } = await supabase
      .from("obra")
      .select("id, nome, tipo, pai_id")
      .eq("id", dados.pai_id)
      .maybeSingle();

    if (!pai) return falha("O centro de custo pai não foi encontrado.");

    const r = paiPermitido({ id: id ?? "", tipo: dados.tipo }, pai);
    if (!r.ok) return falha(r.motivo);
  }

  // `tipo` é imutável: o trigger da 0114 recusa a troca, e mandá-lo no update
  // faria toda edição de centro de custo falhar com erro cru quando o valor
  // viesse diferente por qualquer motivo. Na edição ele simplesmente não vai.
  const dadosEdicao = { ...dados, tipo: undefined };
  delete dadosEdicao.tipo;
  const { error } = id
    ? await supabase.from("obra").update(dadosEdicao).eq("id", id)
    : await supabase.from("obra").insert({ org_id: perfil.org_id, ...dados });

  if (error) {
    if (error.code === "23505") {
      return falha("Já existe um centro de custo com esse código.");
    }
    // As travas da 0114 chegam como `raise exception` (P0001) com a frase já
    // pronta e voltada ao usuário — repassá-la é melhor que "tente novamente",
    // que não diria ao usuário qual regra ele esbarrou.
    if (error.code === "P0001") return falha(error.message);
    return falha("Não foi possível salvar. Tente novamente.");
  }

  // Fica como está: `revalidatePath` invalida o cache do servidor para a rota
  // inteira. O `router.refresh()` do cliente só re-busca a rota atual, então
  // sem isto a listagem ficaria com dado velho.
  revalidatePath("/obras");
  return { ok: true, id: id ?? undefined };
}

/**
 * Exclusão continua recebendo FormData: é chamada pelo ConfirmDelete, que monta
 * um FormData, e não por um formulário RHF. Manter a assinatura evita mexer nos
 * 18 call sites do ConfirmDelete.
 */
export async function excluirObra(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir centros de custo." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return { error: "Centro de custo inválido." };

  const supabase = await createClient();
  // Soft-delete pela função `soft_delete` (migration 0041): a policy de SELECT
  // esconde linhas com deleted_at, o que faz o RLS recusar um UPDATE direto.
  // `soft_delete` devolve true/false — `data !== true` também é falha.
  const { data, error } = await supabase.rpc("soft_delete", {
    p_entidade: "obra",
    p_id: id,
  });
  if (error || data !== true) {
    // `on delete restrict` em `pai_id`: excluir um departamento que tem setores
    // pendurados FALHA de propósito, em vez de arrastar os quatro junto.
    return {
      error:
        "Não foi possível excluir. Se for um departamento com setores, " +
        "exclua ou realoque os setores primeiro.",
    };
  }
  revalidatePath("/obras");
}
