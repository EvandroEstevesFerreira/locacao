// Avanço físico da obra e prazo decorrido — TUDO puro, sem I/O.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// A diretoria pediu acompanhamento de orçamento de locação por obra. O que ela
// quer, no fundo, é cruzar três percentuais que hoje ninguém cruza: prazo
// decorrido, avanço físico e orçamento consumido. Isolados, nenhum decide nada
// — "consumi 60% do orçamento" ser bom ou ruim depende de quanto de obra foi
// entregue.
//
// E isso pesa mais em locação do que em qualquer outra conta: equipamento
// alugado cobra por TEMPO, não por produção. Obra atrasada paga diária de
// betoneira parada — o atraso vira custo todo dia, sem ninguém decidir nada.
//
// Este módulo entrega os dois primeiros percentuais. O terceiro depende de
// orçamento, que ainda não existe (fatias B, C e D da spec).
//
// A regra de negócio inteira mora AQUI, em função pura: `data/avanco.ts` só
// busca linhas e as telas só formatam. É o que torna o número que o diretor vai
// ler testável sem banco.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { ehDataISO } from "@/lib/locacao";
import { idOpcional, textoOpcional } from "@/lib/campos";

export type PeriodoObra = {
  data_inicio: string | null;
  data_fim_prevista: string | null;
};

export type PontoAvanco = { semana: string; percentual: number };

/**
 * Aritmética de data em UTC, de propósito.
 *
 * Os valores aqui são 'yyyy-mm-dd' vindos de coluna `date` — dia de calendário,
 * não instante. Fazer a conta em horário local faria o horário de verão comer
 * ou inventar um dia, e um dia a mais no numerador muda o "% de prazo" de uma
 * obra. `Date.UTC` não tem horário de verão.
 */
function paraUTC(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function deUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const DIA_MS = 86_400_000;

/** Dias de calendário de `a` até `b`. Negativo se `b` for antes de `a`. */
export function diasEntre(aISO: string, bISO: string): number {
  return Math.round((paraUTC(bISO).getTime() - paraUTC(aISO).getTime()) / DIA_MS);
}

function somarDias(iso: string, dias: number): string {
  return deUTC(new Date(paraUTC(iso).getTime() + dias * DIA_MS));
}

/**
 * A segunda-feira da semana daquela data.
 *
 * Canonizar aqui é o que dá sentido ao `unique (obra_id, semana)`: lançar em
 * qualquer dia da semana grava na mesma linha, então relançar é upsert e
 * corrigir um número errado é natural, não duplicata.
 */
export function segundaDaSemana(iso: string): string {
  const diaSemana = paraUTC(iso).getUTCDay(); // 0 = domingo
  // Domingo fecha a semana que começou na segunda anterior, não abre uma nova.
  // Sem este ajuste, todo domingo cairia na semana seguinte.
  const recuo = diaSemana === 0 ? 6 : diaSemana - 1;
  return somarDias(iso, -recuo);
}

function travar(v: number): number {
  return Math.min(100, Math.max(0, v));
}

/**
 * Percentual do prazo já decorrido, de 0 a 100.
 *
 * `null` quando falta qualquer uma das datas: obra sem período cadastrado não
 * tem curva de prazo, e inventar uma seria pior do que não mostrar nada.
 *
 * O `hojeISO` vem de fora — e quem chama DEVE passar `hojeISOSaoPaulo()`, nunca
 * `new Date()`. O Vercel roda em UTC, então das 21h à meia-noite em Brasília a
 * data já é a de amanhã e o percentual sai adiantado (o bug da 0.22.0).
 */
export function percentualPrazo(obra: PeriodoObra, hojeISO: string): number | null {
  const { data_inicio: inicio, data_fim_prevista: fim } = obra;
  if (!inicio || !fim) return null;

  const total = diasEntre(inicio, fim);
  // Obra de um dia: não há denominador, mas a resposta é óbvia.
  if (total <= 0) return diasEntre(inicio, hojeISO) >= 0 ? 100 : 0;

  return travar((diasEntre(inicio, hojeISO) / total) * 100);
}

/** Pontos percentuais de atraso. Positivo = o prazo correu mais que a obra. */
export function desvio(prazo: number | null, fisico: number | null): number | null {
  if (prazo === null || fisico === null) return null;
  return prazo - fisico;
}

/** Semanas inteiras desde o último lançamento. `null` se nunca houve um. */
export function semanasSemLancamento(
  ultimaSemana: string | null,
  hojeISO: string,
): number | null {
  if (!ultimaSemana) return null;
  const dias = diasEntre(segundaDaSemana(ultimaSemana), segundaDaSemana(hojeISO));
  return Math.max(0, Math.round(dias / 7));
}

/** Quantos lançamentos entram no cálculo de ritmo. */
const JANELA_RITMO = 4;

/**
 * Data estimada de término, pelo ritmo das últimas semanas COM lançamento.
 *
 * Devolve `null` — e a tela diz "ritmo insuficiente para projetar" — quando o
 * ritmo é zero ou negativo. Obra parada dividiria por zero, e correção para
 * baixo projetaria uma data no passado. "Término em 2183" destrói a confiança
 * no painel inteiro; não responder é honesto.
 *
 * A janela é de LANÇAMENTOS, não de semanas de calendário: semana não informada
 * não pode virar ritmo zero, senão a projeção mente para pior exatamente quando
 * o dado está faltando.
 */
export function previsaoTermino(
  avancos: PontoAvanco[],
  hojeISO: string,
): string | null {
  const ordenados = [...avancos]
    .sort((a, b) => (a.semana < b.semana ? 1 : a.semana > b.semana ? -1 : 0))
    .slice(0, JANELA_RITMO);
  if (ordenados.length < 2) return null;

  const recente = ordenados[0];
  const antigo = ordenados[ordenados.length - 1];

  if (recente.percentual >= 100) return recente.semana;

  const semanas = diasEntre(antigo.semana, recente.semana) / 7;
  if (semanas <= 0) return null;

  const ritmo = (recente.percentual - antigo.percentual) / semanas;
  if (ritmo <= 0) return null;

  const semanasRestantes = Math.ceil((100 - recente.percentual) / ritmo);
  return somarDias(hojeISO, semanasRestantes * 7);
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Mora aqui, e não em `avanco/actions.ts`, porque arquivo "use server" não
// atravessa para o cliente e o formulário precisa do schema.

export const avancoSchema = z.object({
  id: idOpcional,
  obra_id: z.string().uuid("Selecione a obra."),
  // A canonização para segunda-feira acontece antes de chegar aqui; o schema só
  // garante que é uma data ISO de verdade.
  semana: z.string().refine(ehDataISO, "Semana inválida."),
  percentual: z.coerce
    .number()
    .min(0, "O avanço vai de 0 a 100.")
    .max(100, "O avanço vai de 0 a 100."),
  observacoes: textoOpcional(300),
});

export type AvancoInput = z.input<typeof avancoSchema>;
export type AvancoDados = z.output<typeof avancoSchema>;
