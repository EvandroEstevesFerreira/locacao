import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";

// Leituras da avaria de equipamento.
//
// `createClient()`, nunca `createAdminClient()`. A avaria herda o recorte da
// vistoria, que herda o do contrato — e tudo isso vive na RLS. Um `.from(...)`
// com client admin faria a obra A enxergar as avarias da obra B em silêncio.

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type AvariaCompleta = {
  id: string;
  numero_registro: string | null;
  descricao: string;
  laudo: string | null;
  data: string;
  custo_estimado: number;
  status: string;
  responsabilidade: string;
  unidade_id: string | null;
  unidade_identificador: string | null;
  lancamento_id: string | null;
  vistoria_id: string;
  devolucao: { id: string; numero_registro: string | null } | null;
  contrato: {
    id: string;
    numero: string;
    numero_registro: string | null;
    obra: { codigo: string; nome: string } | null;
  } | null;
  fornecedor: { nome: string } | null;
};

/**
 * Uma avaria completa, com o caminho até a obra.
 *
 * O contrato vem pela vistoria — `avaria` não guarda `contrato_id`. É por ele
 * que o laudo sabe a obra e o fornecedor, que são os dois lados da conversa
 * sobre quem paga.
 */
export async function buscarAvaria(id: string): Promise<AvariaCompleta | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaria")
    .select(
      "*, unidade:unidade_id(identificador), devolucao:devolucao_id(id, numero_registro), vistoria:vistoria_id(contrato:contrato_id(id, numero, numero_registro, obra:obra_id(codigo, nome), fornecedor:fornecedor_id(nome)))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const vistoria = achatar(
    data.vistoria as unknown as {
      contrato:
        | {
            id: string;
            numero: string;
            numero_registro: string | null;
            obra: { codigo: string; nome: string } | { codigo: string; nome: string }[] | null;
            fornecedor: { nome: string } | { nome: string }[] | null;
          }
        | null;
    } | null,
  );
  const contratoBruto = achatar(vistoria?.contrato ?? null);
  const un = achatar(data.unidade as unknown as { identificador: string } | null);

  return {
    id: data.id,
    numero_registro: data.numero_registro,
    descricao: data.descricao,
    laudo: data.laudo,
    data: data.data,
    custo_estimado: Number(data.custo_estimado),
    status: data.status,
    responsabilidade: data.responsabilidade,
    unidade_id: data.unidade_id,
    unidade_identificador: un?.identificador ?? null,
    lancamento_id: data.lancamento_id,
    vistoria_id: data.vistoria_id,
    devolucao: achatar(
      data.devolucao as unknown as { id: string; numero_registro: string | null } | null,
    ),
    contrato: contratoBruto
      ? {
          id: contratoBruto.id,
          numero: contratoBruto.numero,
          numero_registro: contratoBruto.numero_registro,
          obra: achatar(contratoBruto.obra),
        }
      : null,
    fornecedor: achatar(contratoBruto?.fornecedor ?? null),
  };
}

/**
 * As peças do contrato de uma avaria, para o seletor do laudo.
 *
 * Restrito ao contrato de propósito: oferecer o patrimônio inteiro da
 * organização permitiria apontar, num laudo que vai ao fornecedor A, uma peça
 * que está alugada do fornecedor B.
 */
export type PecaDoContrato = { id: string; identificador: string; descricao: string };

export async function listarPecasDoContrato(
  contratoId: string,
): Promise<PecaDoContrato[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_locado")
    .select("unidade_id, unidade:unidade_id(identificador), item:item_id(descricao)")
    .eq("contrato_id", contratoId)
    .not("unidade_id", "is", null);

  if (error) {
    console.error("listarPecasDoContrato", error);
    return [];
  }

  const vistos = new Set<string>();
  const linhas: PecaDoContrato[] = [];
  for (const l of data ?? []) {
    const un = achatar(l.unidade as unknown as { identificador: string } | null);
    const item = achatar(l.item as unknown as { descricao: string } | null);
    if (!l.unidade_id || vistos.has(l.unidade_id)) continue;
    vistos.add(l.unidade_id);
    linhas.push({
      id: l.unidade_id,
      identificador: un?.identificador ?? "—",
      descricao: item?.descricao ?? "Item",
    });
  }
  return linhas;
}

