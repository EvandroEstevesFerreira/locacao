"use server";

// Devolução de equipamento — fase 2a.
//
// Espelha `recebimento-actions.ts`, que é o modelo aprovado, com UMA diferença
// estrutural: o fechamento não mora aqui. Ele é a função `fechar_devolucao` da
// migration 0065, porque são quatro escritas dependentes (conferir saldo,
// lançar o razão, marcar os itens devolvidos, numerar e fechar) e cada emenda
// entre elas na action seria uma janela para documento fechado com saldo não
// baixado — e é sobre o saldo que corre o custo de locação.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeExcluirCritico } from "@/lib/auth";
import {
  devolucaoSchema,
  devolucaoItemSchema,
  fecharDevolucaoSchema,
  condicaoDevolucaoLabel,
} from "@/lib/devolucao";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { ehDataISO, formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { emailConfigurado, enviarEmail } from "@/lib/email";
import { devolucaoFornecedor } from "@/lib/emails/templates";
import {
  montarContexto,
  SELECT_ORGANIZACAO_EMAIL,
  type LinhaOrganizacaoEmail,
} from "@/lib/emails/contexto";
import { buscarDevolucao } from "@/lib/data/devolucoes";
import { gerarTermoDevolucaoPdf } from "@/lib/documentos/termo-devolucao-render";

function revalidar(contratoId: string, devolucaoId?: string) {
  revalidatePath(`/contratos/${contratoId}`);
  revalidatePath("/devolucoes");
  if (devolucaoId) revalidatePath(`/devolucoes/${devolucaoId}`);
}

/**
 * Cria o rascunho e leva direto à conferência.
 *
 * REDIRECIONA, e por isso não devolve `ActionResult`: um `redirect()` lança
 * `NEXT_REDIRECT` e tudo depois do `await` no cliente seria código morto (regra
 * do AGENTS.md). Quem chama é um `<form action>` simples.
 *
 * Cria a VISTORIA junto. O relatório fotográfico tem de existir desde o
 * rascunho para que as fotos entrem ANTES do fechamento — depois do fechamento
 * o documento já saiu, e foto que chega depois não prova nada sobre o estado em
 * que o equipamento foi entregue.
 */
export async function criarRascunhoDevolucao(formData: FormData): Promise<void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    throw new Error("Você não tem permissão para registrar devoluções.");
  }
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  const devolvidoEm = String(formData.get("devolvido_em") ?? "").trim();
  // `ehDataISO` e não um regex escrito aqui: a cópia inline deste guarda foi
  // escrita sem as contrabarras (`/^d{4}-d{2}-d{2}$/`), recusou toda data
  // válida, e o botão de registrar recebimento não criava nada — sem erro
  // nenhum na tela (v0.39.0).
  if (!contratoId || !ehDataISO(devolvidoEm)) {
    throw new Error("Data de devolução inválida.");
  }

  const supabase = await createClient();
  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("fornecedor_id")
    .eq("id", contratoId)
    .maybeSingle();
  if (!contrato) throw new Error("Contrato não encontrado.");

  // A vistoria antes da devolução: se ela falhar, o rascunho nasce sem
  // relatório fotográfico, o que é ruim mas não impede a conferência. O
  // contrário — devolução sem cabeçalho — impediria.
  const { data: vistoria } = await supabase
    .from("vistoria")
    .insert({
      org_id: perfil.org_id,
      contrato_id: contratoId,
      tipo: "devolucao",
      data: devolvidoEm,
    })
    .select("id")
    .single();

  const { data, error } = await supabase
    .from("devolucao")
    .insert({
      org_id: perfil.org_id,
      contrato_id: contratoId,
      fornecedor_id: contrato.fornecedor_id,
      devolvido_em: devolvidoEm,
      vistoria_id: vistoria?.id ?? null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("criarRascunhoDevolucao", error);
    throw new Error("Não foi possível criar a devolução.");
  }

  revalidatePath(`/contratos/${contratoId}`);
  redirect(`/devolucoes/${data.id}`);
}

/**
 * Cria ou edita o cabeçalho do rascunho.
 *
 * O `fornecedor_id` NÃO vem do formulário: é lido do contrato. Deixá-lo na mão
 * do cliente permitiria gravar uma devolução apontando para um fornecedor que
 * não é o do contrato — e é esse fornecedor que recebe o aviso no fechamento.
 */
