import { z } from "zod";
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

export type MovimentacaoDevolucao = { quantidade: number; data: Date };

/**
 * Custo de uma linha locada respeitando DEVOLUÇÕES PARCIAIS: cada quantidade
 * devolvida é cobrada da retirada até a data em que voltou; o saldo ainda em
 * aberto é cobrado da retirada até `fim` (hoje ou data de encerramento).
 * Corrige a superestimativa de cobrar sempre a quantidade cheia até hoje.
 */
export function custoLinhaLocado(p: {
  quantidade: number;
  valorUnitarioPeriodo: number;
  cadencia: Cadencia;
  retirada: Date;
  devolucoes: MovimentacaoDevolucao[];
  fim: Date;
  prorata?: boolean;
}): { saldo: number; custo: number } {
  const prorata = p.prorata ?? false;
  const devolvido = p.devolucoes.reduce((s, m) => s + Number(m.quantidade), 0);
  const saldo = Math.max(0, Number(p.quantidade) - devolvido);

  let custo = 0;
  for (const m of p.devolucoes) {
    const periodos = periodosEntre(p.cadencia, p.retirada, m.data, prorata);
    custo += calcularCusto(Number(m.quantidade), p.valorUnitarioPeriodo, periodos);
  }
  if (saldo > 0) {
    const periodos = periodosEntre(p.cadencia, p.retirada, p.fim, prorata);
    custo += calcularCusto(saldo, p.valorUnitarioPeriodo, periodos);
  }
  return { saldo, custo };
}

// Formatadores içados para constante de módulo: construir um Intl a cada
// chamada é caro, e em /relatorios, /financeiro/fluxo e contratos/[id] são
// centenas de chamadas por render.
const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DATA_SAO_PAULO = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/** Colunas `date` do Postgres chegam sempre neste formato. */
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function formatarBRL(valor: number): string {
  return BRL.format(valor || 0);
}

/** Converte 'yyyy-mm-dd' (coluna date) em Date local, sem fuso deslocar o dia. */
export function dataDeISO(iso: string): Date {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, (m ?? 1) - 1, d ?? 1);
}

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  // Duas entradas possíveis, e tratá-las igual dava errado:
  // - 'yyyy-mm-dd' (coluna date): split manual, senão o fuso desloca o dia.
  // - timestamp ISO completo: `dataDeISO` fazia Number("10T12:00:00Z") = NaN e
  //   a tela mostrava "Invalid Date". Aqui vai pelo Intl no fuso de São Paulo.
  if (SO_DATA.test(iso)) return dataDeISO(iso).toLocaleDateString("pt-BR");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return DATA_SAO_PAULO.format(d);
}

/** Data de "hoje" no fuso de São Paulo como 'yyyy-mm-dd' (en-CA = ISO). */
export function hojeISOSaoPaulo(base: Date = new Date()): string {
  return base.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** Formata um timestamp ISO como data + hora no fuso de São Paulo. */
export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

// ── Schemas ──────────────────────────────────────────────────────────────────
// Ficam aqui, e não em `contratos/actions.ts`, para poderem ser importados pelo
// formulário — um arquivo "use server" não atravessa para o cliente.

export const CADENCIAS = ["diaria", "semanal", "quinzenal", "mensal"] as const;
export const STATUS_CONTRATOS = ["ativo", "encerrado", "cancelado"] as const;

const dataOpcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : null));

export const contratoSchema = z
  .object({
    id: z.string().uuid().optional(),
    obra_id: z.string().uuid("Selecione a obra."),
    fornecedor_id: z.string().uuid("Selecione o fornecedor."),
    numero: z.string().trim().min(1, "Informe o número do contrato.").max(60),
    cadencia: z.enum(CADENCIAS),
    data_inicio: z.string().min(1, "Informe a data de início."),
    data_fim_prevista: dataOpcional,
    status: z.enum(STATUS_CONTRATOS),
    observacoes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    cobranca_prorata: z.boolean(),
  })
  // Regra cruzada: só o zod pega, porque depende de dois campos. Antes um
  // contrato podia ser salvo terminando antes de começar, e o erro só apareceria
  // no cálculo de custo, muito depois.
  .refine(
    (d) => !d.data_fim_prevista || d.data_fim_prevista >= d.data_inicio,
    {
      message: "A data de término não pode ser anterior à de início.",
      path: ["data_fim_prevista"],
    },
  );

export type ContratoInput = z.input<typeof contratoSchema>;
export type ContratoDados = z.output<typeof contratoSchema>;
