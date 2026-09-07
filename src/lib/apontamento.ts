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
  /**
   * A revisão preventiva foi feita nesta leitura.
   *
   * Marca a leitura, e não a peça: é a partir DAQUI que a contagem para a
   * próxima recomeça. Vive junto de `reiniciado` porque as duas são fatos sobre
   * aquele dia, e não sobre a máquina.
   */
  revisao: z.boolean().default(false),
  observacoes: textoOpcional(300),
});

export type ApontamentoInput = z.input<typeof apontamentoSchema>;
export type ApontamentoDados = z.output<typeof apontamentoSchema>;

/**
 * Quantas horas a peça rodou DESDE a última revisão.
 *
 * Recebe o histórico na ordem em que `listarApontamentosDaPeca` devolve: do
 * mais RECENTE para o mais antigo.
 *
 * POR QUE SOMAR `horas` E NÃO COMPARAR LEITURAS. Guardar "a revisão foi feita
 * na leitura 1.000" quebra na troca de horímetro: o mostrador novo começa em
 * zero e 1.000 vira um número de outra escala. A coluna `horas` é calculada
 * pelo trigger da 0071 e já trata a troca — o período com `reiniciado` conta
 * zero. Somar é exato e não tem caso especial.
 *
 * A leitura DA revisão não entra: aquelas horas foram trabalhadas antes dela,
 * e o óleo trocado naquele dia já as cobriu.
 *
 * `null` quando não há apontamento nenhum. Zero afirmaria "rodou zero hora
 * desde a revisão", que é diferente de "não sabemos se rodou".
 */
export function horasDesdeRevisao(
  historico: { horas: number; revisao: boolean }[],
): number | null {
  if (historico.length === 0) return null;

  let total = 0;
  for (const a of historico) {
    // Vindo do mais recente, a primeira revisão encontrada é a mais recente —
    // e tudo daqui para trás já está coberto por ela.
    if (a.revisao) return total;
    total += a.horas;
  }
  return total;
}

/**
 * Quanto falta para a próxima revisão, em horas.
 *
 * Negativo = VENCIDA, e o negativo é a informação: "passou 30 h do intervalo" é
 * o que faz alguém agir, enquanto um zero truncado diria só "chegou a hora" e
 * esconderia há quanto tempo.
 *
 * `null` quando o tipo não tem intervalo (a maioria — só faz sentido onde o
 * fabricante publica o número) ou quando a peça nunca foi apontada.
 */
export function horasAteRevisao(
  desdeRevisao: number | null,
  intervalo: number | null,
): number | null {
  if (desdeRevisao === null || intervalo === null || intervalo <= 0) return null;
  return intervalo - desdeRevisao;
}

/**
 * O estado da revisão, para a tela decidir a cor.
 *
 * O aviso começa a 10% do intervalo, e não num número fixo de horas: 25 h de
 * antecedência é muito para um intervalo de 50 e pouco para um de 500.
 */
export type EstadoRevisao =
  | "vencida"
  | "proxima"
  | "em_dia"
  | "sem_leitura"
  | "sem_intervalo";

/**
 * `sem_leitura` e `sem_intervalo` são coisas diferentes, e confundi-las manda a
 * pessoa para o lugar errado: a primeira pede uma LEITURA do horímetro, a
 * segunda pede que alguém configure o intervalo no TIPO. A tela antiga dizia
 * "sem intervalo definido" para a PTA recém-cadastrada cujo tipo já declarava
 * 250 h — o sistema mentindo sobre a própria configuração.
 */
export function estadoRevisao(
  faltam: number | null,
  intervalo: number | null,
): EstadoRevisao {
  if (intervalo === null || intervalo <= 0) return "sem_intervalo";
  if (faltam === null) return "sem_leitura";
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
  sem_leitura: { label: "Sem leitura do horímetro", variant: "outline" },
  sem_intervalo: { label: "Sem intervalo definido", variant: "outline" },
};
