// Cálculos financeiros puros (client-safe, testáveis): geração de parcelas
// mensais recorrentes e encargos por atraso (multa + juros).

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