export async function salvarDevolucao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar devoluções.");
  }

  const parsed = devolucaoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, contrato_id, ...campos } = parsed.data;

  const supabase = await createClient();

  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select("id, fornecedor_id")
    .eq("id", contrato_id)
    .maybeSingle();
  if (!contrato) return falha("Contrato não encontrado.");

  if (id) {
    // Só rascunho é editável. O `.eq("status", "rascunho")` é a trava real: sem
    // ela, uma requisição forjada editaria uma devolução já fechada, já
    // comunicada ao fornecedor e já refletida no saldo.
    const { data, error } = await supabase
      .from("devolucao")
      .update(campos)
      .eq("id", id)
      .eq("status", "rascunho")
      .select("id");
    if (error) {
      console.error("salvarDevolucao(update)", error);
      return falha("Não foi possível salvar a devolução.");
    }
    if (!data || data.length === 0) {
      return falha("Esta devolução já foi fechada e não pode mais ser editada.");
    }
    revalidar(contrato_id, id);
    return { ok: true, id };
  }

  const { data, error } = await supabase
    .from("devolucao")
    .insert({
      org_id: perfil.org_id,
      contrato_id,
      fornecedor_id: contrato.fornecedor_id,
      ...campos,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("salvarDevolucao(insert)", error);
    return falha("Não foi possível criar a devolução.");
  }

  revalidar(contrato_id, data.id);
  return { ok: true, id: data.id };
}

/**
 * Acrescenta ou edita uma linha do rascunho.
 *
 * NÃO confere saldo. A conferência é do fechamento (`fechar_devolucao`, na
 * 0065), e a diferença importa: entre montar o rascunho e fechá-lo, outra
 * pessoa pode ter devolvido o mesmo item. Conferir só aqui deixaria o
 * fechamento estourar o saldo em silêncio.
 *
 * O que a tela mostra ao lado do campo é o saldo do MOMENTO, como orientação —
 * não como garantia.
 */
export async function salvarDevolucaoItem(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para editar devoluções.");
  }

  const parsed = devolucaoItemSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id, devolucao_id } = parsed.data;
  // Lista EXPLÍCITA de colunas, e não spread do parsed: um campo do schema que
  // não seja coluna faria o PostgREST recusar o insert inteiro.
  const campos = {
    item_locado_id: parsed.data.item_locado_id,
    unidade_id: parsed.data.unidade_id,
    quantidade: parsed.data.quantidade,
    condicao: parsed.data.condicao,
    observacoes: parsed.data.observacoes,
  };

  const supabase = await createClient();

  const { data: dev } = await supabase
    .from("devolucao")
    .select("id, contrato_id, status")
    .eq("id", devolucao_id)
    .maybeSingle();
  if (!dev) return falha("Devolução não encontrada.");
  if (dev.status !== "rascunho") {
    return falha("Esta devolução já foi fechada e não pode mais ser editada.");
  }

  const { error } = id
    ? await supabase.from("devolucao_item").update(campos).eq("id", id)
    : await supabase
        .from("devolucao_item")
        .insert({ org_id: perfil.org_id, devolucao_id, ...campos });

  if (error) {
    console.error("salvarDevolucaoItem", error);
    // `23505` é violação de unicidade — aqui só pode ser
    // `unique (devolucao_id, item_locado_id)`. A mensagem genérica mandaria o
    // usuário procurar um problema que não existe: o item já está no documento,
    // e o conserto é aumentar a quantidade da linha que já existe.
    if ((error as { code?: string }).code === "23505") {
      return falha(
        "Este item já está na devolução. Edite a linha existente para mudar a quantidade.",
      );
    }
    return falha("Não foi possível salvar o item.");
  }

  revalidar(dev.contrato_id, devolucao_id);
  return { ok: true };
}

export async function excluirDevolucaoItem(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return { error: "Você não tem permissão para editar devoluções." };
  }
  const id = String(formData.get("id") ?? "").trim();
  const devolucaoId = String(formData.get("devolucao_id") ?? "").trim();
  if (!id || !devolucaoId) return;

  const supabase = await createClient();
  const { data: dev } = await supabase
    .from("devolucao")
    .select("contrato_id, status")
    .eq("id", devolucaoId)
    .maybeSingle();
  if (!dev) return { error: "Devolução não encontrada." };
  if (dev.status !== "rascunho") {
    return { error: "Esta devolução já foi fechada." };
  }

  // Exclusão de verdade, e não soft delete: a linha de um rascunho não é
  // documento — o documento nasce no fechamento. E ela não moveu saldo, porque
  // o razão só é escrito no fechamento.
  const { error } = await supabase.from("devolucao_item").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir o item." };

  revalidar(dev.contrato_id, devolucaoId);
}

