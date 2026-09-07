import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Situacao, Propriedade, Estado } from "@/lib/frota";

export type PecaFrota = {
  id: string;
  identificador: string;
  numeroSerie: string | null;
  situacao: Situacao;
  propriedade: Propriedade;
  estado: Estado | null;
  ano: number | null;
  observacoes: string | null;
  itemId: string;
  itemDescricao: string;
  categoriaId: string | null;
  categoriaNome: string | null;
  /** `geral` | `ti` | `veiculo` — decide quais colunas a linha mostra. */
  perfilCampos: string;
  /** A família: NOTEBOOK, PTA, CARRO. Nulo = modelo sem tipo definido. */
  tipoNome: string | null;
  obraId: string | null;
  obraRotulo: string | null;
  /** Vínculos em contrato. Decide se a peça pode ser EXCLUÍDA ou só baixada. */
  vinculos: number;
};

export type FiltrosFrota = {
  situacao?: string;
  propriedade?: string;
  obra?: string;
  categoria?: string;
  q?: string;
};

export type ResumoFrota = {
  total: number;
  disponiveis: number;
  emUso: number;
  manutencao: number;
  foraDeOperacao: number;
};

/**
 * As peças da frota, com o modelo e a obra resolvidos.
 *
 * Leitura livre na organização, mesmo com `obra_id` na peça: é exceção
 * consciente ao escopo por obra do resto do Loca, e a justificativa é o objetivo
 * da tela — um gestor precisa ver que a betoneira está na Obra B justamente para
 * ir buscá-la.
 *
 * Erro devolve vazio e registra: é tela de listagem, onde vazio é honesto.
 */
export async function listarFrota(f: FiltrosFrota): Promise<PecaFrota[]> {
  const supabase = await createClient();

  let q = supabase
    .from("equipamento_unidade")
    .select(
      "id, identificador, numero_serie, situacao, propriedade, estado, ano, observacoes, obra_id, item_id, " +
        "item:item_id(descricao, categoria_id, tipo:tipo_id(nome), " +
        "categoria:categoria_id(nome, perfil_campos)), " +
        "obra:obra_id(codigo, nome), item_locado(id)",
    )
    .order("identificador");

  if (f.situacao) q = q.eq("situacao", f.situacao);
  if (f.propriedade) q = q.eq("propriedade", f.propriedade);
  if (f.obra) q = q.eq("obra_id", f.obra);

  const { data, error } = await q;
  if (error || !data) {
    console.error("listarFrota", error);
    return [];
  }

  type Bruto = {
    id: string;
    identificador: string;
    numero_serie: string | null;
    situacao: Situacao;
    propriedade: Propriedade;
    estado: Estado | null;
    ano: number | null;
    observacoes: string | null;
    obra_id: string | null;
    item_id: string;
    item: {
      descricao: string;
      categoria_id: string | null;
      tipo: { nome: string } | null;
      categoria: { nome: string; perfil_campos: string } | null;
    } | null;
    obra: { codigo: string; nome: string } | null;
    item_locado: { id: string }[] | null;
  };

  const linhas = (data as unknown as Bruto[]).map((p) => ({
    id: p.id,
    identificador: p.identificador,
    numeroSerie: p.numero_serie,
    situacao: p.situacao,
    propriedade: p.propriedade,
    estado: p.estado,
    ano: p.ano,
    observacoes: p.observacoes,
    itemId: p.item_id,
    itemDescricao: p.item?.descricao ?? "(item)",
    categoriaId: p.item?.categoria_id ?? null,
    categoriaNome: p.item?.categoria?.nome ?? null,
    perfilCampos: p.item?.categoria?.perfil_campos ?? "geral",
    tipoNome: p.item?.tipo?.nome ?? null,
    obraId: p.obra_id,
    obraRotulo: p.obra ? `${p.obra.codigo} — ${p.obra.nome}` : null,
    vinculos: (p.item_locado ?? []).length,
  }));

  // Categoria e busca são filtradas em memória: as duas atravessam relação
  // aninhada, e no PostgREST isso exigiria `!inner`, que mudaria a cardinalidade
  // da consulta em silêncio — a armadilha que o AGENTS.md aponta.
  const termo = (f.q ?? "").trim().toLowerCase();
  return linhas
    .filter((l) => (f.categoria ? l.categoriaId === f.categoria : true))
    .filter((l) =>
      termo === ""
        ? true
        : `${l.identificador} ${l.numeroSerie ?? ""} ${l.itemDescricao}`
            .toLowerCase()
            .includes(termo),
    );
}