// ---------------------------------------------------------------------------
// Listagem da organização
// ---------------------------------------------------------------------------

export type AvariaDaOrganizacao = {
  id: string;
  numeroRegistro: string | null;
  descricao: string;
  data: string;
  custoEstimado: number;
  status: string;
  responsabilidade: string;
  temLaudo: boolean;
  unidadeIdentificador: string | null;
  obraRotulo: string | null;
  fornecedorNome: string | null;
};

export type FiltrosAvaria = {
  status?: string;
  responsabilidade?: string;
  q?: string;
  from?: number;
  to?: number;
};

/**
 * Avarias da organização inteira.
 *
 * O que esta tela responde e nenhuma outra respondia: quais avarias estão
 * ABERTAS e ainda A APURAR. A avaria nascia dentro de uma vistoria e só era
 * encontrada por quem abrisse a vistoria certa — de modo que um dano de dois
 * mil reais podia ficar sem desfecho por meses sem aparecer em lugar nenhum.
 */
export async function listarAvariasDaOrganizacao(
  f: FiltrosAvaria = {},
): Promise<{ linhas: AvariaDaOrganizacao[]; total: number }> {
  const supabase = await createClient();

  let q = supabase
    .from("avaria")
    // Uma STRING LITERAL só, sem concatenar: o cliente tipado do Supabase
    // analisa o select no nível de tipo, e concatenação produz `string` — o
    // parser desiste e cada linha volta como `GenericStringError`.
    .select(
      "id, numero_registro, descricao, laudo, data, custo_estimado, status, responsabilidade, unidade:unidade_id(identificador), vistoria:vistoria_id(contrato:contrato_id(obra:obra_id(codigo, nome), fornecedor:fornecedor_id(nome)))",
      { count: "exact" },
    )
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });

  if (f.status) q = q.eq("status", f.status);
  if (f.responsabilidade) q = q.eq("responsabilidade", f.responsabilidade);
  // `termoOr` e não interpolação à mão: vírgula e parêntese são a GRAMÁTICA do
  // `.or()` do PostgREST, então um termo com vírgula viraria outro filtro.
  if (f.q) q = q.or(termoOr(["numero_registro", "descricao"], f.q));
  if (typeof f.from === "number" && typeof f.to === "number") {
    q = q.range(f.from, f.to);
  }

  const { data, error, count } = await q;

  // Erro em leitura de lista: registra e devolve vazio (ver AGENTS.md).
  if (error) {
    console.error("listarAvariasDaOrganizacao", error);
    return { linhas: [], total: 0 };
  }

  const linhas = (data ?? []).map((a) => {
    const vistoria = achatar(
      a.vistoria as unknown as {
        contrato:
          | {
              obra: { codigo: string; nome: string } | { codigo: string; nome: string }[] | null;
              fornecedor: { nome: string } | { nome: string }[] | null;
            }
          | null;
      } | null,
    );
    const contrato = achatar(vistoria?.contrato ?? null);
    const obra = achatar(contrato?.obra ?? null);
    const forn = achatar(contrato?.fornecedor ?? null);
    const un = achatar(a.unidade as unknown as { identificador: string } | null);

    return {
      id: a.id,
      numeroRegistro: a.numero_registro,
      descricao: a.descricao,
      data: a.data,
      custoEstimado: Number(a.custo_estimado),
      status: a.status,
      responsabilidade: a.responsabilidade,
      // O texto do laudo não vem para a listagem — só se ele existe. Trazer
      // quatro mil caracteres por linha para desenhar um ponto na tela
      // multiplicaria o payload por nada.
      temLaudo: Boolean(a.laudo && String(a.laudo).trim().length > 0),
      unidadeIdentificador: un?.identificador ?? null,
      obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
      fornecedorNome: forn?.nome ?? null,
    };
  });

  return { linhas, total: count ?? linhas.length };
}
