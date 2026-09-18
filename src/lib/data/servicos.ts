import "server-only";

import { createClient } from "@/lib/supabase/server";
import { termoOr } from "@/lib/lista";
import type { ListaParams, Pagina } from "./lista-params";
import type { CategoriaServico } from "@/lib/servicos";
import { totalDoPeriodoCentavos } from "@/lib/servicos";
import { ratearPorCabeca, type Atribuicao, type Rateio } from "@/lib/servicos/rateio";

/** Uma linha da listagem de serviços. */
export type ServicoListItem = {
  id: string;
  nome: string;
  categoria: CategoriaServico;
  quantidade: number;
  atribuidas: number;
  totalCentavos: number;
  conferido_em: string | null;
  status: string;
};

/**
 * Lista de contratos de serviço, com a contagem de licenças em uso.
 *
 * A contagem NÃO sai de um `!inner` nem de um join simples: os dois mudariam a
 * cardinalidade e a linha do contrato apareceria uma vez por atribuição — o
 * `AGENTS.md` avisa exatamente sobre isso ao mover query para `data/`. Sai de
 * `count` agregado numa segunda consulta, pelos ids da página.
 *
 * São duas consultas de propósito. A alternativa (view com
 * `security_invoker = on`) economizaria uma ida ao banco e custaria uma view a
 * manter; com PAGE_SIZE linhas por página, a segunda consulta é por um `in` de
 * poucos ids.
 *
 * Em erro devolve lista vazia e loga — filtro sem opções simplesmente não
 * aparece, e a tela continua utilizável.
 */
export async function listarServicos(
  p: ListaParams,
  categoria?: CategoriaServico,
): Promise<Pagina<ServicoListItem>> {
  const supabase = await createClient();

  let query = supabase
    .from("contrato_servico")
    .select(
      "id, nome, categoria, quantidade, valor_unitario_centavos, conferido_em, status",
      { count: "exact" },
    )
    .is("deleted_at", null);

  if (p.q) query = query.or(termoOr(["nome"], p.q));
  if (categoria) query = query.eq("categoria", categoria);

  const { data, count, error } = await query
    .order(p.sort, { ascending: p.ascending })
    .range(p.from, p.to);

  if (error) {
    console.error("listarServicos", error.message);
    return { itens: [], total: 0 };
  }

  const linhas = data ?? [];
  const ids = linhas.map((l) => l.id);
  const emUso = await contarAtribuicoesAbertas(ids);

  return {
    itens: linhas.map((l) => ({
      id: l.id,
      nome: l.nome,
      categoria: l.categoria as CategoriaServico,
      quantidade: l.quantidade,
      atribuidas: emUso.get(l.id) ?? 0,
      totalCentavos: totalDoPeriodoCentavos(l.quantidade, l.valor_unitario_centavos),
      conferido_em: l.conferido_em,
      status: l.status,
    })),
    total: count ?? 0,
  };
}

/**
 * Quantas licenças de cada contrato estão em uso agora.
 *
 * "Agora" é `removido_em is null` — a atribuição devolvida continua na tabela
 * como histórico, e contá-la faria o total passar das contratadas e
 * `ratearPorCabeca` levantar exceção na tela.
 */
async function contarAtribuicoesAbertas(ids: string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("atribuicao_servico")
    .select("contrato_id")
    .in("contrato_id", ids)
    .is("removido_em", null);

  if (error) {
    console.error("contarAtribuicoesAbertas", error.message);
    return new Map();
  }

  const mapa = new Map<string, number>();
  for (const a of data ?? []) {
    mapa.set(a.contrato_id, (mapa.get(a.contrato_id) ?? 0) + 1);
  }
  return mapa;
}

export type AtribuicaoDetalhe = {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  centro_custo_id: string | null;
  centro_custo_nome: string | null;
  atribuido_em: string;
};

export type ServicoDetalhe = {
  id: string;
  nome: string;
  categoria: CategoriaServico;
  fornecedor_id: string;
  fornecedor_nome: string | null;
  quantidade: number;
  valor_unitario_centavos: number;
  totalCentavos: number;
  cadencia: string;
  data_inicio: string;
  data_fim: string | null;
  renova_automaticamente: boolean;
  conferido_em: string | null;
  status: string;
  observacoes: string | null;
  atribuicoes: AtribuicaoDetalhe[];
  rateio: Rateio;
};

/**
 * A ficha de um contrato de serviço, com as atribuições abertas e o rateio.
 *
 * Erro ou ausência devolvem `null`, e a página chama `notFound()`.
 *
 * **O rateio é calculado aqui, nunca lido.** Uma tabela de rateio congelado
 * divergiria da atribuição no primeiro desligamento, e um custo mensal que não
 * bate com a lista de pessoas é um número que ninguém consegue explicar.
 *
 * O tipo de retorno é PLANO de propósito: o PostgREST devolve `T | T[] | null`
 * para relação embutida, e expor essa ambiguidade contaminaria toda a tela.
 */