/** Contagem por situação, para o cabeçalho da tela. */
export function resumirFrota(pecas: PecaFrota[]): ResumoFrota {
  return {
    total: pecas.length,
    disponiveis: pecas.filter((p) => p.situacao === "disponivel").length,
    emUso: pecas.filter((p) => p.situacao === "em_uso").length,
    manutencao: pecas.filter((p) => p.situacao === "manutencao").length,
    // Baixada e perdida juntas: para quem lê o painel, as duas significam a
    // mesma coisa — a peça não está disponível para trabalho.
    foraDeOperacao: pecas.filter(
      (p) => p.situacao === "baixada" || p.situacao === "perdida",
    ).length,
  };
}

/** Uma linha do trilho de categorias da Frota. */
export type CategoriaTrilhoFrota = {
  /** `null` = as peças cujo modelo não tem categoria. */
  id: string | null;
  nome: string;
  perfil: string;
  pecas: number;
  emUso: number;
};

/**
 * O trilho de categorias, contando PEÇAS — não modelos.
 *
 * É a diferença entre esta tela e a de Itens: lá a categoria diz quantos
 * modelos existem no catálogo, aqui quantas máquinas existem no pátio.
 *
 * NAVEGAÇÃO, e não filtro: cada linha mostra o total DAQUELA categoria mesmo
 * quando outra está selecionada. Quem está em Veículos precisa ver que TI tem
 * 128 peças para decidir ir até lá.
 *
 * Contado em memória a partir de uma consulta só: são ~150 linhas de duas
 * colunas, e uma view nova para somar oito números seria estrutura demais para
 * o problema.
 */
export async function listarTrilhoDaFrota(): Promise<CategoriaTrilhoFrota[]> {
  const supabase = await createClient();

  const [{ data: categorias, error: erroCat }, { data: pecas, error: erroPecas }] =
    await Promise.all([
      supabase
        .from("categoria_equipamento")
        .select("id, nome, perfil_campos")
        .eq("ativo", true)
        .order("ordem")
        .order("nome"),
      supabase
        .from("equipamento_unidade")
        .select("situacao, item:item_id(categoria_id)")
        .eq("ativo", true),
    ]);

  if (erroCat || erroPecas) {
    console.error("listarTrilhoDaFrota", erroCat ?? erroPecas);
    return [];
  }

  const total = new Map<string, { pecas: number; emUso: number }>();
  const SEM = "__sem__";
  for (const p of pecas ?? []) {
    const item = p.item as unknown as { categoria_id: string | null } | null;
    const k = item?.categoria_id ?? SEM;
    const a = total.get(k) ?? { pecas: 0, emUso: 0 };
    a.pecas += 1;
    if (p.situacao === "em_uso") a.emUso += 1;
    total.set(k, a);
  }

  const linhas: CategoriaTrilhoFrota[] = (categorias ?? []).map((c) => ({
    id: c.id,
    nome: c.nome,
    perfil: c.perfil_campos ?? "geral",
    pecas: total.get(c.id)?.pecas ?? 0,
    emUso: total.get(c.id)?.emUso ?? 0,
  }));

  // Só aparece quando existe. Uma linha "Sem categoria — 0" seria um convite a
  // clicar em nada.
  const orfas = total.get(SEM);
  if (orfas && orfas.pecas > 0) {
    linhas.push({
      id: null,
      nome: "Sem categoria",
      perfil: "geral",
      pecas: orfas.pecas,
      emUso: orfas.emUso,
    });
  }
  return linhas;
}

/**
 * As peças que TÊM custódia aberta — alguém assinou por elas.
 *
 * O nome diz “com” porque é isso que a consulta sabe. A falta é derivada por
 * quem tem a lista completa: uma função chamada `pecasSemResponsavel` que
 * devolvesse o conjunto oposto seria exatamente o tipo de nome mentiroso que
 * esta sessão passou o dia consertando.
 *
 * Hoje o conjunto está VAZIO: a importação do inventário criou as 128 peças já
 * em uso e nunca criou o vínculo com a pessoa. A tela afirma que a máquina está
 * com alguém e não sabe dizer com quem.
 *
 * `null` em caso de erro, e não um conjunto vazio: vazio significaria “ninguém
 * assinou nada” e marcaria a frota inteira como pendência — alarme falso numa
 * faixa que precisa ser levada a sério. Nulo faz a tela omitir a pendência, que
 * é honesto: ela não sabe.
 */
export async function pecasComResponsavel(): Promise<Set<string> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custodia_peca")
    .select("unidade_id")
    .is("fim", null);

  if (error) {
    console.error("pecasComResponsavel", error);
    return null;
  }
  return new Set((data ?? []).map((c) => c.unidade_id as string));
}
