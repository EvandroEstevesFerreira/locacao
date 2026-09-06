// Domínio Apontamento de uso — schemas e rótulos, client-safe.
//
// O QUE ESTA FATIA É, depois da resposta "todos os contratos são por
// calendário": o apontamento NÃO é dado financeiro. A diária corre trabalhando
// a máquina ou não. Ele serve a duas coisas, e as duas valem:
//
//   1. manutenção preventiva por uso — óleo a cada 250 h;
//   2. ociosidade REAL — a betoneira que está na obra há 40 dias e trabalhou 6.
//      O relatório de ociosidade que existe mede calendário e é cego para isso.

import { z } from "zod";
import { textoOpcional, uuidOpcional } from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";

/**
 * Uma leitura do horímetro.
 *
 * `leitura` é o número DO MOSTRADOR, acumulado — e não "quantas horas
 * trabalhou". Quem lê o horímetro copia um número; quem estima horas de memória
 * inventa. E a leitura é auditável: dá para conferir contra a máquina a
 * qualquer momento.
 */
export const apontamentoSchema = z.object({
  id: uuidOpcional,
  unidade_id: z.string().uuid("Selecione a peça."),
  obra_id: uuidOpcional,
  data: z.string().refine(ehDataISO, "Informe a data da leitura."),
  leitura: z.coerce
    .number()
    .min(0, "A leitura não pode ser negativa.")
    .max(9_999_999, "Leitura fora do razoável — confira o número."),
  /**
   * Horímetro trocado zera o mostrador.
   *
   * É o caso que quebra a conta: sem esta marca, a leitura seguinte seria menor
   * que a anterior e o sistema recusaria o lançamento para sempre. Marcado, o
   * período conta zero hora — a leitura de um horímetro novo não é hora
   * trabalhada.
   */
  reiniciado: z.boolean().default(false),
  observacoes: textoOpcional(300),
});

export type ApontamentoInput = z.input<typeof apontamentoSchema>;
export type ApontamentoDados = z.output<typeof apontamentoSchema>;

/**
 * Quanto falta para a próxima revisão, em horas.
 *
 * Negativo = VENCIDA, e o negativo é a informação: "passou 30 h do intervalo" é
 * o que faz alguém agir, enquanto um zero truncado diria só "chegou a hora" e
 * esconderia há quanto tempo.
 *
 * `null` quando o tipo não tem intervalo — a maioria. Só faz sentido onde o
 * fabricante publica o número.
 */
export function horasAteRevisao(
  leituraAtual: number | null,
  intervalo: number | null,
  leituraUltimaRevisao: number,
): number | null {
  if (leituraAtual === null || intervalo === null || intervalo <= 0) return null;
  return leituraUltimaRevisao + intervalo - leituraAtual;
}

/**
 * O estado da revisão, para a tela decidir a cor.
 *
 * O aviso começa a 10% do intervalo, e não num número fixo de horas: 25 h de
 * antecedência é muito para um intervalo de 50 e pouco para um de 500.
 */
export type EstadoRevisao = "vencida" | "proxima" | "em_dia" | "sem_intervalo";

export function estadoRevisao(
  faltam: number | null,
  intervalo: number | null,
): EstadoRevisao {
  if (faltam === null || intervalo === null) return "sem_intervalo";
  if (faltam < 0) return "vencida";
  if (faltam <= intervalo * 0.1) return "proxima";
  return "em_dia";
}

export const ESTADO_REVISAO_INFO: Record<
  EstadoRevisao,
  { label: string; variant: "destructive" | "secondary" | "outline" }
> = {
  vencida: { label: "Revisão vencida", variant: "destructive" },
  proxima: { label: "Revisão próxima", variant: "secondary" },
  em_dia: { label: "Em dia", variant: "outline" },
  sem_intervalo: { label: "Sem intervalo definido", variant: "outline" },
};