/**
 * Exclui o rascunho inteiro.
 *
 * Pelo RPC `soft_delete_devolucao` (migration 0064), que recusa devolução
 * FECHADA: ela já gerou documento, já baixou saldo e já foi comunicada ao
 * fornecedor. Excluí-la deixaria as `movimentacao` órfãs — o saldo continuaria
 * baixado, sem documento que explicasse por quê.
 */
export async function excluirDevolucao(
  formData: FormData,
): Promise<{ error?: string } | void> {
  const id = String(formData.get("id") ?? "").trim();
  const contratoId = String(formData.get("contrato_id") ?? "").trim();
  if (!id) return;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_devolucao", { p_id: id });
  if (error || data !== true) {
    return {
      error:
        "Não foi possível excluir. Devolução já fechada não pode ser excluída.",
    };
  }

  if (contratoId) revalidar(contratoId);
}

/**
 * Monta o termo e avisa o fornecedor. Usado no fechamento e no reenvio.
 *
 * Extraído porque o reenvio precisa do MESMO envio: duplicar a montagem do PDF
 * e do e-mail garantiria que as duas cópias divergissem, e a divergência
 * apareceria como dois termos diferentes da mesma devolução na caixa do
 * fornecedor.
 *
 * NÃO lança: devolve o que aconteceu. Quem chama decide — no fechamento, a
 * falha não pode derrubar o registro; no reenvio, ela é o próprio resultado.
 */
async function avisarFornecedor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  dev: NonNullable<Awaited<ReturnType<typeof buscarDevolucao>>>,
  numero: string,
): Promise<{ enviado: boolean; motivo?: string }> {
  const destino = dev.fornecedor?.contato_email?.trim();
  if (!destino) return { enviado: false, motivo: "O fornecedor não tem e-mail cadastrado." };
  if (!emailConfigurado()) {
    return { enviado: false, motivo: "O envio de e-mail não está configurado." };
  }
  if (!dev.contrato) return { enviado: false, motivo: "Contrato não encontrado." };

  try {
    const { data: org } = await supabase
      .from("organizacao")
      .select(SELECT_ORGANIZACAO_EMAIL)
      .eq("id", orgId)
      .maybeSingle();

    const obra = dev.contrato.obra;
    const obraRotulo = obra ? obra.codigo + " — " + obra.nome : "Obra";
    const arquivo = "Termo-devolucao-" + numero + ".pdf";

    // As ressalvas vão SEPARADAS no e-mail, não só como coluna da tabela: é
    // sobre elas que o fornecedor vai cobrar reposição, e enterrá-las numa
    // célula é como a ressalva passa despercebida até virar discussão de
    // fatura.
    const ressalvas = dev.itens
      .filter((i) => i.condicao !== "ok")
      .map(
        (i) =>
          `${i.item_descricao}${i.unidade_identificador ? ` (${i.unidade_identificador})` : ""} — ` +
          `${condicaoDevolucaoLabel(i.condicao)}: ${i.observacoes ?? "sem descrição"}`,
      );

    const pdf = await gerarTermoDevolucaoPdf({
      numero,
      orgNome: (org as LinhaOrganizacaoEmail | null)?.nome ?? "Sistenge",
      fornecedor: dev.fornecedor?.nome ?? "Fornecedor",
      obra: obraRotulo,
      contratoNumero: dev.contrato.numero,
      contratoRegistro: dev.contrato.numero_registro,
      devolvidoEm: formatarData(dev.devolvido_em),
      responsavel: dev.responsavel,
      notaFornecedor: dev.nota_fornecedor,
      observacoes: dev.observacoes,
      itens: dev.itens.map((i) => ({
        descricao: i.item_descricao,
        patrimonio: i.unidade_identificador,
        quantidade: i.quantidade,
        condicao: i.condicao,
        observacoes: i.observacoes,
      })),
      localData: formatarData(dev.devolvido_em) + ".",
    });

    const email = devolucaoFornecedor(
      {
        numero,
        fornecedor: dev.fornecedor?.nome ?? "Fornecedor",
        obra: obraRotulo,
        data: formatarData(dev.devolvido_em),
        contrato: dev.contrato.numero_registro ?? dev.contrato.numero,
        anexo: arquivo,
        observacoes: dev.observacoes ?? undefined,
        ressalvas: ressalvas.length > 0 ? ressalvas : undefined,
        itens: dev.itens.map((i) => ({
          descricao: i.item_descricao,
          quantidade: String(i.quantidade),
          patrimonio: i.unidade_identificador ?? undefined,
          condicao: condicaoDevolucaoLabel(i.condicao),
        })),
      },
      montarContexto((org as LinhaOrganizacaoEmail | null) ?? null),
    );

    await enviarEmail([destino], email, [{ filename: arquivo, content: pdf }]);

    // O e-mail JÁ saiu neste ponto. Se o carimbo não for gravado, a tela vai
    // dizer "fornecedor ainda não avisado" para sempre — e alguém vai reenviar
    // um termo que o fornecedor já recebeu.
    const { error: erroCarimbo } = await supabase
      .from("devolucao")
      .update({ aviso_enviado_em: new Date().toISOString() })
      .eq("id", dev.id);
    if (erroCarimbo) {
      console.error("avisarFornecedor/carimbo", erroCarimbo);
      return {
        enviado: true,
        motivo:
          "E-mail enviado, mas o registro do aviso não foi gravado — a tela ainda vai mostrar o fornecedor como não avisado.",
      };
    }
    return { enviado: true };
  } catch (e) {
    console.error("avisarFornecedor/devolucao", e);
    return { enviado: false, motivo: "O envio do e-mail falhou." };
  }
}

