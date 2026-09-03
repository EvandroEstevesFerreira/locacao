"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import {
  funcionarioSchema,
  termoSchema,
  termoItemSchema,
  assinaturaSchema,
  devolucaoItemSchema,
  cancelamentoSchema,
} from "@/lib/termo";
import { hojeISOSaoPaulo } from "@/lib/locacao";
// A matriz de transição da PEÇA é fonte única em frota.ts. O termo só a CHAMA.
import { podeTransicionar, type Situacao as SituacaoPeca } from "@/lib/frota";
import { abrirCustodia } from "@/lib/custodia-servidor";

export async function salvarFuncionario(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para cadastrar funcionários.");
  }

  const parsed = funcionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = id
    ? await supabase
        .from("funcionario")
        .update(parsed.data)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("funcionario")
        .insert({ org_id: perfil.org_id, ...parsed.data })
        .select("id")
        .single();

  if (error) {
    // 23505 = unique_violation. O único índice único é o do CPF.
    if (error.code === "23505") return falha("Já existe funcionário com esse CPF.");
    return falha("Não foi possível salvar o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true, id: data?.id };
}

export async function excluirFuncionario(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode excluir funcionários.");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return falha("Funcionário inválido.");

  const supabase = await createClient();
  const { error } = await supabase.from("funcionario").delete().eq("id", id);
  if (error) {
    // 23503 = foreign_key_violation: o funcionário tem termo. Não se apaga
    // quem tem histórico — desativa.
    if (error.code === "23503") {
      return falha("Este funcionário tem termos registrados. Desative-o em vez de excluir.");
    }
    return falha("Não foi possível excluir o funcionário.");
  }

  revalidatePath("/termos/funcionarios");
  return { ok: true };
}

// ── Rascunho e emissão ───────────────────────────────────────────────────────

type ItemPayload = Record<string, unknown>;

/**
 * Salva o termo como RASCUNHO: sem número e sem assinatura.
 *
 * Rascunho não gasta número de propósito. Se o número saísse aqui, todo termo
 * abandonado abriria buraco na sequência — e sequência com buraco é a primeira
 * coisa que um auditor pergunta. Mesmo desenho do `recebimento` (0049).
 */
export async function salvarTermo(payload: {
  termo: Record<string, unknown>;
  itens: ItemPayload[];
}): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) return falha("Você não tem permissão para emitir termos.");

  const termo = termoSchema.safeParse(payload.termo);
  if (!termo.success) return falha(primeiroErro(termo.error.issues));

  if (!payload.itens.length) return falha("Adicione ao menos um item ao termo.");
  const itens = payload.itens.map((i) => termoItemSchema.safeParse(i));
  const invalido = itens.find((r) => !r.success);
  if (invalido && !invalido.success) return falha(primeiroErro(invalido.error.issues));

  const supabase = await createClient();
  const { data: criado, error: erroTermo } = await supabase
    .from("termo_equipamento")
    .insert({ org_id: perfil.org_id, ...termo.data })
    .select("id")
    .single();
  if (erroTermo || !criado) {
    console.error("salvarTermo/cabecalho", erroTermo);
    return falha("Não foi possível salvar o termo.");
  }

  const linhas = itens.map((r) => {
    const i = r.success ? r.data : null;
    return {
      org_id: perfil.org_id,
      termo_id: criado.id,
      item_id: i!.item_id,
      unidade_id: i!.unidade_id,
      item_locado_id: i!.item_locado_id,
      quantidade: i!.quantidade,
      estado_entrega: i!.estado_entrega,
      observacoes: i!.observacoes,
    };
  });

  const { error: erroItens } = await supabase
    .from("termo_equipamento_item")
    .insert(linhas);
  if (erroItens) {
    console.error("salvarTermo/itens", erroItens);
    // Sem transação no PostgREST: desfaz o cabeçalho para não deixar termo sem
    // item, que é documento em branco esperando para ser assinado.
    await supabase.from("termo_equipamento").delete().eq("id", criado.id);
    return falha("Não foi possível salvar os itens do termo.");
  }

  revalidatePath("/termos");
  return { ok: true, id: criado.id };
}

/**
 * Move as peças do termo entre `disponivel` e `em_uso`.
 *
 * A regra NÃO é decidida aqui: `podeTransicionar` de `src/lib/frota.ts` é a
 * fonte única, e esta função só a chama com origem `"evento"`. Foi exatamente
 * para isto que a matriz foi escrita e testada uma fatia antes de existir
 * evento que a acionasse.
 *
 * Peça que não pode transicionar é PULADA, e não derruba a operação: quando
 * chegamos aqui o termo já está assinado, e falhar agora deixaria um documento
 * assinado sem registro. A divergência aparece na tela de Frota, que é onde
 * alguém consegue resolvê-la.
 */
