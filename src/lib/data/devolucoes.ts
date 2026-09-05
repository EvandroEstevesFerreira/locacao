import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";

// Leituras da devolução de equipamento.
//
// `createClient()`, nunca `createAdminClient()`. O recorte por obra vive na RLS
// (migration 0064, via `obra_do_contrato`): um `.from(...)` com client admin
// faria a obra A enxergar as devoluções da obra B em silêncio, e nenhum teste
// pegaria.

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type DevolucaoLista = {
  id: string;
  numero_registro: string | null;
  devolvido_em: string;
  status: string;
  responsavel: string | null;
  nota_fornecedor: string | null;
  aviso_enviado_em: string | null;
  itens: number;
};

export type DevolucaoItemLinha = {
  id: string;
  item_locado_id: string;
  item_id: string;
  item_descricao: string;
  controle: "peca" | "quantidade";
  unidade_id: string | null;
  unidade_identificador: string | null;
  quantidade: number;
  condicao: string;
  observacoes: string | null;
};

/**
 * Devoluções de um contrato, da mais recente para a mais antiga.
 *
 * `devolucao_item(count)` em vez das linhas: a listagem só precisa de quantos
 * itens são, e puxar todos multiplicaria o payload por nada.
 */
export async function listarDevolucoes(
  contratoId: string,
): Promise<DevolucaoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devolucao")
    .select(
      "id, numero_registro, devolvido_em, status, responsavel, nota_fornecedor, aviso_enviado_em, devolucao_item(count)",
    )
    .eq("contrato_id", contratoId)
    .order("devolvido_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listarDevolucoes", error);
    return [];
  }

  return (data ?? []).map((d) => {
    const c = d.devolucao_item as { count: number }[] | null;
    return {
      id: d.id,
      numero_registro: d.numero_registro,
      devolvido_em: d.devolvido_em,
      status: d.status,
      responsavel: d.responsavel,
      nota_fornecedor: d.nota_fornecedor,
      aviso_enviado_em: d.aviso_enviado_em,
      itens: c?.[0]?.count ?? 0,
    };
  });
}

export type DevolucaoCompleta = {
  id: string;
  numero_registro: string | null;
  devolvido_em: string;
  status: string;
  responsavel: string | null;
  nota_fornecedor: string | null;
  observacoes: string | null;
  fechado_em: string | null;
  aviso_enviado_em: string | null;
  vistoria_id: string | null;
  contrato: {
    id: string;
    numero: string;
    numero_registro: string | null;
    obra: { codigo: string; nome: string } | null;
  } | null;
  fornecedor: { nome: string; contato_email: string | null } | null;
  itens: DevolucaoItemLinha[];
};

/**
 * Uma devolução completa, com itens.
 *
 * Devolve `null` quando não existe ou quando o usuário não pode lê-la — a
 * policy esconde a linha, e a página chama `notFound()` nos dois casos sem
 * distinguir.
 */
export async function buscarDevolucao(
  id: string,
): Promise<DevolucaoCompleta | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("devolucao")
    .select(
      "*, contrato:contrato_id(id, numero, numero_registro, obra:obra_id(codigo, nome)), fornecedor:fornecedor_id(nome, contato_email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: itensRaw, error: erroItens } = await supabase
    .from("devolucao_item")
    .select(
      "id, item_locado_id, unidade_id, quantidade, condicao, observacoes, item_locado:item_locado_id(item_id, item:item_id(descricao, controle)), unidade:unidade_id(identificador)",
    )
    .eq("devolucao_id", id)
    .order("created_at");

  if (erroItens) console.error("buscarDevolucao.itens", erroItens);

  const itens: DevolucaoItemLinha[] = (itensRaw ?? []).map((i) => {
    const locado = achatar(
      i.item_locado as unknown as {
        item_id: string;
        item: { descricao: string; controle: string } | { descricao: string; controle: string }[] | null;
      } | null,
    );
    const item = achatar(locado?.item ?? null);
    const un = achatar(i.unidade as unknown as { identificador: string } | null);
    return {
      id: i.id,
      item_locado_id: i.item_locado_id,
      item_id: locado?.item_id ?? "",
      item_descricao: item?.descricao ?? "Item",
      controle: (item?.controle as "peca" | "quantidade") ?? "quantidade",
      unidade_id: i.unidade_id,
      unidade_identificador: un?.identificador ?? null,
      quantidade: Number(i.quantidade),
      condicao: i.condicao,
      observacoes: i.observacoes,
    };
  });

  const contratoBruto = achatar(
    data.contrato as unknown as {
      id: string;
      numero: string;
      numero_registro: string | null;
      obra: { codigo: string; nome: string } | { codigo: string; nome: string }[] | null;
    } | null,
  );

  return {
    id: data.id,
    numero_registro: data.numero_registro,
    devolvido_em: data.devolvido_em,
    status: data.status,
    responsavel: data.responsavel,
    nota_fornecedor: data.nota_fornecedor,
    observacoes: data.observacoes,
    fechado_em: data.fechado_em,
    aviso_enviado_em: data.aviso_enviado_em,
    vistoria_id: data.vistoria_id,
    contrato: contratoBruto
      ? { ...contratoBruto, obra: achatar(contratoBruto.obra) }
      : null,
    fornecedor: achatar(
      data.fornecedor as unknown as { nome: string; contato_email: string | null } | null,
    ),
    itens,
  };
}