/**
 * Fecha a devolução.
 *
 * O trabalho de verdade é da função `fechar_devolucao` (migration 0065), que
 * confere o saldo, lança o razão, marca os itens devolvidos e numera — TUDO em
 * uma transação. Esta action só a chama e cuida do que não cabe numa
 * transação de banco: o PDF e o e-mail.
 *
 * Do e-mail para trás nada é desfeito. Se o Resend cair, a devolução CONTINUA
 * FECHADA com `aviso_enviado_em` nulo, e a tela mostra "fornecedor não avisado"
 * com botão de reenviar. Equipamento que já voltou fisicamente não deixa de ter
 * voltado porque um serviço de e-mail está fora do ar — e desfazer o fechamento
 * devolveria um número já gasto, abrindo o buraco que o contador existe para
 * evitar.
 */
export async function fecharDevolucao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para fechar devoluções.");
  }

  const parsed = fecharDevolucaoSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const { id } = parsed.data;

  const supabase = await createClient();

  const { data: resultado, error } = await supabase.rpc("fechar_devolucao", {
    p_id: id,
  });
  if (error) {
    console.error("fecharDevolucao.rpc", error);
    return falha("Não foi possível fechar a devolução.");
  }

  // A função devolve `{ok, motivo}` para erro de NEGÓCIO (saldo estourado, já
  // fechada, sem itens) e só lança para erro de verdade. O motivo é escrito
  // para ser lido pelo usuário — ele nomeia o item e a quantidade que não cabe.
  const r = resultado as {
    ok?: boolean;
    numero?: string;
    motivo?: string;
    avarias?: number;
  } | null;
  if (!r?.ok || !r.numero) {
    return falha(r?.motivo ?? "Não foi possível fechar a devolução.");
  }
  const numero = r.numero;
  // Quantas avarias o fechamento abriu, a partir dos itens ressalvados. Dizer
  // isso no toast é o que transforma a ressalva de texto no termo em trabalho
  // que alguém vai ter de apurar — e leva a pessoa à tela de Avarias.
  const abertas = Number(r.avarias ?? 0);
  const sufixoAvarias =
    abertas > 0
      ? " " + abertas + (abertas === 1 ? " avaria foi aberta para apuração." : " avarias foram abertas para apuração.")
      : "";

  // Relido DEPOIS do fechamento, de propósito: é este objeto que vira o PDF, e
  // ele precisa do número, que não existia antes da chamada acima.
  const dev = await buscarDevolucao(id);
  if (!dev || !dev.contrato) {
    // A devolução FOI fechada — o saldo já baixou. Só o aviso não sai.
    return {
      ok: true,
      id,
      aviso:
        "Devolução " +
        numero +
        " fechada, mas os dados não puderam ser relidos para gerar o termo. Use o botão de reenviar.",
    };
  }

  revalidar(dev.contrato.id, id);

  // ── A partir daqui, nada derruba o fechamento ────────────────────────────
  const aviso = await avisarFornecedor(supabase, perfil.org_id, dev, numero);
  revalidar(dev.contrato.id, id);

  return {
    ok: true,
    id,
    aviso:
      (aviso.enviado
        ? aviso.motivo
          ? "Devolução " + numero + " fechada. " + aviso.motivo
          : "Devolução " + numero + " fechada e fornecedor avisado."
        : "Devolução " +
          numero +
          " fechada, mas o fornecedor não foi avisado: " +
          (aviso.motivo ?? "falha no envio.") +
          " Use o botão de reenviar.") + sufixoAvarias,
  };
}

