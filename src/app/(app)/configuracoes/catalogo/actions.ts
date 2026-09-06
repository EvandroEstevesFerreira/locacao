"use server";

// Cadastro de categorias, tipos e unidades de medida.
//
// São os três cadastros que decidem como um item é classificado — e o motivo de
// existirem é concreto: com a família digitada dentro da descrição, o mesmo
// modelo virou dois cadastros por um erro de digitação (Latitude / Latitute),
// com seis máquinas divididas entre eles. Uma lista fechada não deixa isso
// nascer.

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import {
  categoriaSchema,
  tipoEquipamentoSchema,
  unidadeMedidaSchema,
  salvarCamposSchema,
} from "@/lib/catalogo";

function revalidar() {
  revalidatePath("/configuracoes/catalogo");
  revalidatePath("/configuracoes/unidades");
  // O formulário do item lê os dois seletores; sem isto, um tipo recém-criado
  // não apareceria lá até a próxima navegação completa.
  revalidatePath("/itens/novo");
  revalidatePath("/itens");
}

async function guarda() {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { erro: "Sessão inválida. Entre novamente." };
  if (!podeEditarCadastros(perfil.papel)) {
    return { erro: "Você não tem permissão para editar o catálogo." };
  }
  return { orgId: perfil.org_id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Categoria
// ═══════════════════════════════════════════════════════════════════════════

export async function salvarCategoria(raw: unknown): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const parsed = categoriaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, nome } = parsed.data;

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("categoria_equipamento")
        .update({ nome })
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("categoria_equipamento")
        .insert({ org_id: g.orgId, nome })
        .select("id")
        .maybeSingle();

  if (error) {
    console.error("salvarCategoria", error);
    // `23505` só pode ser a unicidade de nome. A mensagem genérica mandaria a
    // pessoa procurar um problema que não existe.
    if ((error as { code?: string }).code === "23505") {
      return falha("Já existe uma categoria com esse nome.");
    }
    return falha("Não foi possível salvar a categoria.");
  }

  revalidar();
  return { ok: true, id: data?.id };
}

export async function excluirCategoria(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const g = await guarda();
  if (g.erro) return { error: g.erro };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();

  // Categoria com tipo dentro NÃO se exclui: o `on delete cascade` do
  // `tipo_equipamento` levaria os tipos junto, e com eles a classificação de
  // todo modelo que os referencia. É apagar em cascata algo que ninguém pediu.
  const { count } = await supabase
    .from("tipo_equipamento")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);
  if (count && count > 0) {
    return {
      error: `Esta categoria tem ${count} ${count === 1 ? "tipo" : "tipos"} dentro. Mova ou exclua os tipos antes.`,
    };
  }

  const { error } = await supabase
    .from("categoria_equipamento")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("excluirCategoria", error);
    return { error: "Não foi possível excluir a categoria." };
  }

  revalidar();
}

// ═══════════════════════════════════════════════════════════════════════════
// Tipo
// ═══════════════════════════════════════════════════════════════════════════

export async function salvarTipo(raw: unknown): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const parsed = tipoEquipamentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("tipo_equipamento")
        .update(campos)
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("tipo_equipamento")
        .insert({ org_id: g.orgId, ...campos })
        .select("id")
        .maybeSingle();

  if (error) {
    console.error("salvarTipo", error);
    if ((error as { code?: string }).code === "23505") {
      return falha("Já existe um tipo com esse nome nesta categoria.");
    }
    return falha("Não foi possível salvar o tipo.");
  }

  revalidar();
  return { ok: true, id: data?.id };
}

export async function excluirTipo(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const g = await guarda();
  if (g.erro) return { error: g.erro };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();

  // Tipo em uso não se exclui — DESATIVA-SE. A FK é `on delete set null`, então
  // excluir não quebraria nada, mas os modelos perderiam a classificação em
  // silêncio: alguém abriria a lista de itens amanhã e não entenderia por que
  // metade ficou sem tipo.
  const { count } = await supabase
    .from("item_catalogo")
    .select("id", { count: "exact", head: true })
    .eq("tipo_id", id);
  if (count && count > 0) {
    return {
      error: `${count} ${count === 1 ? "item usa" : "itens usam"} este tipo. Desative-o em vez de excluir — assim ele some do cadastro novo sem apagar a classificação do que já existe.`,
    };
  }

  const { error } = await supabase.from("tipo_equipamento").delete().eq("id", id);
  if (error) {
    console.error("excluirTipo", error);
    return { error: "Não foi possível excluir o tipo." };
  }

  revalidar();
}

