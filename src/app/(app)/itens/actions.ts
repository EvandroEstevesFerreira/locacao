"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { itemSchema } from "@/lib/itens";
import {
  unidadeSchema,
  podeTransicionar,
  motivoBloqueio,
  type Situacao,
} from "@/lib/frota";

/**
 * Salva item do catálogo.
 *
 * Devolve o `id` no sucesso porque o cliente precisa dele: ao criar um
 * EQUIPAMENTO, a navegação é para a tela de edição, onde se cadastram as
 * unidades. Antes isso era um `redirect()` condicional aqui dentro; agora quem
 * decide o destino é o formulário, que tem o `id` de volta.
 */
export async function salvarItem(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar itens.");
  }

  const parsed = itemSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const { id, ...dados } = parsed.data;

  const supabase = await createClient();
  let itemId = id ?? null;
  if (id) {
    const { error } = await supabase.from("item_catalogo").update(dados).eq("id", id);
    if (error) return falha("Não foi possível salvar. Tente novamente.");
  } else {
    const { data, error } = await supabase
      .from("item_catalogo")
      .insert({ org_id: perfil.org_id, ...dados })
      .select("id")
      .single();
    if (error || !data) return falha("Não foi possível salvar. Tente novamente.");
    itemId = data.id;
  }

  revalidatePath("/itens");
  return { ok: true, id: itemId ?? undefined };
}

export async function excluirItem(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir itens do catálogo." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();

  // O erro do DELETE tem de voltar para a tela, e o `.select("id")` é o que
  // transforma "não apagou nada" em erro: DELETE de ZERO linhas não é erro para
  // o PostgREST, então uma policy que filtra a linha devolve `error: null` com
  // nada apagado. Sem as duas coisas, o diálogo fechava como se tivesse
  // excluído e o item continuava na lista, sem uma palavra de explicação.
  //
  // `item_catalogo` não tem `soft_delete` de propósito — é catálogo, não
  // documento —, então item já usado é recusado pela chave estrangeira, e o
  // caminho certo para ele é ficar inativo.
  const { data, error } = await supabase
    .from("item_catalogo")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    console.error("excluirItem", error);
    if (error.code === "23503") {
      return {
        error:
          "Este item já foi usado: há peça, contrato ou movimento apontando para ele. " +
          "Abra o item e desmarque “Item ativo” para tirá-lo das próximas escolhas sem apagar o histórico.",
      };
    }
    return { error: "Não foi possível excluir o item. Tente novamente." };
  }
  if (!data?.length) {
    return { error: "O item não foi excluído. Confira se você tem permissão para isso." };
  }

  revalidatePath("/itens");
}


export type UnidadeFormState = { error?: string };

export async function adicionarUnidade(
  _prev: UnidadeFormState,
  formData: FormData,
): Promise<UnidadeFormState> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { error: "Sessão inválida." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { error: "Sem permissão." };
  }

  const parsed = unidadeSchema.safeParse({
    item_id: formData.get("item_id"),
    identificador: formData.get("identificador"),
    numero_serie: formData.get("numero_serie") ?? undefined,
    propriedade: formData.get("propriedade") ?? undefined,
    situacao: formData.get("situacao") ?? undefined,
    obra_id: formData.get("obra_id") ?? undefined,
    ano: formData.get("ano") ?? undefined,
    estado: formData.get("estado") ?? undefined,
    observacoes: formData.get("observacoes") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Peça nova nasce em `disponivel`. Chegar cadastrando já "em uso" seria
  // registrar posse sem ninguém ter assinado por ela — a matriz de
  // `src/lib/frota.ts` é a fonte única dessa regra.
  if (!podeTransicionar("disponivel", parsed.data.situacao as Situacao, "manual")) {
    return {
      error:
        motivoBloqueio("disponivel", parsed.data.situacao as Situacao) ??
        "Situação inválida para uma peça nova.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("equipamento_unidade").insert({
    org_id: perfil.org_id,
    item_id: parsed.data.item_id,
    identificador: parsed.data.identificador,
    numero_serie: parsed.data.numero_serie,
    propriedade: parsed.data.propriedade,
    situacao: parsed.data.situacao,
    obra_id: parsed.data.obra_id,
    ano: parsed.data.ano,
    estado: parsed.data.estado,
    observacoes: parsed.data.observacoes,
  });
  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma unidade com esse identificador." };
    }
    return { error: "Não foi possível adicionar. Tente novamente." };
  }

  revalidatePath(`/itens/${parsed.data.item_id}`);
  return {};
}

/**
 * Exclui a peça — só enquanto ela não tem história.
 *
 * `custodia_peca.unidade_id` é `on delete cascade` (0059) e a guarda de
 * imutabilidade do livro levanta exceção em `DELETE`: o CASCADE dispara a
 * trigger BEFORE DELETE do filho e ABORTA o delete do pai. Provado em Postgres
 * local. Sem a contagem abaixo, o botão excluir não fazia nada e não falava
 * nada — a página revalidava e a peça continuava lá.
 *
 * A contagem é a mensagem, não a proteção: quem protege é o banco. Aqui a
 * recusa vira frase que diz o que fazer em vez de erro cru de Postgres.
 */
export async function excluirUnidade(formData: FormData) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return { error: "Você não tem permissão para excluir unidades." };
  }
  const id = (formData.get("id") as string | null)?.trim();
  const itemId = (formData.get("item_id") as string | null)?.trim();
  if (!id) return;
  const supabase = await createClient();

  const { data: posses, error: erroPosses } = await supabase
    .from("custodia_peca")
    .select("id")
    .eq("unidade_id", id)
    .limit(1);
  if (erroPosses) {
    console.error("excluirUnidade/custodia", erroPosses);
    return { error: "Não foi possível verificar o histórico da peça. Tente de novo." };
  }
  if (posses?.length) {
    return {
      error:
        "Esta peça tem histórico de custódia, e histórico não se apaga. Para " +
        "tirá-la de uso, abra a peça na Frota e use Baixar — assim o registro " +
        "de quem ficou com ela continua existindo.",
    };
  }

  const { error } = await supabase.from("equipamento_unidade").delete().eq("id", id);
  if (error) {
    console.error("excluirUnidade", error);
    return { error: "Não foi possível excluir esta peça." };
  }
  if (itemId) revalidatePath(`/itens/${itemId}`);
}