export async function obterServico(id: string): Promise<ServicoDetalhe | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contrato_servico")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("obterServico", error.message);
    return null;
  }
  const c = data as unknown as Record<string, never> & ContratoBruto;

  const { data: forn } = await supabase
    .from("fornecedor")
    .select("nome")
    .eq("id", c.fornecedor_id)
    .maybeSingle();

  const atribuicoes = await listarAtribuicoesAbertas(id);

  const total = totalDoPeriodoCentavos(c.quantidade, c.valor_unitario_centavos);

  const paraRateio: Atribuicao[] = atribuicoes.map((a) => ({
    funcionarioId: a.funcionario_id,
    centroCustoId: a.centro_custo_id,
  }));

  return {
    id: c.id,
    nome: c.nome,
    categoria: c.categoria as CategoriaServico,
    fornecedor_id: c.fornecedor_id,
    fornecedor_nome: (forn as { nome: string } | null)?.nome ?? null,
    quantidade: c.quantidade,
    valor_unitario_centavos: c.valor_unitario_centavos,
    totalCentavos: total,
    cadencia: c.cadencia,
    data_inicio: c.data_inicio,
    data_fim: c.data_fim,
    renova_automaticamente: c.renova_automaticamente,
    conferido_em: c.conferido_em,
    status: c.status,
    observacoes: c.observacoes,
    atribuicoes,
    rateio: ratearPorCabeca(total, c.quantidade, paraRateio),
  };
}

type ContratoBruto = {
  id: string;
  nome: string;
  categoria: string;
  fornecedor_id: string;
  quantidade: number;
  valor_unitario_centavos: number;
  cadencia: string;
  data_inicio: string;
  data_fim: string | null;
  renova_automaticamente: boolean;
  conferido_em: string | null;
  status: string;
  observacoes: string | null;
};

/**
 * As atribuicoes abertas de um contrato, com o centro de custo de cada pessoa.
 *
 * TRES consultas rasas em vez de um `select` com relacao embutida em dois
 * niveis (`funcionario:funcionario_id(nome, obra:obra_id(nome))`). O aninhado
 * seria uma ida ao banco a menos e traria de volta a ambiguidade
 * `T | T[] | null` do PostgREST, que o AGENTS.md manda nao expor -- e que aqui
 * apareceria DUAS vezes, uma por nivel.
 *
 * O numero de licencas de um contrato e da ordem de dezenas, entao as tres
 * consultas sao por `in` de poucos ids.
 */
async function listarAtribuicoesAbertas(
  contratoId: string,
): Promise<AtribuicaoDetalhe[]> {
  const supabase = await createClient();

  const { data: atrib, error } = await supabase
    .from("atribuicao_servico")
    .select("id, funcionario_id, atribuido_em")
    .eq("contrato_id", contratoId)
    .is("removido_em", null)
    .order("atribuido_em");

  if (error) {
    console.error("listarAtribuicoesAbertas", error.message);
    return [];
  }

  const linhas = (atrib ?? []) as unknown as {
    id: string;
    funcionario_id: string;
    atribuido_em: string;
  }[];
  if (linhas.length === 0) return [];

  const { data: pessoas } = await supabase
    .from("funcionario")
    .select("id, nome, obra_id")
    .in("id", [...new Set(linhas.map((a) => a.funcionario_id))]);

  const porPessoa = new Map(
    ((pessoas ?? []) as unknown as {
      id: string;
      nome: string;
      obra_id: string | null;
    }[]).map((p) => [p.id, p]),
  );

  const obraIds = [
    ...new Set(
      [...porPessoa.values()].map((p) => p.obra_id).filter((x): x is string => !!x),
    ),
  ];

  const porObra = new Map<string, string>();
  if (obraIds.length > 0) {
    const { data: obras } = await supabase
      .from("obra")
      .select("id, nome")
      .in("id", obraIds);
    for (const o of ((obras ?? []) as unknown as { id: string; nome: string }[])) {
      porObra.set(o.id, o.nome);
    }
  }

  return linhas.map((a) => {
    const p = porPessoa.get(a.funcionario_id);
    return {
      id: a.id,
      funcionario_id: a.funcionario_id,
      // A pessoa pode ter sido escondida pela RLS ou excluida: a atribuicao
      // continua contando para o rateio, com o nome em branco, em vez de
      // sumir e fazer o total nao fechar.
      funcionario_nome: p?.nome ?? "—",
      centro_custo_id: p?.obra_id ?? null,
      centro_custo_nome: p?.obra_id ? (porObra.get(p.obra_id) ?? null) : null,
      atribuido_em: a.atribuido_em,
    };
  });
}