// ═══════════════════════════════════════════════════════════════════════════
// Unidade de medida
// ═══════════════════════════════════════════════════════════════════════════

export async function salvarUnidade(raw: unknown): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const parsed = unidadeMedidaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, ...campos } = parsed.data;

  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("unidade_medida")
        .update(campos)
        .eq("id", id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("unidade_medida")
        .insert({ org_id: g.orgId, ...campos })
        .select("id")
        .maybeSingle();

  if (error) {
    console.error("salvarUnidade", error);
    if ((error as { code?: string }).code === "23505") {
      return falha("Já existe uma unidade com esse símbolo.");
    }
    return falha("Não foi possível salvar a unidade.");
  }

  revalidar();
  return { ok: true, id: data?.id };
}

export async function excluirUnidade(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const g = await guarda();
  if (g.erro) return { error: g.erro };
  const id = String(formData.get("id") ?? "").trim();
  const simbolo = String(formData.get("simbolo") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();

  // `item_catalogo.unidade` guarda o SÍMBOLO em texto, não uma FK — então
  // excluir a unidade não quebra o banco, mas deixa itens exibindo um símbolo
  // que já não existe na lista, e ninguém consegue reproduzi-lo ao editar.
  if (simbolo) {
    const { count } = await supabase
      .from("item_catalogo")
      .select("id", { count: "exact", head: true })
      .eq("unidade", simbolo);
    if (count && count > 0) {
      return {
        error: `${count} ${count === 1 ? "item usa" : "itens usam"} “${simbolo}”. Desative a unidade em vez de excluir.`,
      };
    }
  }

  const { error } = await supabase.from("unidade_medida").delete().eq("id", id);
  if (error) {
    console.error("excluirUnidade", error);
    return { error: "Não foi possível excluir a unidade." };
  }

  revalidar();
}

// ═══════════════════════════════════════════════════════════════════════════
// Os campos da ficha de um tipo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Grava a lista inteira de campos, e não um campo por vez.
 *
 * A ordem faz parte da definição — e a ordem dos campos na ficha da peça é a
 * ordem em que a pessoa preenche. Salvar campo a campo exigiria uma coluna de
 * ordem e uma ação de reordenar; o array já carrega as duas coisas.
 */
export async function salvarCamposDoTipo(raw: unknown): Promise<ActionResult> {
  const g = await guarda();
  if (g.erro) return falha(g.erro);

  const parsed = salvarCamposSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { tipo_id, campos } = parsed.data;

  const supabase = await createClient();

  // Quais chaves SUMIRAM em relação ao que estava gravado. Não impede o
  // salvamento — tirar campo é uma decisão legítima —, mas quem tira precisa
  // saber que as peças já preenchidas guardam aquele valor e ele deixa de
  // aparecer em qualquer tela.
  const { data: antes } = await supabase
    .from("tipo_equipamento")
    .select("campos_ficha")
    .eq("id", tipo_id)
    .maybeSingle();

  const chavesAntes: string[] = Array.isArray(antes?.campos_ficha)
    ? (antes.campos_ficha as { chave?: string }[])
        .map((c) => c.chave)
        .filter((c): c is string => Boolean(c))
    : [];
  const agora = new Set(campos.map((c) => c.chave));
  const removidas = chavesAntes.filter((c) => !agora.has(c));

  const { error } = await supabase
    .from("tipo_equipamento")
    .update({ campos_ficha: campos })
    .eq("id", tipo_id);

  if (error) {
    console.error("salvarCamposDoTipo", error);
    return falha("Não foi possível salvar os campos.");
  }

  revalidar();
  return {
    ok: true,
    id: tipo_id,
    aviso:
      removidas.length > 0
        ? `Campos salvos. ${removidas.length === 1 ? "O campo" : "Os campos"} ${removidas.join(", ")} ${removidas.length === 1 ? "saiu" : "saíram"} da ficha — o valor continua gravado nas peças, mas deixa de aparecer.`
        : undefined,
  };
}
