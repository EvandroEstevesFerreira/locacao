"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import {
  confirmacaoDoEmail,
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

  // A confirmação depende do que JÁ ESTAVA gravado: salvar sem tocar num
  // endereço derivado não pode transformá-lo em conferido.
  let atual = { email: null as string | null, confirmado: false };
  if (id) {
    const { data: anterior } = await supabase
      .from("funcionario")
      .select("email, email_confirmado")
      .eq("id", id)
      .maybeSingle();
    if (anterior) {
      atual = { email: anterior.email, confirmado: anterior.email_confirmado };
    }
  }

  const campos = {
    ...parsed.data,
    email_confirmado: confirmacaoDoEmail(atual, {
      email: parsed.data.email,
      marcouConfirmar: formData.get("confirmar_email") === "on",
    }),
  };

  const { data, error } = id
    ? await supabase
        .from("funcionario")
        .update(campos)
        .eq("id", id)
        .select("id")
        .single()
    : await supabase
        .from("funcionario")
        .insert({ org_id: perfil.org_id, ...campos })
        .select("id")
        .single();

  if (error) {
    // 23505 = unique_violation. Agora são DOIS índices únicos, e dizer "CPF"
    // para uma colisão de e-mail manda a pessoa conferir o campo errado.
    if (error.code === "23505") {
      return falha(
        error.message.includes("idx_funcionario_email")
          ? "Já existe funcionário com esse e-mail."
          : "Já existe funcionário com esse CPF.",
      );
    }
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
    const { error: erroDesfazer } = await supabase
      .from("termo_equipamento")
      .delete()
      .eq("id", criado.id);
    // A compensação falhar é pior que o erro original: sobra um termo em
    // rascunho sem item nenhum, que ninguém sabe de onde veio. Não muda a
    // mensagem ao usuário — muda o que dá para investigar depois.
    if (erroDesfazer) {
      console.error("salvarTermo/desfazer", criado.id, erroDesfazer);
    }
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
 * assinado sem registro.
 *
 * Devolve a PRIMEIRA falha, em texto de usuário, ou `null` quando tudo entrou.
 * Quem chama decide se isso vira mensagem — e nenhum chamador desfaz o
 * documento por causa disto. O `console.error` acontece de todo jeito: era o
 * retorno descartado aqui que fazia um termo retrodatado ficar assinado sem
 * linha de custódia, sem erro na tela e sem rastro no log.
 */
async function moverPecasDoTermo(
  termoId: string,
  momento: "entrega" | "devolucao",
): Promise<string | null> {
  const supabase = await createClient();
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) {
    console.error("moverPecasDoTermo/perfil", "sessao sem org_id");
    return "Sessão inválida ao registrar o histórico de posse da peça.";
  }

  const { data: termo, error: erroTermo } = await supabase
    .from("termo_equipamento")
    .select("funcionario_id, obra_id, data_entrega, encerrado_em, cancelado_em")
    .eq("id", termoId)
    .single();
  if (erroTermo || !termo) {
    console.error("moverPecasDoTermo/termo", erroTermo);
    return "Não foi possível ler o termo para registrar o histórico de posse da peça.";
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
    return "Não foi possível ler os itens do termo para registrar o histórico de posse da peça.";
  }

  type Linha = {
    unidade_id: string;
    data_devolucao: string | null;
    unidade: { situacao: SituacaoPeca } | null;
  };
  const destino: SituacaoPeca = momento === "entrega" ? "em_uso" : "disponivel";

  // Data do fechamento: a do fim do documento, não "hoje". Encerrar em
  // 05/09 um termo cujo encerrado_em é 03/09 gravaria dois dias de posse que
  // não houve.
  //
  // E ela sai de `hojeISOSaoPaulo(instante)`, NUNCA de `.slice(0, 10)`:
  // `encerrado_em` e `cancelado_em` são `timestamptz` gravados em UTC, e das
  // 21h à meia-noite em Brasília o corte cru devolveria o dia SEGUINTE. A posse
  // de almoxarifado nasceria com início amanhã, e qualquer movimentação na
  // mesma noite seria recusada por `fim >= inicio` — a peça travava até o dia
  // virar. `hojeISOSaoPaulo()` sem base é o último recurso, quando os dois
  // campos são nulos.
  const instanteDoFim = t.cancelado_em ?? t.encerrado_em;
  const fimDoDocumento = instanteDoFim
    ? hojeISOSaoPaulo(new Date(instanteDoFim))
    : hojeISOSaoPaulo();

  // Lista, e não variável reatribuída: o retorno é a PRIMEIRA falha, e a
  // análise de fluxo do TypeScript não acompanha atribuição dentro de closure.
  const problemas: string[] = [];

  for (const l of itens as unknown as Linha[]) {
    // Peça sem situação legível não tem de onde transicionar.
    const de = l.unidade?.situacao;
    if (!de) continue;

    // Dois casos que NÃO são movimento, e nenhum dos dois pode virar linha no
    // livro — em ambos `podeTransicionar` devolveria true por `de === para`:
    //
    // 1. item já devolvido, fechado por `liberarPecas` na devolução parcial: o
    //    encerramento reabriria e refecharia a mesma posse, deixando uma linha
    //    de duração zero;
    // 2. peça já solta — `de === destino`. É o cancelamento de um termo JÁ
    //    ENCERRADO: o encerramento abriu a posse de almoxarifado, e sem esta
    //    guarda o cancelamento a fecharia para inserir outra igual, e o livro
    //    passaria a dizer que a peça foi "do almoxarifado para o
    //    almoxarifado". Fecha também a mesma peça repetida em duas linhas do
    //    mesmo termo, que o wizard não deduplica.
    if (momento === "devolucao" && (l.data_devolucao || de === destino)) continue;

    if (!podeTransicionar(de, destino, "evento")) continue;

    const { data: mudou, error: erroUpd } = await supabase
      .from("equipamento_unidade")
      .update({ situacao: destino })
      .eq("id", l.unidade_id)
      // `.select("id")` porque UPDATE de 0 linhas não é erro para o PostgREST:
      // uma policy de RLS que filtre a linha deixaria a peça "disponível" com
      // termo aberto, em silêncio. A peça é pulada, não derruba as outras.
      .select("id");
    if (erroUpd || !mudou?.length) {
      console.error("moverPecasDoTermo/update", erroUpd ?? "update atingiu 0 linhas");
      problemas.push(
        "A situação de alguma peça não mudou no cadastro — provavelmente falta " +
          "de permissão para alterar a peça. Avise um administrador.",
      );
    }

    const r =
      momento === "entrega"
        ? await abrirCustodia(supabase, {
            orgId: perfil.org_id,
            unidadeId: l.unidade_id,
            tipo: "funcionario",
            obraId: t.obra_id,
            funcionarioId: t.funcionario_id,
            inicio: t.data_entrega,
            origem: "termo",
            termoId: termoId,
          })
        : // Fecha e devolve a peça ao almoxarifado. `origem: "termo"` e não
          // "manual": o evento que produziu esta posse foi o fim de um termo, e
          // é isso que permite a linha do tempo dizer POR QUE a peça voltou. A
          // guarda acima já eliminou os itens com `data_devolucao`, então aqui
          // resta só quem nunca foi devolvido — a data é sempre a do documento.
          await abrirCustodia(supabase, {
            orgId: perfil.org_id,
            unidadeId: l.unidade_id,
            tipo: "almoxarifado",
            inicio: fimDoDocumento,
            origem: "termo",
            termoId: termoId,
          });
    if (!r.ok) problemas.push(r.erro);
  }

  return problemas[0] ?? null;
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

  const problemaNoLivro = await moverPecasDoTermo(termoId, "entrega");

  revalidatePath("/termos");
  revalidatePath(`/termos/${termoId}`);
  // A Frota mostra a situação da peça, que acabou de mudar.
  revalidatePath("/frota");

  // O termo está emitido, numerado e assinado: falha no livro NÃO o desfaz. Mas
  // também não pode ficar muda — é a mesma forma das assinaturas acima. Os
  // `revalidatePath` vêm antes de propósito: as telas precisam mostrar o
  // documento novo mesmo quando a mensagem é de erro.
  if (problemaNoLivro) {
    return falha(
      `O termo foi emitido, mas o histórico de posse da peça não foi atualizado. ${problemaNoLivro}`,
    );
  }
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
 *
 * Devolve a PRIMEIRA falha em texto de usuário, ou `null`, no mesmo contrato de
 * `moverPecasDoTermo`: a devolução já foi gravada quando se chega aqui, e quem
 * chama decide se a falha do livro vira mensagem.
 */
async function liberarPecas(termoId: string, itemIds: string[]): Promise<string | null> {
  if (itemIds.length === 0) return null;
  const supabase = await createClient();
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) {
    console.error("liberarPecas/perfil", "sessao sem org_id");
    return "Sessão inválida ao registrar o histórico de posse da peça.";
  }

  const { data, error } = await supabase
    .from("termo_equipamento_item")
    .select("unidade_id, data_devolucao, unidade:unidade_id(situacao)")
    .in("id", itemIds)
    .not("unidade_id", "is", null);

  if (error || !data) {
    console.error("liberarPecas/leitura", error);
    return "Não foi possível ler os itens devolvidos para registrar o histórico de posse da peça.";
  }

  type Linha = {
    unidade_id: string;
    data_devolucao: string | null;
    unidade: { situacao: SituacaoPeca } | null;
  };
  // Lista, e não variável reatribuída: o retorno é a PRIMEIRA falha, e a
  // análise de fluxo do TypeScript não acompanha atribuição dentro de closure.
  const problemas: string[] = [];

  for (const l of data as unknown as Linha[]) {
    const de = l.unidade?.situacao;
    if (!de || !podeTransicionar(de, "disponivel", "evento")) continue;
    const { data: mudou, error: erroUpd } = await supabase
      .from("equipamento_unidade")
      .update({ situacao: "disponivel" })
      .eq("id", l.unidade_id)
      // Mesmo motivo de `moverPecasDoTermo`: 0 linhas atualizadas não é erro
      // para o PostgREST, e a peça ficaria "em uso" num termo devolvido.
      .select("id");
    if (erroUpd || !mudou?.length) {
      console.error("liberarPecas/update", erroUpd ?? "update atingiu 0 linhas");
      problemas.push(
        "A situação de alguma peça não mudou no cadastro — provavelmente falta " +
          "de permissão para alterar a peça. Avise um administrador.",
      );
    }

    // A peça volta ao almoxarifado na data em que foi devolvida — não hoje.
    const r = await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: l.unidade_id,
      tipo: "almoxarifado",
      inicio: l.data_devolucao ?? hojeISOSaoPaulo(),
      origem: "termo",
      termoId,
    });
    if (!r.ok) problemas.push(r.erro);
  }

  return problemas[0] ?? null;
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

  const problemaNoLivro = await liberarPecas(termoId, devolvidos);

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  revalidatePath("/frota");

  if (problemaNoLivro) {
    return falha(
      `A devolução foi registrada, mas o histórico de posse da peça não foi atualizado. ${problemaNoLivro}`,
    );
  }
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
  const problemaNoLivro = await moverPecasDoTermo(termoId, "devolucao");

  revalidatePath(`/termos/${termoId}`);
  revalidatePath("/termos");
  revalidatePath("/frota");

  if (problemaNoLivro) {
    return falha(
      `O termo foi encerrado, mas o histórico de posse da peça não foi atualizado. ${problemaNoLivro}`,
    );
  }
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
  const problemaNoLivro = await moverPecasDoTermo(id, "devolucao");

  revalidatePath(`/termos/${id}`);
  revalidatePath("/termos");
  revalidatePath("/frota");

  if (problemaNoLivro) {
    return falha(
      `O termo foi cancelado, mas o histórico de posse da peça não foi atualizado. ${problemaNoLivro}`,
    );
  }
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