// ---------------------------------------------------------------------------
// Saldo em aberto
// ---------------------------------------------------------------------------

export type ItemComSaldo = {
  item_locado_id: string;
  item_id: string;
  descricao: string;
  controle: "peca" | "quantidade";
  unidade_id: string | null;
  unidade_identificador: string | null;
  /** O que o contrato prevê. */
  contratado: number;
  /** O que já voltou, somando TODAS as movimentações de devolução. */
  devolvido: number;
  /** `contratado - devolvido`. É o teto de uma devolução nova. */
  saldo: number;
};

/**
 * Os itens do contrato com o saldo ainda em aberto.
 *
 * A base do formulário de devolução — e o motivo de esta função existir em vez
 * de reaproveitar `listarItensDoContrato`, que só sabe o contratado.
 *
 * O devolvido soma `movimentacao`, não `devolucao_item`. É deliberado:
 * `movimentacao` é o razão de saldo e inclui as devoluções anteriores ao
 * documento (`devolucao_id` nulo), que existem e valem. Somar `devolucao_item`
 * ignoraria o histórico e ofereceria saldo que já foi baixado.
 *
 * Rascunhos NÃO entram na conta, porque não geram `movimentacao`. Duas pessoas
 * montando rascunhos do mesmo item veriam ambas o saldo cheio — e é por isso que
 * a conferência de verdade é refeita no fechamento, não aqui.
 */
export async function listarItensComSaldo(
  contratoId: string,
): Promise<ItemComSaldo[]> {
  const supabase = await createClient();

  const { data: locados, error } = await supabase
    .from("item_locado")
    .select(
      "id, item_id, quantidade, unidade_id, item:item_id(descricao, controle), unidade:unidade_id(identificador)",
    )
    .eq("contrato_id", contratoId)
    .order("created_at");

  if (error) {
    console.error("listarItensComSaldo", error);
    return [];
  }

  const ids = (locados ?? []).map((l) => l.id);
  if (ids.length === 0) return [];

  const { data: movs, error: erroMovs } = await supabase
    .from("movimentacao")
    .select("item_locado_id, quantidade")
    .in("item_locado_id", ids)
    .eq("tipo", "devolucao");

  // Erro aqui não pode virar lista vazia nem `devolvido = 0`: com zero, a tela
  // ofereceria o saldo CHEIO de itens que já voltaram, e o fechamento
  // recusaria tudo sem que ninguém entendesse por quê. Melhor a lista vazia com
  // o erro no log do que um saldo inventado.
  if (erroMovs) {
    console.error("listarItensComSaldo.movimentacoes", erroMovs);
    return [];
  }

  const devolvidoPor = new Map<string, number>();
  for (const m of movs ?? []) {
    devolvidoPor.set(
      m.item_locado_id,
      (devolvidoPor.get(m.item_locado_id) ?? 0) + Number(m.quantidade),
    );
  }

  return (locados ?? []).map((l) => {
    const item = achatar(l.item as unknown as { descricao: string; controle: string } | null);
    const un = achatar(l.unidade as unknown as { identificador: string } | null);
    const contratado = Number(l.quantidade);
    const devolvido = devolvidoPor.get(l.id) ?? 0;
    return {
      item_locado_id: l.id,
      item_id: l.item_id,
      descricao: item?.descricao ?? "Item",
      controle: (item?.controle as "peca" | "quantidade") ?? "quantidade",
      unidade_id: l.unidade_id,
      unidade_identificador: un?.identificador ?? null,
      contratado,
      devolvido,
      // `Math.max(0, …)` porque devolução lançada à mão antes do documento pode
      // ter passado do contratado. Saldo negativo na tela seria lido como
      // crédito, e não é: é inconsistência antiga que não se conserta aqui.
      saldo: Math.max(0, contratado - devolvido),
    };
  });
}

// ---------------------------------------------------------------------------
// Listagem da organização
// ---------------------------------------------------------------------------
// `listarDevolucoes` é POR CONTRATO e alimenta a seção do contrato. Esta é a
// visão da organização, e o que ela responde e nenhuma outra responde: quais
// devoluções ficaram em RASCUNHO. Rascunho é conferência que ninguém fechou —
// não gerou número, não baixou saldo e não avisou o fornecedor. O contrato
// segue cobrando diária de equipamento que já voltou.
//
// O recorte por obra continua na RLS (migration 0064): esta função não filtra
// por obra por conta própria, e é de propósito.

