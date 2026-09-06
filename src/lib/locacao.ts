import { z } from "zod";
import { differenceInCalendarDays } from "date-fns";
import {
  idOpcional,
  dataOpcional as dataOpcionalCampo,
  textoOpcional,
  uuidOpcional,
} from "@/lib/campos";

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

/**
 * A string é uma data de calendário 'yyyy-mm-dd'?
 *
 * Existe para NÃO haver uma segunda cópia do regex por aí. A primeira cópia
 * escrita à mão saiu como `/^d{4}-d{2}-d{2}$/` — sem as contrabarras — e
 * recusava TODA data válida, fazendo a action que a usava retornar cedo e não
 * criar nada. Chamada silenciosa, sem erro, botão que não faz nada.
 */
export function ehDataISO(v: string | null | undefined): boolean {
  return typeof v === "string" && SO_DATA.test(v);
}

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

/**
 * "Hoje" como `Date` de meia-noite, ancorado no fuso de São Paulo.
 *
 * Use isto — e nunca `new Date()` — sempre que a data for comparada com uma
 * coluna `date` do banco, seja por `differenceInCalendarDays`, `periodosEntre`
 * ou `format(…, "yyyy-MM-dd")`.
 *
 * Motivo: `new Date()` é um INSTANTE, e as datas do banco chegam por
 * `dataDeISO`, que devolve meia-noite. Comparar os dois em dia de calendário usa
 * o fuso do runtime, e o Vercel roda em UTC — então a partir das 21h em Brasília
 * o instante já pertence ao dia seguinte e a contagem de dias sai um dia maior.
 * Em cima disso está o cálculo de custo de locação: um período a mais cobrado.
 */
export function hojeSaoPaulo(base: Date = new Date()): Date {
  return dataDeISO(hojeISOSaoPaulo(base));
}

/** Primeiro e último dia de um mês 'yyyy-MM', como 'yyyy-mm-dd'. */
export type IntervaloMes = { inicio: string; fim: string };

/**
 * Converte 'yyyy-MM' no intervalo de datas do mês, para comparar com coluna
 * `date` do banco.
 *
 * Aritmética pura de calendário, em UTC: a entrada JÁ É um mês de calendário,
 * não um instante, e reinterpretá-la num fuso local deslocaria as bordas em um
 * dia — o mesmo erro que cobrava um dia extra de locação na 0.22.0. Por isso
 * também não há `new Date()` sem argumentos aqui: nada nesta função depende de
 * "agora".
 *
 * O truque do último dia é `Date.UTC(ano, mes, 0)`: dia 0 do mês SEGUINTE é o
 * último do mês pedido, e o próprio Date resolve fevereiro e ano bissexto.
 *
 * Devolve `null` para entrada malformada — quem chama trata como "sem filtro",
 * porque o mês vem da querystring e o usuário pode digitar qualquer coisa.
 */
export function intervaloDoMes(mes: string | undefined | null): IntervaloMes | null {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return null;
  const [ano, m] = mes.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return {
    inicio: `${mes}-01`,
    fim: `${mes}-${String(ultimo).padStart(2, "0")}`,
  };
}

/** Rótulo "ago/2026" de um mês 'yyyy-MM'. Vazio quando o mês é inválido. */
export function rotuloMes(mes: string | undefined | null): string {
  if (!intervaloDoMes(mes)) return "";
  const [ano, m] = mes!.split("-").map(Number);
  return `${MESES_CURTOS[m - 1]}/${ano}`;
}

const MESES_CURTOS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

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

// Reexportado de `campos.ts` — a cópia local aceitava só `string | undefined`
// e recusava o próprio output na re-validação da action.
const dataOpcional = dataOpcionalCampo;

export const contratoSchema = z
  .object({
    id: idOpcional,
    obra_id: z.string().uuid("Selecione a obra."),
    fornecedor_id: z.string().uuid("Selecione o fornecedor."),
    numero: z.string().trim().min(1, "Informe o número do contrato.").max(60),
    cadencia: z.enum(CADENCIAS),
    data_inicio: z.string().min(1, "Informe a data de início."),
    data_fim_prevista: dataOpcional,
    status: z.enum(STATUS_CONTRATOS),
    observacoes: textoOpcional(1000),
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

export const itemLocadoSchema = z
  .object({
    contrato_id: z.string().uuid(),
    item_id: z.string().uuid("Selecione o item."),
    quantidade: z.coerce.number().positive("A quantidade deve ser maior que zero."),
    valor_unitario_periodo: z.coerce.number().min(0, "Valor inválido."),
    data_retirada: z.string().min(1, "Informe a data de retirada."),
    data_devolucao_prevista: dataOpcional,
    identificacao: textoOpcional(120),
    /**
     * A frente de serviço a que este item é alocado (migration 0072).
     *
     * É o que FAZ O CUSTO DESCER. Sem ela, o custo de locação morre na obra:
     * sabe-se que a obra gastou, não em quê.
     *
     * OPCIONAL, e permanentemente: obra sem frentes definidas continua
     * funcionando exatamente como antes, e o custo continua sendo da obra.
     * Exigir travaria o cadastro de contrato de toda obra que ainda não
     * organizou suas frentes.
     */
    frente_id: uuidOpcional,
  })
  // Regra cruzada: devolver antes de retirar não existe, e o custo por período
  // sairia negativo.
  .refine(
    (d) => !d.data_devolucao_prevista || d.data_devolucao_prevista >= d.data_retirada,
    {
      message: "A devolução prevista não pode ser anterior à retirada.",
      path: ["data_devolucao_prevista"],
    },
  );

export type ItemLocadoInput = z.input<typeof itemLocadoSchema>;
export type ItemLocadoDados = z.output<typeof itemLocadoSchema>;
