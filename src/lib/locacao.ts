import { differenceInCalendarDays } from "date-fns";

export type Cadencia = "diaria" | "semanal" | "quinzenal" | "mensal";

export const CADENCIA: Record<Cadencia, { label: string; dias: number }> = {
  diaria: { label: "Diária", dias: 1 },
  semanal: { label: "Semanal", dias: 7 },
  quinzenal: { label: "Quinzenal", dias: 15 },
  mensal: { label: "Mensal", dias: 30 },
};

export type StatusContrato = "ativo" | "encerrado" | "cancelado";

export const STATUS_CONTRATO: Record<
  StatusContrato,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ativo: { label: "Ativo", variant: "default" },
  encerrado: { label: "Encerrado", variant: "secondary" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

/**
 * Número de períodos de cobrança entre duas datas (inclusivo).
 * Sem pró-rata: arredonda para cima (período iniciado = período cheio).
 * Com pró-rata: proporcional aos dias (períodos fracionados).
 * Ex.: cadência semanal, 8 dias → 2 (cheio) ou ~1,14 (pró-rata).
 * Aproximação: mensal = 30 dias.
 */
export function periodosEntre(
  cadencia: Cadencia,
  inicio: Date,
  fim: Date,
  prorata = false,
): number {
  const dias = Math.max(1, differenceInCalendarDays(fim, inicio) + 1);
  const bruto = dias / CADENCIA[cadencia].dias;
  return prorata ? bruto : Math.ceil(bruto);
}

/** Quantos períodos de cobrança cabem em um mês (30 dias) para a cadência. */
export function periodosPorMes(cadencia: Cadencia): number {
  return 30 / CADENCIA[cadencia].dias;
}

/** Custo estimado de uma linha: quantidade × valor por período × períodos. */
export function calcularCusto(
  quantidade: number,
  valorUnitarioPeriodo: number,
  periodos: number,
): number {
  return quantidade * valorUnitarioPeriodo * periodos;
}

export function formatarBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor || 0);
}

/** Converte 'yyyy-mm-dd' (coluna date) em Date local, sem fuso deslocar o dia. */
export function dataDeISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const d = dataDeISO(iso);
  return d.toLocaleDateString("pt-BR");
}
