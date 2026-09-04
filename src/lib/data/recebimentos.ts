import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";

// Leituras do recebimento de equipamento.
//
// `createClient()`, nunca `createAdminClient()`. O recorte por obra do
// recebimento vive na RLS (migration 0049, via `obra_do_contrato`): um
// `.from(...)` com client admin faria a obra A enxergar os recebimentos da obra
// B em silêncio, e nenhum teste pegaria.

export type RecebimentoLista = {
  id: string;
  numero_registro: string | null;
  recebido_em: string;
  status: string;
  conferente: string | null;
  nota_fornecedor: string | null;
  aviso_enviado_em: string | null;
  documento_path: string | null;
  itens: number;
};

export type RecebimentoItemLinha = {
  id: string;
  item_locado_id: string | null;
  item_id: string;
  item_descricao: string;
  controle: "peca" | "quantidade";
  unidade_id: string | null;
  unidade_identificador: string | null;
  quantidade: number;
  condicao: string;
  observacoes: string | null;
};

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/**
 * Recebimentos de um contrato, do mais recente para o mais antigo.
 *
 * `recebimento_item(count)` em vez de trazer as linhas: a listagem só precisa
 * de quantos itens são, e puxar todos multiplicaria o payload por nada.
 */
export async function listarRecebimentos(
  contratoId: string,
): Promise<RecebimentoLista[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recebimento")
    .select(
      "id, numero_registro, recebido_em, status, conferente, nota_fornecedor, aviso_enviado_em, documento_path, recebimento_item(count)",
    )
    .eq("contrato_id", contratoId)
    .order("recebido_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("listarRecebimentos", error);
    return [];
  }

  return (data ?? []).map((r) => {
    const c = r.recebimento_item as { count: number }[] | null;
    return {
      id: r.id,
      numero_registro: r.numero_registro,
      recebido_em: r.recebido_em,
      status: r.status,
      conferente: r.conferente,
      nota_fornecedor: r.nota_fornecedor,
      aviso_enviado_em: r.aviso_enviado_em,
      documento_path: r.documento_path,
      itens: c?.[0]?.count ?? 0,
    };
  });
}

/**
 * Um recebimento completo, com itens.
 *
 * Devolve `null` quando não existe ou quando o usuário não pode lê-lo — a
 * policy esconde a linha, e a página chama `notFound()` nos dois casos sem
 * distinguir.
 */
export type RecebimentoCompleto = {
  id: string;
  numero_registro: string | null;
  recebido_em: string;
  status: string;
  conferente: string | null;
  nota_fornecedor: string | null;
  observacoes: string | null;
  fechado_em: string | null;
  aviso_enviado_em: string | null;
  documento_path: string | null;
  contrato: {
    id: string;
    numero: string;
    numero_registro: string | null;
    obra: { codigo: string; nome: string } | null;
  } | null;
  fornecedor: { nome: string; contato_email: string | null } | null;
  itens: RecebimentoItemLinha[];
};

