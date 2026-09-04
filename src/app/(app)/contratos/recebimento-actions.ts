"use server";

// Recebimento de equipamento — rascunho e fechamento.
//
// O rascunho é registro interno: nada sai do sistema. O FECHAMENTO é o passo
// irreversível — atribui o número, carimba a retirada nos itens do contrato,
// gera o romaneio e avisa o fornecedor por e-mail. É a primeira vez que o Loca
// comunica um terceiro a partir de uma ação de usuário, e é por isso que o
// caminho tem confirmação explícita e não pode ser desfeito por quem opera.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { ehDataISO } from "@/lib/locacao";
import {
  recebimentoSchema,
  recebimentoItemSchema,
} from "@/lib/recebimento";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { fecharRecebimentoSchema } from "@/lib/recebimento";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { recebimentoFornecedor } from "@/lib/emails/templates";
import {
  montarContexto,
  SELECT_ORGANIZACAO_EMAIL,
  type LinhaOrganizacaoEmail,
} from "@/lib/emails/contexto";
import { buscarRecebimento } from "@/lib/data/recebimentos";
import { gerarRomaneioPdf } from "@/lib/documentos/romaneio-render";

/** Revalida as duas telas que mostram recebimentos. */
function revalidar(contratoId: string, recebimentoId?: string) {
  revalidatePath(`/contratos/${contratoId}`);
  if (recebimentoId) revalidatePath(`/recebimentos/${recebimentoId}`);
}

/**
 * Cria o rascunho e leva direto à conferência.
 *
 * REDIRECIONA, e por isso não devolve `ActionResult`: um `redirect()` lança
 * `NEXT_REDIRECT` e tudo depois do `await` no cliente seria código morto
 * (regra do AGENTS.md). Quem chama é um `<form action>` simples.
 *
 * Existe separado de `salvarRecebimento` porque o caminho normal é um clique
 * só: o conferente está com o caminhão parado no portão e não quer preencher
 * cabeçalho antes de listar o que chegou. Data e conferente ficam editáveis na
 * própria tela de conferência.
 */