/**
 * Reenvia o aviso de uma devolução fechada.
 *
 * Existe porque o fechamento é IRREVERSÍVEL e o envio não: se o Resend cair, a
 * devolução fica fechada com `aviso_enviado_em` nulo, e sem este caminho a
 * única saída seria mandar o termo por fora do sistema — perdendo o registro de
 * que o fornecedor foi avisado.
 *
 * Reenviar um aviso JÁ ENVIADO é permitido de propósito: o e-mail pode ter ido
 * para a caixa errada, ou o fornecedor pode ter apagado.
 */
export async function reenviarAvisoDevolucao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para reenviar o aviso.");
  }

  const id = String((raw as { id?: string })?.id ?? "").trim();
  if (!id) return falha("Devolução não informada.");

  const dev = await buscarDevolucao(id);
  if (!dev || !dev.contrato) return falha("Devolução não encontrada.");
  if (dev.status !== "fechado" || !dev.numero_registro) {
    return falha("Só devolução fechada tem termo para enviar.");
  }

  const supabase = await createClient();
  const aviso = await avisarFornecedor(supabase, perfil.org_id, dev, dev.numero_registro);
  revalidar(dev.contrato.id, id);

  if (!aviso.enviado) return falha(aviso.motivo ?? "Não foi possível enviar o aviso.");
  return {
    ok: true,
    id,
    aviso:
      aviso.motivo ??
      "Aviso reenviado para " + (dev.fornecedor?.contato_email ?? "o fornecedor") + ".",
  };
}

/**
 * Reabre uma devolução fechada. Só master.
 *
 * ESTE É O CASO MAIS ESTREITO DOS DOIS DOCUMENTOS, e por uma razão que o
 * recebimento não tem: a devolução MOVEU SALDO. Reabri-la sem desfazer as
 * `movimentacao` deixaria o saldo baixado com o documento editável — e a
 * próxima devolução do mesmo item seria recusada por saldo insuficiente, sem
 * que nada na tela explicasse por quê.
 *
 * Então reabrir DESFAZ o razão desta devolução: apaga as `movimentacao` que ela
 * criou e devolve os `item_locado` a 'em_uso'. É seguro porque as linhas são
 * identificáveis (`devolucao_id`) e porque nada mais aponta para elas.
 *
 * O que NÃO é desfeito: o número (já pode estar num termo impresso) e o aviso
 * (o e-mail já saiu). Ao fechar de novo, um número NOVO é emitido, porque
 * `fechar_devolucao` sempre chama `proximo_numero` — e é o comportamento certo:
 * o documento mudou, então é outro documento.
 */