export async function buscarRecebimento(
  id: string,
): Promise<RecebimentoCompleto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recebimento")
    .select(
      "*, contrato:contrato_id(id, numero, numero_registro, obra:obra_id(codigo, nome)), fornecedor:fornecedor_id(nome, contato_email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { data: itensRaw, error: erroItens } = await supabase
    .from("recebimento_item")
    .select(
      "id, item_locado_id, item_id, unidade_id, quantidade, condicao, observacoes, item:item_id(descricao, controle), unidade:unidade_id(identificador)",
    )
    .eq("recebimento_id", id)
    .order("created_at");

  if (erroItens) console.error("buscarRecebimento.itens", erroItens);

  const itens: RecebimentoItemLinha[] = (itensRaw ?? []).map((i) => {
    const item = achatar(i.item as unknown as { descricao: string; controle: string } | null);
    const un = achatar(i.unidade as unknown as { identificador: string } | null);
    return {
      id: i.id,
      item_locado_id: i.item_locado_id,
      item_id: i.item_id,
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
    recebido_em: data.recebido_em,
    status: data.status,
    conferente: data.conferente,
    nota_fornecedor: data.nota_fornecedor,
    observacoes: data.observacoes,
    fechado_em: data.fechado_em,
    aviso_enviado_em: data.aviso_enviado_em,
    documento_path: data.documento_path,
    contrato: contratoBruto
      ? { ...contratoBruto, obra: achatar(contratoBruto.obra) }
      : null,
    fornecedor: achatar(
      data.fornecedor as unknown as { nome: string; contato_email: string | null } | null,
    ),
    itens,
  };
}

export type ItemContratado = {
  item_locado_id: string;
  item_id: string;
  descricao: string;
  controle: "peca" | "quantidade";
  quantidade: number;
  unidade_id: string | null;
};

/**
 * O que o contrato prevê — a base do formulário de recebimento.
 *
 * O conferente confirma estas linhas; a divergência (algo que chegou fora do
 * contrato) é lançada à parte, com `item_locado_id` nulo.
 */
export async function listarItensDoContrato(
  contratoId: string,
): Promise<ItemContratado[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_locado")
    .select("id, item_id, quantidade, unidade_id, item:item_id(descricao, controle)")
    .eq("contrato_id", contratoId)
    .order("created_at");

  if (error) {
    console.error("listarItensDoContrato", error);
    return [];
  }

  return (data ?? []).map((l) => {
    const item = achatar(l.item as unknown as { descricao: string; controle: string } | null);
    return {
      item_locado_id: l.id,
      item_id: l.item_id,
      descricao: item?.descricao ?? "Item",
      controle: (item?.controle as "peca" | "quantidade") ?? "quantidade",
      quantidade: Number(l.quantidade),
      unidade_id: l.unidade_id,
    };
  });
}

export type UnidadeDisponivel = { id: string; identificador: string; item_id: string };

/** Peças de patrimônio ativas, para o seletor dos itens controlados por peça. */
export async function listarUnidades(): Promise<UnidadeDisponivel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select("id, identificador, item_id")
    .eq("ativo", true)
    .order("identificador");

  if (error) {
    console.error("listarUnidades", error);
    return [];
  }
  return (data ?? []) as UnidadeDisponivel[];
}

// ---------------------------------------------------------------------------
// Listagem da organização
// ---------------------------------------------------------------------------
// `listarRecebimentos` é POR CONTRATO, e alimenta a seção do contrato. Faltava
// a visão da organização — e o item "Recebimentos" do menu apontava para uma
// rota sem página desde a 0.39.0, porque a pasta existia só com `[id]`.
//
// O recorte por obra continua na RLS (migration 0049, via `obra_do_contrato`):
// esta função não filtra por obra por conta própria, e é de propósito.

export type RecebimentoDaOrganizacao = {
  id: string;
  numeroRegistro: string | null;
  recebidoEm: string;
  status: string;
  conferente: string | null;
  notaFornecedor: string | null;
  contratoId: string;
  contratoNumero: string | null;
  obraRotulo: string | null;
  fornecedorNome: string | null;
  itens: number;
};

export type FiltrosRecebimento = {
  obra?: string;
  status?: string;
  q?: string;
  from?: number;
  to?: number;
};

export async function listarRecebimentosDaOrganizacao(
  f: FiltrosRecebimento = {},
): Promise<{ linhas: RecebimentoDaOrganizacao[]; total: number }> {
  const supabase = await createClient();

  // O filtro por obra atravessa o contrato, porque `recebimento` não guarda
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
      console.error("listarRecebimentosDaOrganizacao.contratos", erroCs);
      return { linhas: [], total: 0 };
    }
    contratosDaObra = (cs ?? []).map((c) => c.id);
    // Obra sem contrato nenhum não tem recebimento — e um `.in` com lista
    // vazia no PostgREST não filtra nada, ele traz TUDO.
    if (contratosDaObra.length === 0) return { linhas: [], total: 0 };
  }

  let q = supabase
    .from("recebimento")
    // Uma STRING LITERAL só, sem concatenar com `+`: o cliente tipado do
    // Supabase analisa o select no nível de tipo, e isso exige um literal.
    // Concatenação produz `string`, o parser desiste e cada linha volta como
    // `GenericStringError` — o typecheck então acusa "propriedade não existe"
    // em toda a função de mapeamento, longe da causa real.
    .select(
      "id, numero_registro, recebido_em, status, conferente, nota_fornecedor, contrato:contrato_id(id, numero, obra:obra_id(id, codigo, nome)), fornecedor:fornecedor_id(nome), recebimento_item(count)",
      { count: "exact" },
    )
    .order("recebido_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (contratosDaObra) q = q.in("contrato_id", contratosDaObra);
  // `termoOr` e não interpolação à mão: vírgula e parêntese são a GRAMÁTICA do
  // `.or()` do PostgREST, então um termo com vírgula viraria outro filtro.
  if (f.q) {
    q = q.or(termoOr(["numero_registro", "nota_fornecedor", "conferente"], f.q));
  }
  if (typeof f.from === "number" && typeof f.to === "number") {
    q = q.range(f.from, f.to);
  }

  const { data, error, count } = await q;

  // Erro em leitura de lista: registra e devolve vazio (ver AGENTS.md).
  if (error) {
    console.error("listarRecebimentosDaOrganizacao", error);
    return { linhas: [], total: 0 };
  }

  const linhas = (data ?? []).map((r) => {
    const contrato = achatar(
      r.contrato as unknown as {
        id: string;
        numero: string | null;
        obra: { id: string; codigo: string; nome: string } | { id: string; codigo: string; nome: string }[] | null;
      } | null,
    );
    const obra = achatar(
      (contrato?.obra ?? null) as { id: string; codigo: string; nome: string } | { id: string; codigo: string; nome: string }[] | null,
    );
    const fornecedor = achatar(r.fornecedor as unknown as { nome: string } | null);
    const contagemItens = achatar(
      r.recebimento_item as unknown as { count: number } | null,
    );

    return {
      id: r.id,
      numeroRegistro: r.numero_registro,
      recebidoEm: r.recebido_em,
      status: r.status,
      conferente: r.conferente,
      notaFornecedor: r.nota_fornecedor,
      contratoId: contrato?.id ?? "",
      contratoNumero: contrato?.numero ?? null,
      obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
      fornecedorNome: fornecedor?.nome ?? null,
      itens: contagemItens?.count ?? 0,
    };
  });

  return { linhas, total: count ?? linhas.length };
}
