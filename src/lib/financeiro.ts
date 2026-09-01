// Cálculos financeiros puros (client-safe, testáveis): geração de parcelas
// mensais recorrentes e encargos por atraso (multa + juros).

import { z } from "zod";
import { idOpcional, opcional, dataOpcional, textoOpcional } from "@/lib/campos";
import {
  addMonths,
  format,
  lastDayOfMonth,
  setDate,
  startOfMonth,
} from "date-fns";

export type MesRecorrente = {
  competencia: string; // 'yyyy-MM-01' (mês de referência)
  vencimento: string; // 'yyyy-MM-dd'
  label: string; // 'jul/2026'
};

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

function dataISO(v: string): Date {
  // Interpreta 'yyyy-mm-dd' como data local (sem fuso), evitando drift de UTC.
  const [a, m, d] = v.slice(0, 10).split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

function vencimentoDoMes(mesInicio: Date, dia: number): string {
  const ultimo = lastDayOfMonth(mesInicio).getDate();
  const clamp = Math.min(Math.max(1, Math.round(dia) || 1), ultimo);
  return format(setDate(mesInicio, clamp), "yyyy-MM-dd");
}

/**
 * Lista os meses (1 parcela por mês) entre `inicio` e o menor entre `fim` e
 * `ate` (limite superior escolhido pelo usuário, 'yyyy-MM'). Idempotência fica
 * a cargo de quem consome (filtra competências já existentes).
 */
export function mesesRecorrentes(opts: {
  inicio: string; // 'yyyy-mm-dd'
  fim: string | null; // 'yyyy-mm-dd' | null (contrato sem fim)
  ate: string; // 'yyyy-MM'
  diaVencimento: number;
}): MesRecorrente[] {
  const start = startOfMonth(dataISO(opts.inicio));
  const ate = startOfMonth(dataISO(`${opts.ate}-01`));
  let fim = opts.fim ? startOfMonth(dataISO(opts.fim)) : ate;
  if (fim > ate) fim = ate;

  const out: MesRecorrente[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= fim && guard < 240) {
    const ym = format(cursor, "yyyy-MM");
    out.push({
      competencia: `${ym}-01`,
      vencimento: vencimentoDoMes(cursor, opts.diaVencimento),
      label: `${MESES_PT[cursor.getMonth()]}/${cursor.getFullYear()}`,
    });
    cursor = addMonths(cursor, 1);
    guard++;
  }
  return out;
}

/**
 * Encargos por atraso no padrão usual (BR): multa fixa (%) + juros ao mês
 * pró-rata dia. Retorna zeros quando não há atraso.
 */
export function calcularEncargos(opts: {
  valor: number;
  vencimento: string; // 'yyyy-mm-dd'
  referencia: string; // 'yyyy-mm-dd' (hoje)
  multaPct?: number; // default 2%
  jurosMesPct?: number; // default 1% a.m.
}): { diasAtraso: number; multa: number; juros: number; total: number } {
  const venc = dataISO(opts.vencimento);
  const hoje = dataISO(opts.referencia);
  const diasAtraso = Math.floor((hoje.getTime() - venc.getTime()) / 86_400_000);
  if (diasAtraso <= 0 || opts.valor <= 0) {
    return { diasAtraso: 0, multa: 0, juros: 0, total: opts.valor };
  }
  const multaPct = opts.multaPct ?? 2;
  const jurosMesPct = opts.jurosMesPct ?? 1;
  const multa = round2(opts.valor * (multaPct / 100));
  const juros = round2(opts.valor * (jurosMesPct / 100 / 30) * diasAtraso);
  return { diasAtraso, multa, juros, total: round2(opts.valor + multa + juros) };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Aqui, e não em `financeiro/actions.ts`, para o formulário poder importar.


export const STATUS_LANCAMENTO = ["pendente", "pago"] as const;
export type StatusLancamento = (typeof STATUS_LANCAMENTO)[number];

/** 'yyyy-mm' (input month) ou 'yyyy-mm-dd' → 'yyyy-mm-01'. */
export function competenciaParaData(v: string): string {
  const base = v.length === 7 ? `${v}-01` : v;
  return `${base.slice(0, 7)}-01`;
}

export const lancamentoSchema = z
  .object({
    id: idOpcional,
    obra_id: z.string().uuid("Selecione a obra."),
    contrato_id: opcional,
    descricao: z.string().trim().min(1, "Informe a descrição.").max(200),
    competencia: z
      .string()
      .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Competência inválida (use AAAA-MM).")
      .transform(competenciaParaData),
    valor: z.coerce.number().positive("O valor deve ser maior que zero."),
    vencimento: z.string().min(1, "Informe o vencimento."),
    status: z.enum(STATUS_LANCAMENTO),
    data_pagamento: dataOpcional,
  })
  // Regra cruzada: o vencimento não pode ser anterior ao mês de competência.
  // Um lançamento de julho vencendo em maio é erro de digitação, e antes passava
  // direto — reaparecendo depois como "vencido" num mês que nem começou.
  .refine((d) => d.vencimento >= d.competencia, {
    message: "O vencimento não pode ser anterior ao mês de competência.",
    path: ["vencimento"],
  });

export type LancamentoInput = z.input<typeof lancamentoSchema>;
export type LancamentoDados = z.output<typeof lancamentoSchema>;

/**
 * Baixa (conciliação) de um lançamento. Já era chamada com um objeto tipado
 * direto do cliente, então o schema aqui só formaliza as checagens que estavam
 * espalhadas em `if`s dentro da action.
 */
export const baixaSchema = z.object({
  id: z.string().uuid(),
  valorPago: z.coerce.number().positive("Informe o valor pago."),
  multa: z.coerce.number().min(0, "Multa inválida.").default(0),
  juros: z.coerce.number().min(0, "Juros inválidos.").default(0),
  nfNumero: textoOpcional(60),
  dataPagamento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data de pagamento inválida."),
  comprovantePath: z.string().nullable().optional(),
});

export type BaixaInput = z.input<typeof baixaSchema>;
export type BaixaDados = z.output<typeof baixaSchema>;