export async function criarRascunhoRecebimento(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    throw new Error("Você não tem permissão para registrar recebimentos.");
  }
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  const recebidoEm = String(formData.get("recebido_em") ?? "").trim();
  // `ehDataISO` e não um regex aqui: a cópia inline deste guarda foi escrita
  // sem as contrabarras (`/^d{4}-d{2}-d{2}$/`), recusou toda data válida, e o
  // botão "Registrar recebimento" não criava nada — sem erro nenhum na tela.
  if (!contratoId || !ehDataISO(recebidoEm)) {
    throw new Error("Data de recebimento inválida.");
  }

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("fornecedor_id")
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato) throw new Error("Contrato não encontrado.");

  const { data, error } = await supabase
    .from("recebimento")
    .insert({
      org_id: perfil.org_id,
      contrato_id: contratoId,
      fornecedor_id: contrato.fornecedor_id,
      recebido_em: recebidoEm,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("criarRascunhoRecebimento", error);
    throw new Error("Não foi possível criar o recebimento.");
  }

  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/recebimentos/${data.id}`);
}

/**
 * Cria ou edita o cabeçalho do rascunho.
 *
 * O `fornecedor_id` NÃO vem do formulário: é lido do contrato. Deixá-lo na mão
 * do cliente permitiria gravar um recebimento apontando para um fornecedor que
 * não é o do contrato — e é esse fornecedor que receberá o aviso na fase 1b.
 */
export async function salvarRecebimento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar recebimentos.");
  }

  const parsed = recebimentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, contrato_id, ...campos } = parsed.data;

  const supabase = await createClient();

  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("id, fornecedor_id, status")
    .eq("id", contrato_id)
    .maybeSingle();
  if (!contrato) return falha("Contrato não encontrado.");

  if (id) {
    // Só rascunho é editável. O `.eq("status", "rascunho")` é a trava real: sem
    // ela, uma requisição forjada editaria um recebimento já fechado e já
    // comunicado ao fornecedor.
    const { data, error } = await supabase
      .from("recebimento")
      .update(campos)
      .eq("id", id)
      .eq("status", "rascunho")
      .select("id");
    if (error) {
      console.error("salvarRecebimento(update)", error);
      return falha("Não foi possível salvar o recebimento.");
    }
    if (!data || data.length === 0) {
      return falha("Este recebimento já foi fechado e não pode mais ser editado.");
    }
    revalidar(contrato_id, id);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("recebimento")
    .insert({
      org_id: perfil.org_id,
      contrato_id,
      fornecedor_id: contrato.fornecedor_id,
      ...campos,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("salvarRecebimento(insert)", error);
    return falha("Não foi possível criar o recebimento.");
  }

  revalidar(contrato_id, data.id);
  return { ok: true, id: data.id };
}

/**
 * Acrescenta ou edita uma linha do rascunho.
 *
 * `controle` vem no payload só para o refine do schema decidir se a peça é
 * obrigatória — não é coluna e não vai para o insert.
 */
export async function salvarRecebimentoItem(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar recebimentos.");
  }

  const parsed = recebimentoItemSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, recebimento_id } = parsed.data;
  // Lista EXPLÍCITA de colunas, e não spread do parsed: `controle` existe só
  // para o refine do schema decidir se a peça é obrigatória, e não é coluna.
  // Um spread mandaria o campo ao PostgREST e o insert falharia.
  const campos = {
    item_locado_id: parsed.data.item_locado_id,
    item_id: parsed.data.item_id,
    unidade_id: parsed.data.unidade_id,
    quantidade: parsed.data.quantidade,
    condicao: parsed.data.condicao,
    observacoes: parsed.data.observacoes,
  };

  const supabase = await createClient();

  const { data: rec } = await supabase
    .from("recebimento")
    .select("id, contrato_id, status")
    .eq("id", recebimento_id)
    .maybeSingle();
  if (!rec) return falha("Recebimento não encontrado.");
  if (rec.status !== "rascunho") {
    return falha("Este recebimento já foi fechado e não pode mais ser editado.");
  }

  const { error } = id
    ? await supabase.from("recebimento_item").update(campos).eq("id", id)
    : await supabase
        .from("recebimento_item")
        .insert({ org_id: perfil.org_id, recebimento_id, ...campos });

  if (error) {
    console.error("salvarRecebimentoItem", error);
    return falha("Não foi possível salvar o item.");
  }

  revalidar(rec.contrato_id, recebimento_id);
  return { ok: true };
}

export async function excluirRecebimentoItem(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para editar recebimentos." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const recebimentoId = String(formData.get("recebimento_id") ?? "").trim();
  if (!id || !recebimentoId) return;

  const supabase = await createClient();
  const { data: rec } = await supabase
    .from("recebimento")
    .select("contrato_id, status")
    .eq("id", recebimentoId)
    .maybeSingle();
  if (!rec) return { error: "Recebimento não encontrado." };
  if (rec.status !== "rascunho") {
    return { error: "Este recebimento já foi fechado." };
  }

  // Exclusão de verdade, e não soft delete: a linha de um rascunho não é
  // documento — o documento nasce no fechamento. Guardar lixo de rascunho só
  // atrapalharia a conferência.
  const { error } = await supabase.from("recebimento_item").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o item." };

  revalidar(rec.contrato_id, recebimentoId);
}

/**
 * Exclui o rascunho inteiro.
 *
 * Pelo RPC `soft_delete_recebimento` (migration 0049), que recusa recebimento
 * FECHADO: ele já gerou documento e já foi comunicado ao fornecedor. O caminho
 * para desfazer um fechado é reabrir — só master, na fase 1b.
 */
export async function excluirRecebimento(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const id = String(formData.get("id") ?? "").trim();
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_recebimento", {
    p_id: id,
  });
  if (error || data !== true) {
    return {
      error:
        "Não foi possível excluir. Recebimento já fechado não pode ser excluído.",
    };
  }

  if (contratoId) revalidar(contratoId);
}

/**
 * Fecha o recebimento: numera, carimba a retirada, gera o romaneio e avisa.
 *
 * A ORDEM IMPORTA e é deliberada:
 *
 *   1. valida  — recebimento sem item não vira documento
 *   2. numera  — `proximo_numero`, o contador gapless da migration 0048
 *   3. fecha   — o status vira 'fechado' e o registro deixa de ser editável
 *   4. carimba — `data_retirada` nos `item_locado` que ainda não a têm
 *   5. avisa   — PDF + e-mail ao fornecedor
 *
 * Do passo 5 para trás nada é desfeito. Se o Resend cair, o recebimento
 * CONTINUA FECHADO com `aviso_enviado_em` nulo, e a tela mostra "fornecedor não
 * avisado" com botão de reenviar. Uma entrega física que já aconteceu não deixa
 * de ter acontecido porque um serviço de e-mail está fora do ar — e desfazer o
 * fechamento devolveria um número já gasto, abrindo o buraco que o contador
 * existe para evitar.
 */
export async function fecharRecebimento(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para fechar recebimentos.");
  }

  const parsed = fecharRecebimentoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id } = parsed.data;

  const rec = await buscarRecebimento(id);
  if (!rec || !rec.contrato) return falha("Recebimento não encontrado.");
  if (rec.status !== "rascunho") {
    return falha("Este recebimento já foi fechado.");
  }
  // Documento sem item não é documento. O fornecedor receberia um romaneio
  // vazio e um número gasto à toa.
  if (rec.itens.length === 0) {
    return falha("Lance ao menos um item antes de fechar o recebimento.");
  }

  const supabase = await createClient();

  // O ano vem de São Paulo, como manda o AGENTS.md: às 23h de 31 de dezembro o
  // servidor em UTC já virou o ano e o primeiro recebimento de janeiro sairia
  // numerado no ano errado.
  const ano = Number(hojeISOSaoPaulo().slice(0, 4));
  const { data: numero, error: erroNumero } = await supabase.rpc("proximo_numero", {
    p_org: perfil.org_id,
    p_tipo: "recebimento",
    p_ano: ano,
  });
  if (erroNumero || !numero) {
    console.error("fecharRecebimento.numero", erroNumero);
    return falha("Não foi possível gerar o número do recebimento.");
  }

  // `.eq("status", "rascunho")` no UPDATE é a trava contra o duplo clique: dois
  // fechamentos simultâneos gastariam dois números para o mesmo recebimento.
  const { data: fechados, error: erroFechar } = await supabase
    .from("recebimento")
    .update({
      numero_registro: numero,
      status: "fechado",
      fechado_em: new Date().toISOString(),
      fechado_por: perfil.id,
    })
    .eq("id", id)
    .eq("status", "rascunho")
    .select("id");
  if (erroFechar) {
    console.error("fecharRecebimento.update", erroFechar);
    return falha("Não foi possível fechar o recebimento.");
  }
  if (!fechados || fechados.length === 0) {
    return falha("Este recebimento já foi fechado por outra pessoa.");
  }

  // Carimba a retirada nos itens do contrato que ainda não a tinham. É o que
  // liga o recebimento ao cálculo de custo: sem `data_retirada`, o item locado
  // não entra na conta de locação.
  const locados = rec.itens
    .map((i) => i.item_locado_id)
    .filter((v): v is string => Boolean(v));
  if (locados.length > 0) {
    const { error: erroRetirada } = await supabase
      .from("item_locado")
      .update({ data_retirada: rec.recebido_em })
      .in("id", locados)
      .is("data_retirada", null);
    // Não aborta: o fechamento já aconteceu e o número já foi gasto. Falha aqui
    // é dado incompleto, não documento inválido.
    if (erroRetirada) console.error("fecharRecebimento.retirada", erroRetirada);
  }

  revalidar(rec.contrato.id, id);

  // ── A partir daqui, nada derruba o fechamento ────────────────────────────
  const destino = rec.fornecedor?.contato_email?.trim();
  if (!destino) {
    return {
      ok: true,
      id,
      aviso:
        "Recebimento " +
        numero +
        " fechado. O fornecedor não tem e-mail cadastrado, então não foi avisado.",
    };
  }
  if (!emailConfigurado()) {
    return {
      ok: true,
      id,
      aviso: "Recebimento " + numero + " fechado. O envio de e-mail não está configurado.",
    };
  }

  try {
    const { data: org } = await supabase
      .from("organizacao")
      .select(SELECT_ORGANIZACAO_EMAIL)
      .eq("id", perfil.org_id)
      .maybeSingle();

    const obra = rec.contrato.obra;
    const obraRotulo = obra ? obra.codigo + " — " + obra.nome : "Obra";
    const arquivo = "Romaneio-" + numero + ".pdf";

    const pdf = await gerarRomaneioPdf({
      numero,
      orgNome: (org as LinhaOrganizacaoEmail | null)?.nome ?? "Sistenge",
      fornecedor: rec.fornecedor?.nome ?? "Fornecedor",
      obra: obraRotulo,
      contratoNumero: rec.contrato.numero,
      contratoRegistro: rec.contrato.numero_registro,
      recebidoEm: formatarData(rec.recebido_em),
      conferente: rec.conferente,
      notaFornecedor: rec.nota_fornecedor,
      observacoes: rec.observacoes,
      itens: rec.itens.map((i) => ({
        descricao: i.item_descricao,
        patrimonio: i.unidade_identificador,
        quantidade: i.quantidade,
        condicao: i.condicao,
        observacoes: i.observacoes,
      })),
      localData: formatarData(rec.recebido_em) + ".",
    });

    const email = recebimentoFornecedor(
      {
        numero,
        fornecedor: rec.fornecedor?.nome ?? "Fornecedor",
        obra: obraRotulo,
        data: formatarData(rec.recebido_em),
        contrato: rec.contrato.numero_registro ?? rec.contrato.numero,
        anexo: arquivo,
        observacoes: rec.observacoes ?? undefined,
        itens: rec.itens.map((i) => ({
          descricao: i.item_descricao,
          quantidade: String(i.quantidade),
          patrimonio: i.unidade_identificador ?? undefined,
        })),
      },
      montarContexto((org as LinhaOrganizacaoEmail | null) ?? null),
    );

    await enviarEmail([destino], email, [{ filename: arquivo, content: pdf }]);

    // O e-mail JÁ saiu neste ponto. Se o carimbo não for gravado, a tela vai
    // dizer "fornecedor ainda não avisado" para sempre — e alguém vai reenviar
    // um romaneio que o fornecedor já recebeu.
    const { error: erroCarimbo } = await supabase
      .from("recebimento")
      .update({ aviso_enviado_em: new Date().toISOString() })
      .eq("id", id);
    if (erroCarimbo) console.error("fecharRecebimento/carimbo", erroCarimbo);

    revalidar(rec.contrato.id, id);
    return {
      ok: true,
      id,
      aviso: erroCarimbo
        ? "Recebimento " +
          numero +
          " fechado e e-mail enviado, mas o registro do aviso não foi gravado — a tela ainda vai mostrar o fornecedor como não avisado."
        : "Recebimento " + numero + " fechado e fornecedor avisado.",
    };
  } catch (e) {
    console.error("fecharRecebimento.email", e);
    return {
      ok: true,
      id,
      aviso:
        "Recebimento " +
        numero +
        " fechado, mas o aviso ao fornecedor falhou. Use o botão de reenviar.",
    };
  }
}