async function moverPecasDoTermo(termoId: string, momento: "entrega" | "devolucao") {
  const supabase = await createClient();
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;

  const { data: termo, error: erroTermo } = await supabase
    .from("termo_equipamento")
    .select("funcionario_id, obra_id, data_entrega, encerrado_em, cancelado_em")
    .eq("id", termoId)
    .single();
  if (erroTermo || !termo) {
    console.error("moverPecasDoTermo/termo", erroTermo);
    return;
  }
  const t = termo as unknown as {
    funcionario_id: string;
    obra_id: string | null;
    data_entrega: string;
    encerrado_em: string | null;
    cancelado_em: string | null;
  };

  const { data: itens, error } = await supabase
    .from("termo_equipamento_item")
    .select("unidade_id, data_devolucao, unidade:unidade_id(situacao)")
    .eq("termo_id", termoId)
    .not("unidade_id", "is", null);

  if (error || !itens) {
    console.error("moverPecasDoTermo/leitura", error);
    return;
  }

  type Linha = {
    unidade_id: string;
    data_devolucao: string | null;
    unidade: { situacao: SituacaoPeca } | null;
  };
  const destino: SituacaoPeca = momento === "entrega" ? "em_uso" : "disponivel";

  // Data do fechamento: a do fim do documento, não "hoje". Encerrar em
  // 05/09 um termo cujo encerrado_em é 03/09 gravaria dois dias de posse que
  // não houve. `hojeISOSaoPaulo()` é o último recurso, nunca `new Date()`.
  const fimDoDocumento =
    (t.cancelado_em ?? t.encerrado_em)?.slice(0, 10) ?? hojeISOSaoPaulo();

  for (const l of itens as unknown as Linha[]) {
    const de = l.unidade?.situacao;
    if (!de || !podeTransicionar(de, destino, "evento")) continue;

    const { error: erroUpd } = await supabase
      .from("equipamento_unidade")
      .update({ situacao: destino })
      .eq("id", l.unidade_id);
    if (erroUpd) console.error("moverPecasDoTermo/update", erroUpd);

    if (momento === "entrega") {
      await abrirCustodia(supabase, {
        orgId: perfil.org_id,
        unidadeId: l.unidade_id,
        tipo: "funcionario",
        obraId: t.obra_id,
        funcionarioId: t.funcionario_id,
        inicio: t.data_entrega,
        origem: "termo",
        termoId: termoId,
      });
    } else {
      // Fecha e devolve a peça ao almoxarifado. `origem: "termo"` e não
      // "manual": o evento que produziu esta posse foi o fim de um termo, e é
      // isso que permite a linha do tempo dizer POR QUE a peça voltou.
      await abrirCustodia(supabase, {
        orgId: perfil.org_id,
        unidadeId: l.unidade_id,
        tipo: "almoxarifado",
        inicio: l.data_devolucao ?? fimDoDocumento,
        origem: "termo",
        termoId: termoId,
      });
    }
  }
}

/**
 * Emite o termo: grava o número, as duas assinaturas e MOVE AS PEÇAS.
 *
 * `equipamento_unidade.situacao` passa de `disponivel` para `em_uso` aqui, e só
 * aqui. É o gancho que a fatia de frota deixou pronto: a matriz diz que
 * `em_uso` muda SÓ por evento, e o termo assinado é esse evento.
 *
 * Sem isto, a tela de Frota mostraria "disponível" uma peça pela qual alguém
 * acabou de assinar — a mentira exata que a matriz existe para impedir.
 */