export type DevolucaoDaOrganizacao = {
  id: string;
  numeroRegistro: string | null;
  devolvidoEm: string;
  status: string;
  responsavel: string | null;
  notaFornecedor: string | null;
  avisoEnviadoEm: string | null;
  contratoId: string;
  contratoNumero: string | null;
  obraRotulo: string | null;
  fornecedorNome: string | null;
  itens: number;
};

export type FiltrosDevolucao = {
  obra?: string;
  status?: string;
  q?: string;
  from?: number;
  to?: number;
};

export async function listarDevolucoesDaOrganizacao(
  f: FiltrosDevolucao = {},
): Promise<{ linhas: DevolucaoDaOrganizacao[]; total: number }> {
  const supabase = await createClient();

  // O filtro por obra atravessa o contrato, porque `devolucao` não guarda
  // `obra_id`. Resolvido em DUAS consultas, e não com `contrato!inner` mais
  // `.eq("contrato.obra_id", …)`: o `!inner` muda a cardinalidade do embed em
  // silêncio, e o cliente tipado recusa filtro por coluna de relação — o que
  // degrada a linha inteira para `GenericStringError` e derruba o typecheck
  // num lugar que não tem nada a ver com a causa.
  let contratosDaObra: string[] | null = null;
  if (f.obra) {
    const { data: cs, error: erroCs } = await supabase
      .from("contrato_locacao")
      .select("id")
      .eq("obra_id", f.obra);
    if (erroCs) {
      console.error("listarDevolucoesDaOrganizacao.contratos", erroCs);
      return { linhas: [], total: 0 };
    }
    contratosDaObra = (cs ?? []).map((c) => c.id);
    // Obra sem contrato nenhum não tem devolução — e um `.in` com lista vazia
    // no PostgREST não filtra nada, ele traz TUDO.
    if (contratosDaObra.length === 0) return { linhas: [], total: 0 };
  }

  let q = supabase
    .from("devolucao")
    // Uma STRING LITERAL só, sem concatenar com `+`: o cliente tipado do
    // Supabase analisa o select no nível de tipo, e isso exige um literal.
    // Concatenação produz `string`, o parser desiste e cada linha volta como
    // `GenericStringError`.
    .select(
      "id, numero_registro, devolvido_em, status, responsavel, nota_fornecedor, aviso_enviado_em, contrato:contrato_id(id, numero, obra:obra_id(id, codigo, nome)), fornecedor:fornecedor_id(nome), devolucao_item(count)",
      { count: "exact" },
    )
    .order("devolvido_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (contratosDaObra) q = q.in("contrato_id", contratosDaObra);
  // `termoOr` e não interpolação à mão: vírgula e parêntese são a GRAMÁTICA do
  // `.or()` do PostgREST, então um termo com vírgula viraria outro filtro.
  if (f.q) {
    q = q.or(termoOr(["numero_registro", "nota_fornecedor", "responsavel"], f.q));
  }
  if (typeof f.from === "number" && typeof f.to === "number") {
    q = q.range(f.from, f.to);
  }

  const { data, error, count } = await q;

  // Erro em leitura de lista: registra e devolve vazio (ver AGENTS.md).
  if (error) {
    console.error("listarDevolucoesDaOrganizacao", error);
    return { linhas: [], total: 0 };
  }

  const linhas = (data ?? []).map((d) => {
    const contrato = achatar(
      d.contrato as unknown as {
        id: string;
        numero: string | null;
        obra:
          | { id: string; codigo: string; nome: string }
          | { id: string; codigo: string; nome: string }[]
          | null;
      } | null,
    );
    const obra = achatar(
      (contrato?.obra ?? null) as
        | { id: string; codigo: string; nome: string }
        | { id: string; codigo: string; nome: string }[]
        | null,
    );
    const fornecedor = achatar(d.fornecedor as unknown as { nome: string } | null);
    const contagemItens = achatar(
      d.devolucao_item as unknown as { count: number } | null,
    );

    return {
      id: d.id,
      numeroRegistro: d.numero_registro,
      devolvidoEm: d.devolvido_em,
      status: d.status,
      responsavel: d.responsavel,
      notaFornecedor: d.nota_fornecedor,
      avisoEnviadoEm: d.aviso_enviado_em,
      contratoId: contrato?.id ?? "",
      contratoNumero: contrato?.numero ?? null,
      obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
      fornecedorNome: fornecedor?.nome ?? null,
      itens: contagemItens?.count ?? 0,
    };
  });

  return { linhas, total: count ?? linhas.length };
}
