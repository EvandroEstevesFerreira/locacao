import "server-only";

import { createClient } from "@/lib/supabase/server";
import { segundaDaSemana, type PontoAvanco } from "@/lib/avanco";

export type ObraAvanco = {
  id: string;
  codigo: string;
  nome: string;
  data_inicio: string | null;
  data_fim_prevista: string | null;
  /** Percentual já lançado nesta semana, ou null se ainda não lançaram. */
  semanaAtual: number | null;
  /** O da semana anterior, mostrado como referência de quem digita. */
  semanaAnterior: number | null;
};

/** Sete dias antes, ainda canonizado na segunda-feira. */
function semanaAnteriorDe(semanaISO: string): string {
  const d = new Date(`${semanaISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return segundaDaSemana(d.toISOString().slice(0, 10));
}

/**
 * Obras ativas com o avanço desta semana e o da anterior.
 *
 * Erro em leitura de lista devolve vazio e registra — a tela mostra o estado
 * vazio em vez de quebrar. Regra diferente da de agregado que gera documento,
 * que precisa LANÇAR: um `[]` silencioso lá viraria relatório plausível e
 * errado na mão de um cliente.
 */
export async function listarObrasComAvanco(semanaISO: string): Promise<ObraAvanco[]> {
  const semana = segundaDaSemana(semanaISO);
  const anterior = semanaAnteriorDe(semana);

  const supabase = await createClient();

  const { data: obras, error } = await supabase
    .from("obra")
    .select("id, codigo, nome, data_inicio, data_fim_prevista")
    .eq("status", "ativa")
    .is("deleted_at", null)
    .order("codigo");

  if (error || !obras) {
    console.error("listarObrasComAvanco", error);
    return [];
  }

  // Duas semanas numa consulta só: a atual é o que se edita, a anterior é a
  // referência que evita o erro de digitar um número menor que o da semana
  // passada sem perceber.
  const { data: avancos, error: erroAvancos } = await supabase
    .from("avanco_obra")
    .select("obra_id, semana, percentual")
    .in("semana", [semana, anterior]);

  if (erroAvancos) console.error("listarObrasComAvanco/avancos", erroAvancos);

  const porObra = new Map<string, { atual: number | null; anterior: number | null }>();
  for (const a of avancos ?? []) {
    const linha = porObra.get(a.obra_id) ?? { atual: null, anterior: null };
    if (a.semana === semana) linha.atual = Number(a.percentual);
    if (a.semana === anterior) linha.anterior = Number(a.percentual);
    porObra.set(a.obra_id, linha);
  }

  return obras.map((o) => ({
    id: o.id,
    codigo: o.codigo,
    nome: o.nome,
    data_inicio: o.data_inicio,
    data_fim_prevista: o.data_fim_prevista,
    semanaAtual: porObra.get(o.id)?.atual ?? null,
    semanaAnterior: porObra.get(o.id)?.anterior ?? null,
  }));
}

/** As últimas semanas lançadas de uma obra, da mais recente para a mais antiga. */
export async function historicoAvanco(
  obraId: string,
  limite = 8,
): Promise<PontoAvanco[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avanco_obra")
    .select("semana, percentual")
    .eq("obra_id", obraId)
    .order("semana", { ascending: false })
    .limit(limite);

  if (error || !data) {
    console.error("historicoAvanco", error);
    return [];
  }
  // `numeric` do Postgres chega como string no PostgREST; sem o Number() a
  // aritmética de ritmo viraria concatenação de texto.
  return data.map((d) => ({ semana: d.semana, percentual: Number(d.percentual) }));
}