export async function emitirTermo(
  termoId: string,
  assinaturas: {
    funcionario: { nome: string; cpf: string | null; imagem: string | null };
    empresa: { nome: string; imagem: string | null };
  },
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) return falha("Você não tem permissão para emitir termos.");

  const func = assinaturaSchema.safeParse(assinaturas.funcionario);
  if (!func.success) return falha(primeiroErro(func.error.issues));

  const supabase = await createClient();

  const { data: atual, error: erroLeitura } = await supabase
    .from("termo_equipamento")
    .select("emitido_em, cancelado_em")
    .eq("id", termoId)
    .single();
  if (erroLeitura || !atual) return falha("Termo não encontrado.");
  if (atual.cancelado_em) return falha("Este termo foi cancelado.");
  if (atual.emitido_em) return falha("Este termo já foi emitido.");

  const ano = Number(hojeISOSaoPaulo().slice(0, 4));
  const { data: numero, error: erroNumero } = await supabase.rpc("proximo_numero", {
    p_org: perfil.org_id,
    p_tipo: "termo_equipamento",
    p_ano: ano,
  });
  if (erroNumero || !numero) {
    console.error("emitirTermo/numero", erroNumero);
    return falha("Não foi possível gerar o número do termo.");
  }

  const { error: erroUpdate } = await supabase
    .from("termo_equipamento")
    .update({ numero_registro: numero, emitido_em: new Date().toISOString() })
    .eq("id", termoId)
    // Corrida: dois cliques não emitem duas vezes.
    .is("emitido_em", null);
  if (erroUpdate) {
    console.error("emitirTermo/update", erroUpdate);
    return falha("Não foi possível emitir o termo.");
  }

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const { error: erroAss } = await supabase.from("termo_assinatura").insert([
    {
      org_id: perfil.org_id,
      termo_id: termoId,
      momento: "entrega",
      papel: "funcionario",
      nome: func.data.nome,
      cpf: func.data.cpf,
      imagem: func.data.imagem,
      assinado_ip: ip,
    },
    {
      org_id: perfil.org_id,
      termo_id: termoId,
      momento: "entrega",
      papel: "empresa",
      nome: assinaturas.empresa.nome || (perfil.nome ?? "—"),
      imagem: assinaturas.empresa.imagem,
      assinado_ip: ip,
    },
  ]);
  if (erroAss) {
    console.error("emitirTermo/assinaturas", erroAss);
    return falha("O termo foi emitido, mas as assinaturas não foram gravadas.");
  }

  await moverPecasDoTermo(termoId, "entrega");

  revalidatePath("/termos");
  revalidatePath(`/termos/${termoId}`);
  // A Frota mostra a situação da peça, que acabou de mudar.
  revalidatePath("/frota");
  return { ok: true, id: termoId };
}

// ── Devolução, encerramento e cancelamento ───────────────────────────────────

/**
 * Devolve as peças das linhas informadas para `disponivel`.
 *
 * Chama a matriz de `frota.ts` com origem `"evento"`, como a emissão. Peça que
 * volta COM AVARIA continua indo para `disponivel`, e não para `manutencao`: a
 * matriz não permite o pulo, e quem decide se a peça vai para conserto é quem
 * olha para ela, na tela de Frota. Mandar para manutenção automaticamente
 * esconderia uma decisão que é de uma pessoa.
 */
async function liberarPecas(termoId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const supabase = await createClient();
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;

  const { data, error } = await supabase
    .from("termo_equipamento_item")
    .select("unidade_id, data_devolucao, unidade:unidade_id(situacao)")
    .in("id", itemIds)
    .not("unidade_id", "is", null);

  if (error || !data) {
    console.error("liberarPecas/leitura", error);
    return;
  }

  type Linha = {
    unidade_id: string;
    data_devolucao: string | null;
    unidade: { situacao: SituacaoPeca } | null;
  };
  for (const l of data as unknown as Linha[]) {
    const de = l.unidade?.situacao;
    if (!de || !podeTransicionar(de, "disponivel", "evento")) continue;
    const { error: erroUpd } = await supabase
      .from("equipamento_unidade")
      .update({ situacao: "disponivel" })
      .eq("id", l.unidade_id);
    if (erroUpd) console.error("liberarPecas/update", erroUpd);

    // A peça volta ao almoxarifado na data em que foi devolvida — não hoje.
    await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: l.unidade_id,
      tipo: "almoxarifado",
      inicio: l.data_devolucao ?? hojeISOSaoPaulo(),
      origem: "termo",
      termoId,
    });
  }
}

/**
 * Devolução PARCIAL: por item, sem assinatura.
 *
 * A assinatura é do encerramento, não de cada volta. Exigi-la a cada item faria
 * o almoxarife perseguir o funcionário toda vez que uma furadeira voltasse — e
 * o resultado seria ninguém registrar devolução nenhuma.
 *
 * Cada peça devolvida volta a `disponivel`. Sem isso ela ficaria "em uso" para
 * sempre e sumiria da lista de peças disponíveis para o próximo termo.
 */
export async function registrarDevolucao(
  termoId: string,
  itens: {
    item_id: string;
    data_devolucao: string;
    estado_devolucao: string;
    observacoes?: string;
  }[],
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para registrar devoluções.");
  }
  if (!itens.length) return falha("Marque ao menos um item devolvido.");

  const supabase = await createClient();
  const devolvidos: string[] = [];

  for (const bruto of itens) {
    const r = devolucaoItemSchema.safeParse(bruto);
    if (!r.success) return falha(primeiroErro(r.error.issues));

    const { error } = await supabase
      .from("termo_equipamento_item")
      .update({
        data_devolucao: r.data.data_devolucao,
        estado_devolucao: r.data.estado_devolucao,
        observacoes: r.data.observacoes,
      })
      .eq("id", r.data.item_id)
      .eq("termo_id", termoId);
    if (error) {
      console.error("registrarDevolucao", error);
      return falha("Não foi possível registrar a devolução.");
    }
    devolvidos.push(r.data.item_id);
  }

  await liberarPecas(termoId, devolvidos);

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  revalidatePath("/frota");
  return { ok: true };
}

