import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";

// Leituras da ordem de reparo de equipamento.
//
// `createClient()`, nunca `createAdminClient()`. O recorte da tabela é o da
// ORGANIZAÇÃO (uma peça circula entre obras), e ele vive na RLS da migration
// 0068 — um client admin faria a organização A enxergar os reparos da B.

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const SELECT_REPARO =
  "id, numero_registro, status, descricao, executor, aberto_em, enviado_em, previsto_para, concluido_em, valor, responsabilidade, garantia_dias, observacoes, avaria_id, unidade_id, unidade:unidade_id(identificador, situacao, item:item_id(descricao)), avaria:avaria_id(numero_registro, descricao)";

export type ReparoCompleto = {
  id: string;
  numero_registro: string | null;
  status: string;
  descricao: string;
  executor: string | null;
  aberto_em: string;
  enviado_em: string | null;
  previsto_para: string | null;
  concluido_em: string | null;
  valor: number;
  responsabilidade: string;
  garantia_dias: number | null;
  observacoes: string | null;
  avaria_id: string | null;
  unidade_id: string;
  unidadeIdentificador: string | null;
  unidadeSituacao: string | null;
  itemDescricao: string | null;
  avariaNumero: string | null;
  avariaDescricao: string | null;
};

type LinhaBruta = {
  id: string;
  numero_registro: string | null;
  status: string;
  descricao: string;
  executor: string | null;
  aberto_em: string;
  enviado_em: string | null;
  previsto_para: string | null;
  concluido_em: string | null;
  valor: string | number;
  responsabilidade: string;
  garantia_dias: number | null;
  observacoes: string | null;
  avaria_id: string | null;
  unidade_id: string;
  unidade: unknown;
  avaria: unknown;
};

function montar(r: LinhaBruta): ReparoCompleto {
  const un = achatar(
    r.unidade as {
      identificador: string;
      situacao: string;
      item: { descricao: string } | { descricao: string }[] | null;
    } | null,
  );
  const item = achatar(un?.item ?? null);
  const av = achatar(
    r.avaria as { numero_registro: string | null; descricao: string } | null,
  );
  return {
    id: r.id,
    numero_registro: r.numero_registro,
    status: r.status,
    descricao: r.descricao,
    executor: r.executor,
    aberto_em: r.aberto_em,
    enviado_em: r.enviado_em,
    previsto_para: r.previsto_para,
    concluido_em: r.concluido_em,
    valor: Number(r.valor),
    responsabilidade: r.responsabilidade,
    garantia_dias: r.garantia_dias,
    observacoes: r.observacoes,
    avaria_id: r.avaria_id,
    unidade_id: r.unidade_id,
    unidadeIdentificador: un?.identificador ?? null,
    unidadeSituacao: un?.situacao ?? null,
    itemDescricao: item?.descricao ?? null,
    avariaNumero: av?.numero_registro ?? null,
    avariaDescricao: av?.descricao ?? null,
  };
}

export async function buscarReparo(id: string): Promise<ReparoCompleto | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(SELECT_REPARO)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return montar(data as unknown as LinhaBruta);
}

/** Reparos de uma peça — a aba de manutenção da peça, na frota. */
export async function listarReparosDaPeca(
  unidadeId: string,
): Promise<ReparoCompleto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(SELECT_REPARO)
    .eq("unidade_id", unidadeId)
    .order("aberto_em", { ascending: false });

  if (error) {
    console.error("listarReparosDaPeca", error);
    return [];
  }
  return (data ?? []).map((r) => montar(r as unknown as LinhaBruta));
}

// ---------------------------------------------------------------------------
// Listagem da organização
// ---------------------------------------------------------------------------

export type FiltrosReparo = {
  status?: string;
  responsabilidade?: string;
  q?: string;
  from?: number;
  to?: number;
};

/**
 * O que esta tela responde: quais peças estão FORA e há quanto tempo.
 *
 * Antes dela, equipamento que saía para conserto sumia: a peça ficava marcada
 * como "manutenção" — um estado sem prazo, sem custo e sem quem está com ela.
 */
export async function listarReparosDaOrganizacao(
  f: FiltrosReparo = {},
): Promise<{ linhas: ReparoCompleto[]; total: number }> {
  const supabase = await createClient();

  let q = supabase
    .from("reparo_equipamento")
    // Uma STRING LITERAL só: o cliente tipado do Supabase analisa o select no
    // nível de tipo, e concatenação produz `string` — o parser desiste e cada
    // linha volta como `GenericStringError`.
    .select(
      "id, numero_registro, status, descricao, executor, aberto_em, enviado_em, previsto_para, concluido_em, valor, responsabilidade, garantia_dias, observacoes, avaria_id, unidade_id, unidade:unidade_id(identificador, situacao, item:item_id(descricao)), avaria:avaria_id(numero_registro, descricao)",
      { count: "exact" },
    )
    .order("aberto_em", { ascending: false })
    .order("created_at", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (f.responsabilidade) q = q.eq("responsabilidade", f.responsabilidade);
  // `termoOr` e não interpolação à mão: vírgula e parêntese são a GRAMÁTICA do
  // `.or()` do PostgREST, então um termo com vírgula viraria outro filtro.
  if (f.q) q = q.or(termoOr(["numero_registro", "descricao", "executor"], f.q));
  if (typeof f.from === "number" && typeof f.to === "number") {
    q = q.range(f.from, f.to);
  }

  const { data, error, count } = await q;

  // Erro em leitura de lista: registra e devolve vazio (ver AGENTS.md).
  if (error) {
    console.error("listarReparosDaOrganizacao", error);
    return { linhas: [], total: 0 };
  }

  const linhas = (data ?? []).map((r) => montar(r as unknown as LinhaBruta));
  return { linhas, total: count ?? linhas.length };
}

// ---------------------------------------------------------------------------
// Peças disponíveis para abrir uma ordem
// ---------------------------------------------------------------------------

export type PecaParaReparo = {
  id: string;
  identificador: string;
  descricao: string;
  situacao: string;
};

/**
 * Peças ativas da organização.
 *
 * Inclui as que já estão em manutenção de propósito: uma peça pode precisar de
 * uma segunda ordem (o primeiro conserto não resolveu), e escondê-la obrigaria
 * a fechar a ordem anterior para poder abrir a nova — encerrando um serviço que
 * não terminou.
 */
export async function listarPecasParaReparo(): Promise<PecaParaReparo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select("id, identificador, situacao, item:item_id(descricao)")
    .eq("ativo", true)
    .order("identificador");

  if (error) {
    console.error("listarPecasParaReparo", error);
    return [];
  }

  return (data ?? []).map((u) => {
    const item = achatar(u.item as unknown as { descricao: string } | null);
    return {
      id: u.id,
      identificador: u.identificador,
      descricao: item?.descricao ?? "Item",
      situacao: u.situacao,
    };
  });
}