export async function reabrirDevolucao(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeExcluirCritico(perfil.papel)) {
    return falha("Apenas o Master pode reabrir uma devolução fechada.");
  }

  const id = String((raw as { id?: string })?.id ?? "").trim();
  const motivo = String((raw as { motivo?: string })?.motivo ?? "").trim();
  if (!id) return falha("Devolução não informada.");
  // Reabrir sem motivo é o tipo de ação que ninguém consegue explicar seis
  // meses depois. O motivo entra nas observações e fica na auditoria.
  if (motivo.length < 10) {
    return falha("Descreva o motivo da reabertura com pelo menos 10 caracteres.");
  }

  const dev = await buscarDevolucao(id);
  if (!dev || !dev.contrato) return falha("Devolução não encontrada.");
  if (dev.status !== "fechado") return falha("Esta devolução não está fechada.");

  const supabase = await createClient();

  // A trava contra o duplo clique vem PRIMEIRO: só quem conseguir mudar o
  // status de 'fechado' para 'rascunho' segue adiante e desfaz o razão. Sem
  // isso, dois cliques apagariam as movimentações duas vezes — a segunda vez
  // sobre linhas que já não existem, em silêncio.
  const carimbo = hojeISOSaoPaulo();
  const historico =
    (dev.observacoes ? dev.observacoes + "\n\n" : "") +
    "[" + carimbo + "] Reaberta por " + (perfil.nome ?? perfil.email ?? "master") + ": " + motivo;

  const { data, error } = await supabase
    .from("devolucao")
    .update({
      status: "rascunho",
      fechado_em: null,
      fechado_por: null,
      observacoes: historico,
    })
    .eq("id", id)
    .eq("status", "fechado")
    .select("id");
  if (error) {
    console.error("reabrirDevolucao", error);
    return falha("Não foi possível reabrir a devolução.");
  }
  if (!data || data.length === 0) {
    return falha("Esta devolução já foi reaberta por outra pessoa.");
  }

  // ── Desfaz o razão ───────────────────────────────────────────────────────
  const { error: erroMov } = await supabase
    .from("movimentacao")
    .delete()
    .eq("devolucao_id", id);
  if (erroMov) {
    console.error("reabrirDevolucao.movimentacao", erroMov);
    return {
      ok: true,
      id,
      aviso:
        "Devolução reaberta, mas o saldo NÃO foi restaurado — as movimentações " +
        "continuam lançadas. Avise um administrador antes de fechar de novo.",
    };
  }

  // ── Desfaz as avarias que ESTA devolução abriu ───────────────────────────
  // Sem isto, reabrir e fechar de novo duplicaria as avarias: o fechamento
  // insere uma por item ressalvado, e as da primeira vez continuariam lá.
  //
  // Só as INTOCADAS. Uma avaria que já virou lançamento financeiro ou que
  // alguém já apurou não é minha para apagar — apagá-la deixaria a conta a
  // pagar órfã, apontando para um laudo que não existe mais.
  const { data: apagadas, error: erroAvaria } = await supabase
    .from("avaria")
    .delete()
    .eq("devolucao_id", id)
    .eq("status", "aberta")
    .eq("responsabilidade", "indefinida")
    .is("lancamento_id", null)
    .select("id");
  if (erroAvaria) console.error("reabrirDevolucao.avarias", erroAvaria);

  // As que sobreviveram ao filtro acima: já apuradas ou já cobradas. Quem
  // reabre precisa saber que elas continuam de pé e que fechar de novo vai
  // criar OUTRAS ao lado delas.
  const { count: sobraram } = await supabase
    .from("avaria")
    .select("id", { count: "exact", head: true })
    .eq("devolucao_id", id);

  // Os itens voltam a 'em_aberto' — que é o nome do estado no enum
  // `status_item_locado`, cujos ÚNICOS valores são 'em_aberto' e 'devolvido'.
  // Só os desta devolução, e só os que estavam
  // marcados como devolvidos: outro documento pode ter devolvido o mesmo item
  // por inteiro, e desmarcá-lo aqui apagaria o efeito daquele.
  const locados = dev.itens.map((i) => i.item_locado_id);
  if (locados.length > 0) {
    const { error: erroStatus } = await supabase
      .from("item_locado")
      .update({ status: "em_aberto", data_devolucao: null })
      .in("id", locados)
      .eq("status", "devolvido");
    if (erroStatus) console.error("reabrirDevolucao.itens", erroStatus);
  }

  revalidar(dev.contrato.id, id);
  return {
    ok: true,
    id,
    aviso:
      "Devolução " +
      (dev.numero_registro ?? "") +
      " reaberta e saldo restaurado." +
      (apagadas && apagadas.length > 0
        ? " " + apagadas.length + (apagadas.length === 1 ? " avaria aberta foi desfeita." : " avarias abertas foram desfeitas.")
        : "") +
      (sobraram && sobraram > 0
        ? " ATENÇÃO: " + sobraram + (sobraram === 1 ? " avaria já apurada ou cobrada continua de pé" : " avarias já apuradas ou cobradas continuam de pé") +
          " — fechar de novo vai criar outras ao lado dela."
        : "") +
      " Ao fechar de novo, um número NOVO será emitido.",
  };
}
