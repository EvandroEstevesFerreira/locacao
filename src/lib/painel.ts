// O painel de obras: os três percentuais de todas as obras, lado a lado.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `avanco.ts` calcula prazo e avanço de UMA obra; `orcamento.ts` calcula o
// consumo de UMA obra. Este módulo é a linha do painel: monta o veredito de
// cada obra a partir dos dois, e ordena por quem precisa de atenção primeiro.
//
// A ordenação é a razão de existir. Um diretor com 7 obras não lê 7 linhas em
// busca do problema — a obra que está queimando orçamento mais rápido do que
// entrega tem de estar em cima. Tudo puro, para o número que vai ao e-mail e à
// tela ser o mesmo, testado sem banco.
// ═══════════════════════════════════════════════════════════════════════════

import { percentualPrazo, desvio, type PeriodoObra, type PontoAvanco } from "@/lib/avanco";
import {
  percentualConsumido,
  projecaoFinal,
  estouroPrevisto,
  diagnostico,
} from "@/lib/orcamento";

export type EntradaPainel = {
  obra: PeriodoObra & { id: string; codigo: string; nome: string };
  avancos: PontoAvanco[];
  orcado: number | null;
  realizado: number;
  /** Itens locados em aberto na obra. */
  itensAbertos: number;
  /** Custo mensal estimado dos contratos ativos, para a previsão. */
  custoMensal: number;
  /** Meses restantes até o fim previsto do último contrato. */
  mesesRestantes: number;
};

export type LinhaPainel = {
  obraId: string;
  rotulo: string;
  prazo: number | null;
  fisico: number | null;
  consumido: number | null;
  /** Pontos de atraso: prazo menos avanço. Positivo é atraso. */
  desvioPrazo: number | null;
  /** Pontos de excesso: consumo menos avanço. Positivo é queimar mais que entrega. */
  desvioConsumo: number | null;
  projecao: number | null;
  estouro: number | null;
  veredito: string;
  itensAbertos: number;
  /** Quanto ainda deve ser desembolsado até o fim dos contratos. */
  previsaoAteFim: number;
  /** Quanto maior, mais precisa de atenção. Só para ordenar. */
  gravidade: number;
};

/**
 * Gravidade, usada só para ordenar o painel.
 *
 * Estouro previsto em reais pesa mais que qualquer percentual: é o número que
 * a diretoria decide sobre. Sem estouro apurado, o excesso de consumo sobre a
 * entrega é o melhor sinal disponível; sem ele, o atraso puro de prazo.
 *
 * Obra sem dado nenhum vai para o fim — não é que ela esteja bem, é que não se
 * sabe, e enterrar uma obra saudável embaixo de uma desconhecida seria pior.
 */
function calcularGravidade(
  estouro: number | null,
  desvioConsumo: number | null,
  desvioPrazo: number | null,
): number {
  if (estouro !== null) return 1_000_000 + estouro;
  if (desvioConsumo !== null && desvioConsumo > 0) return 1_000 + desvioConsumo;
  if (desvioPrazo !== null && desvioPrazo > 0) return desvioPrazo;
  return -1;
}

/** Monta a linha do painel de uma obra. */
export function montarLinha(e: EntradaPainel, hojeISO: string): LinhaPainel {
  const fisico = e.avancos[0]?.percentual ?? null;
  const prazo = percentualPrazo(e.obra, hojeISO);
  const consumido =
    e.orcado === null ? null : percentualConsumido(e.orcado, e.realizado);
  const projecao = projecaoFinal(consumido, fisico);
  const estouro = e.orcado === null ? null : estouroPrevisto(e.orcado, projecao);

  const desvioConsumo =
    consumido === null || fisico === null ? null : consumido - fisico;

  return {
    obraId: e.obra.id,
    rotulo: `${e.obra.codigo} — ${e.obra.nome}`,
    prazo,
    fisico,
    consumido,
    desvioPrazo: desvio(prazo, fisico),
    desvioConsumo,
    projecao,
    estouro,
    veredito: diagnostico(prazo, fisico, consumido),
    itensAbertos: e.itensAbertos,
    // Previsão de desembolso até o fim: o que ainda vai ser cobrado pelos
    // contratos ativos. `mesesRestantes` já vem limitado a zero pela leitura.
    previsaoAteFim: e.custoMensal * e.mesesRestantes,
    gravidade: calcularGravidade(estouro, desvioConsumo, desvioPrazo(prazo, fisico)),
  };
}

/** Auxiliar para não calcular o desvio duas vezes na montagem. */
function desvioPrazo(prazo: number | null, fisico: number | null): number | null {
  return desvio(prazo, fisico);
}

/** O painel inteiro, das obras que precisam de atenção para as que não. */
export function montarPainel(
  entradas: EntradaPainel[],
  hojeISO: string,
): LinhaPainel[] {
  return entradas
    .map((e) => montarLinha(e, hojeISO))
    .sort((a, b) => b.gravidade - a.gravidade);
}

/** Totais do rodapé do painel. */
export type ResumoPainel = {
  obras: number;
  comEstouro: number;
  estouroTotal: number;
  itensAbertos: number;
  previsaoAteFim: number;
  /** Obras sem os dados mínimos para diagnosticar. */
  semDados: number;
};

export function resumirPainel(linhas: LinhaPainel[]): ResumoPainel {
  return {
    obras: linhas.length,
    comEstouro: linhas.filter((l) => l.estouro !== null).length,
    estouroTotal: linhas.reduce((s, l) => s + (l.estouro ?? 0), 0),
    itensAbertos: linhas.reduce((s, l) => s + l.itensAbertos, 0),
    previsaoAteFim: linhas.reduce((s, l) => s + l.previsaoAteFim, 0),
    // "Sem dados" é o número que impede o painel de mentir por otimismo: 7
    // obras verdes das quais 7 estão sem informação não são 7 obras saudáveis.
    semDados: linhas.filter((l) => l.consumido === null || l.fisico === null).length,
  };
}
