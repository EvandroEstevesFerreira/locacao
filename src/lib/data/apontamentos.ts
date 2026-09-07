import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UnidadeMedidor } from "@/lib/catalogo";
import {
  faltaAteRevisao,
  usoDesdeRevisao,
  estadoRevisao,
  type EstadoRevisao,
} from "@/lib/apontamento";

// Leituras do apontamento de uso.
//
// `createClient()`, nunca `createAdminClient()`. O recorte é por organização
// (migration 0071), pela mesma razão do reparo: a peça circula entre obras, e
// esconder o histórico de uso da obra que acabou de receber a máquina é o
// contrário do que ela precisa para não estourar o intervalo de revisão.

/** Um embed do PostgREST vem como objeto OU array conforme a cardinalidade. */
function achatar<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export type ApontamentoLinha = {
  id: string;
  data: string;
  leitura: number;
  horas: number;
  reiniciado: boolean;
  revisao: boolean;
  observacoes: string | null;
  obra: string | null;
};

/** O histórico de uma peça, do mais recente para o mais antigo. */
export async function listarApontamentosDaPeca(
  unidadeId: string,
): Promise<ApontamentoLinha[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("apontamento_uso")
    .select("id, data, leitura, horas, reiniciado, revisao, observacoes, obra:obra_id(codigo, nome)")
    .eq("unidade_id", unidadeId)
    .order("data", { ascending: false });

  if (error) {
    console.error("listarApontamentosDaPeca", error);
    return [];
  }

  return (data ?? []).map((a) => {
    const o = achatar(a.obra as unknown as { codigo: string; nome: string } | null);
    return {
      id: a.id,
      data: a.data,
      leitura: Number(a.leitura),
      horas: Number(a.horas),
      reiniciado: a.reiniciado,
      revisao: a.revisao,
      observacoes: a.observacoes,
      obra: o ? `${o.codigo} — ${o.nome}` : null,
    };
  });
}

export type UsoDaPeca = {
  unidadeId: string;
  identificador: string;
  equipamento: string | null;
  /** Última leitura do horímetro, ou `null` se nunca foi apontada. */
  leituraAtual: number | null;
  ultimaData: string | null;
  /** Intervalo de manutenção do TIPO. `null` = tipo sem revisão por uso. */
  intervalo: number | null;
  /** A unidade do intervalo e da leitura: `h` ou `km`. */
  unidade: UnidadeMedidor | null;
  /** Quanto rodou desde a última revisão, na unidade acima. */
  usoDesdeRevisao: number | null;
  /** Quanto falta até a próxima, na unidade acima. Negativo = vencida. */
  faltamHoras: number | null;
  estado: EstadoRevisao;
};

/**
 * O quadro de uso e revisão das peças com horímetro.
 *
 * Só as marcadas com `tem_medidor`: gerador e compressor costumam ter,
 * betoneira e vibrador quase nunca. Trazer todas encheria a tela de peças que
 * não têm o que apontar.
 *
 * `leituraUltimaRevisao` é ZERO por enquanto, e isso é uma simplificação
 * declarada: a ordem de reparo ainda não registra a leitura do horímetro no
 * momento do serviço. Enquanto não registrar, o intervalo conta desde o começo
 * da vida da máquina — o que ACUSA revisão vencida cedo demais, e não tarde
 * demais. Errar para o lado do alarme é o lado certo de errar aqui.
 */
export async function listarUsoDasPecas(): Promise<UsoDaPeca[]> {
  const supabase = await createClient();

  const { data: pecas, error } = await supabase
    .from("equipamento_unidade")
    .select(
      "id, identificador, item:item_id(descricao, tipo:tipo_id(intervalo_manutencao, unidade_medidor))",
    )
    .eq("tem_medidor", true)
    .eq("ativo", true)
    .order("identificador");

  if (error) {
    console.error("listarUsoDasPecas", error);
    return [];
  }
  if ((pecas ?? []).length === 0) return [];

  // A última leitura de cada peça, numa consulta só. Uma por peça seriam
  // dezenas — e este quadro é justamente o que alguém abre de manhã.
  const { data: leituras, error: erroLeituras } = await supabase
    .from("apontamento_uso")
    // `horas` e `revisao` entram porque a contagem para a próxima revisão é a
    // soma das horas POSTERIORES à última revisão — e não uma subtração de
    // leituras do mostrador, que a troca de horímetro invalidaria.
    .select("unidade_id, data, leitura, horas, revisao")
    .in(
      "unidade_id",
      (pecas ?? []).map((p) => p.id),
    )
    .order("data", { ascending: false });

  // Erro aqui NÃO zera a lista: sem as leituras o quadro mostra as peças com
  // "nunca apontada", que é pior mas ainda diz quais máquinas existem. Zerar
  // tudo por causa da coluna acessória seria a troca errada.
  if (erroLeituras) console.error("listarUsoDasPecas.leituras", erroLeituras);

  const ultima = new Map<string, { data: string; leitura: number }>();
  // O histórico de cada peça, na mesma ordem (recente → antigo) que
  // `usoDesdeRevisao` espera.
  const historico = new Map<string, { horas: number; revisao: boolean }[]>();
  for (const l of leituras ?? []) {
    // A consulta vem ordenada por data desc, então a PRIMEIRA de cada peça é a
    // mais recente.
    if (!ultima.has(l.unidade_id)) {
      ultima.set(l.unidade_id, { data: l.data, leitura: Number(l.leitura) });
    }
    const lista = historico.get(l.unidade_id) ?? [];
    lista.push({ horas: Number(l.horas), revisao: Boolean(l.revisao) });
    historico.set(l.unidade_id, lista);
  }

  return (pecas ?? []).map((p) => {
    const item = achatar(
      p.item as unknown as {
        descricao: string;
        tipo: {
          intervalo_manutencao: number | null;
          unidade_medidor: string | null;
        } | null;
      } | null,
    );
    const tipo = achatar(item?.tipo ?? null);
    const u = ultima.get(p.id) ?? null;
    const intervalo = tipo?.intervalo_manutencao ?? null;
    const unidade = (tipo?.unidade_medidor as UnidadeMedidor | null) ?? null;
    const desde = usoDesdeRevisao(historico.get(p.id) ?? []);
    const faltam = faltaAteRevisao(desde, intervalo);

    return {
      unidadeId: p.id,
      identificador: p.identificador,
      equipamento: item?.descricao ?? null,
      leituraAtual: u?.leitura ?? null,
      ultimaData: u?.data ?? null,
      intervalo,
      unidade,
      usoDesdeRevisao: desde,
      faltamHoras: faltam,
      estado: estadoRevisao(faltam, intervalo),
    };
  });
}
