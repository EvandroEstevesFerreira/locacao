// Fechamento mensal: a fotografia da competência.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// A diretoria pediu para "abater o saldo dos contratos locados" ao fim de cada
// mês. O que isso exige não é uma conta nova — é PARAR de recalcular.
//
// Se o fechamento de setembro for uma consulta sobre as tabelas vivas, mudar um
// preço em outubro reescreve setembro em silêncio. O e-mail de setembro que o
// diretor tem na caixa deixa de bater com o sistema, e a partir daí nenhum
// número do histórico é defensável.
//
// Então o fechamento GRAVA: orçado, realizado, avanço e saldo do mês, com a
// data e o autor. Mês fechado é imutável até alguém reabrir explicitamente, e a
// reabertura fica registrada.
//
// Tudo aqui é puro.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional } from "@/lib/campos";

export type NumerosCompetencia = {
  /** Orçamento vigente da obra no momento do fechamento. */
  orcado: number;
  /** Realizado acumulado até o fim da competência (não só do mês). */
  realizadoAcumulado: number;
  /** Realizado apenas da competência. */
  realizadoMes: number;
  /** Avanço físico acumulado no fim da competência, ou null. */
  avancoFisico: number | null;
};

export type Fechamento = NumerosCompetencia & {
  /** 'yyyy-mm-01' — a competência é sempre o dia 1 do mês. */
  competencia: string;
  /** Orçado menos realizado acumulado. Negativo = estourou. */
  saldo: number;
  /** Fração do orçamento consumida no fim da competência, ou null. */
  consumido: number | null;
};

function centavos(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Monta os números do fechamento de uma competência.
 *
 * O saldo é sobre o ACUMULADO, não sobre o mês: "saldo do orçamento" é quanto
 * ainda resta gastar, e um saldo mensal seria uma fração sem significado —
 * ninguém orça locação por mês, orça a obra.
 */
export function montarFechamento(
  competencia: string,
  n: NumerosCompetencia,
): Fechamento {
  return {
    competencia,
    ...n,
    saldo: centavos(n.orcado - n.realizadoAcumulado),
    consumido:
      n.orcado <= 0 ? null : (n.realizadoAcumulado / n.orcado) * 100,
  };
}

/** A competência anterior a 'yyyy-mm-01'. */
export function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  return mes === 1
    ? `${ano - 1}-12-01`
    : `${ano}-${String(mes - 1).padStart(2, "0")}-01`;
}

/**
 * Variação contra o fechamento anterior, para a leitura do mês fazer sentido.
 *
 * Sem comparação, "consumido 62%" no fechamento de setembro não diz se piorou.
 * `null` quando não há mês anterior fechado — e aí a tela diz isso, em vez de
 * mostrar uma variação de 62 pontos que só existe porque não havia base.
 */
export function variacao(
  atual: Fechamento,
  anterior: Fechamento | null,
): { consumido: number | null; avanco: number | null } {
  if (!anterior) return { consumido: null, avanco: null };
  return {
    consumido:
      atual.consumido === null || anterior.consumido === null
        ? null
        : atual.consumido - anterior.consumido,
    avanco:
      atual.avancoFisico === null || anterior.avancoFisico === null
        ? null
        : atual.avancoFisico - anterior.avancoFisico,
  };
}

/**
 * A competência está fechada para lançamento?
 *
 * Serve à trava do financeiro: gravar em mês fechado invalidaria a fotografia,
 * que é justamente o que o fechamento existe para impedir.
 */
export function estaFechada(
  competencia: string,
  fechadas: Set<string>,
): boolean {
  return fechadas.has(competencia);
}

// ── Schema ───────────────────────────────────────────────────────────────────

const COMPETENCIA = /^\d{4}-\d{2}(-\d{2})?$/;

export const fechamentoSchema = z.object({
  id: idOpcional,
  obra_id: z.string().uuid("Selecione a obra."),
  competencia: z
    .string()
    .regex(COMPETENCIA, "Competência inválida (use AAAA-MM).")
    // Normaliza para o dia 1, que é o formato da coluna `date`.
    .transform((v) => (v.length === 7 ? `${v}-01` : v)),
});

export type FechamentoInput = z.input<typeof fechamentoSchema>;
export type FechamentoDados = z.output<typeof fechamentoSchema>;
