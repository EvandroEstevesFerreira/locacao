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
        "item:item_id(descricao, categoria_id, categoria:categoria_id(nome)), " +
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
      categoria: { nome: string } | null;
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

/** Categorias ativas da organização, na ordem de obra. */
export async function listarCategorias(): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categoria_equipamento")
    .select("id, nome")
    .eq("ativo", true)
    .order("ordem")
    .order("nome");

  if (error || !data) {
    console.error("listarCategorias", error);
    return [];
  }
  return data;
}