/**
 * Encerra o termo, com assinatura da devolução.
 *
 * Itens sem devolução CONTINUAM sem — ficam registrados como pendência no
 * documento. É o que resolve o funcionário que devolveu dois de três itens e
 * foi desligado: sem o encerramento, o termo ficaria aberto para sempre, e a
 * pendência sumiria no meio de uma lista de termos vivos.
 */
export async function encerrarTermo(
  termoId: string,
  assinaturas: {
    funcionario: { nome: string; cpf: string | null; imagem: string | null };
    empresa: { nome: string; imagem: string | null };
  },
): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para encerrar termos.");
  }
  const func = assinaturaSchema.safeParse(assinaturas.funcionario);
  if (!func.success) return falha(primeiroErro(func.error.issues));

  const supabase = await createClient();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error: erroAss } = await supabase.from("termo_assinatura").upsert(
    [
      {
        org_id: perfil.org_id,
        termo_id: termoId,
        momento: "devolucao",
        papel: "funcionario",
        nome: func.data.nome,
        cpf: func.data.cpf,
        imagem: func.data.imagem,
        assinado_ip: ip,
      },
      {
        org_id: perfil.org_id,
        termo_id: termoId,
        momento: "devolucao",
        papel: "empresa",
        nome: assinaturas.empresa.nome || (perfil.nome ?? "—"),
        imagem: assinaturas.empresa.imagem,
        assinado_ip: ip,
      },
    ],
    // `upsert` e não `insert`: encerrar duas vezes por dois cliques não pode
    // estourar erro de unique na cara de quem está com o funcionário na frente.
    { onConflict: "termo_id,momento,papel" },
  );
  if (erroAss) {
    console.error("encerrarTermo/assinaturas", erroAss);
    return falha("Não foi possível gravar as assinaturas da devolução.");
  }

  const { error } = await supabase
    .from("termo_equipamento")
    .update({ encerrado_em: new Date().toISOString() })
    .eq("id", termoId);
  if (error) {
    console.error("encerrarTermo/update", error);
    return falha("Não foi possível encerrar o termo.");
  }

  // Encerrar libera o que ainda estava em uso: item não devolvido continua
  // registrado como pendência no documento, mas a PEÇA não pode ficar presa a
  // um termo encerrado.
  await moverPecasDoTermo(termoId, "devolucao");

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  revalidatePath("/frota");
  return { ok: true };
}

/** Cancela um termo emitido. Documento assinado não some — fica anulado com motivo. */
export async function cancelarTermo(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode cancelar um termo.");
  }
  const id = String(formData.get("id") ?? "").trim();
  const parsed = cancelamentoSchema.safeParse({ motivo: formData.get("motivo") });
  if (!id) return falha("Termo inválido.");
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const supabase = await createClient();
  const { error } = await supabase
    .from("termo_equipamento")
    .update({
      cancelado_em: new Date().toISOString(),
      motivo_cancelamento: parsed.data.motivo,
    })
    .eq("id", id);
  if (error) {
    console.error("cancelarTermo", error);
    return falha("Não foi possível cancelar o termo.");
  }

  // Termo cancelado é termo que não valeu: as peças voltam a disponível, senão
  // ficariam presas a um documento anulado.
  await moverPecasDoTermo(id, "devolucao");

  revalidatePath(`/termos/${id}`);
  revalidatePath("/termos");
  revalidatePath("/frota");
  return { ok: true };
}

/** Só rascunho se apaga. Termo emitido CANCELA — documento assinado não some. */
export async function excluirRascunho(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para excluir termos.");
  }
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return falha("Termo inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("termo_equipamento")
    .delete()
    .eq("id", id)
    // A guarda é no BANCO, não só na tela: a tela pode estar velha, e apagar um
    // termo emitido apagaria um documento assinado.
    .is("emitido_em", null)
    .select("id");
  if (error) {
    console.error("excluirRascunho", error);
    return falha("Não foi possível excluir o rascunho.");
  }
  if (!data?.length) {
    return falha("Este termo já foi emitido — cancele em vez de excluir.");
  }

  revalidatePath("/termos");
  return { ok: true };
}
