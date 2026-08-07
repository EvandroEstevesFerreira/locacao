// Tipos e rótulos do módulo Imóveis (client-safe — sem imports de servidor).

import { z } from "zod";

export type TipoImovel =
  | "kitnet"
  | "apartamento"
  | "casa"
  | "galpao"
  | "escritorio"
  | "outro";

export type StatusImovel = "ativo" | "desocupacao" | "encerrado";

export type StatusCaucao = "em_aberto" | "devolvida" | "retida";

export const TIPO_IMOVEL_INFO: Record<TipoImovel, string> = {
  kitnet: "Kitnet",
  apartamento: "Apartamento",
  casa: "Casa",
  galpao: "Galpão",
  escritorio: "Escritório",
  outro: "Outro",
};

export const TIPOS_IMOVEL = Object.keys(TIPO_IMOVEL_INFO) as TipoImovel[];

export const STATUS_IMOVEL_INFO: Record<
  StatusImovel,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  ativo: { label: "Ativo", variant: "default" },
  desocupacao: { label: "Em desocupação", variant: "secondary" },
  encerrado: { label: "Encerrado", variant: "destructive" },
};

export const STATUS_CAUCAO_INFO: Record<StatusCaucao, string> = {
  em_aberto: "Em aberto",
  devolvida: "Devolvida",
  retida: "Retida",
};

export function tipoImovelLabel(t: string): string {
  return TIPO_IMOVEL_INFO[t as TipoImovel] ?? t;
}

// --- Contas de consumo (Fase 2) ---
export type TipoConsumo = "agua" | "luz" | "gas" | "internet" | "iptu" | "outro";

export const TIPO_CONSUMO_INFO: Record<TipoConsumo, string> = {
  agua: "Água",
  luz: "Luz",
  gas: "Gás",
  internet: "Internet",
  iptu: "IPTU",
  outro: "Outro",
};

export const TIPOS_CONSUMO = Object.keys(TIPO_CONSUMO_INFO) as TipoConsumo[];

export function tipoConsumoLabel(t: string): string {
  return TIPO_CONSUMO_INFO[t as TipoConsumo] ?? t;
}

// ── Schemas ──────────────────────────────────────────────────────────────────
// Antes destes, `salvarImovel` e `salvarContratoImovel` não tinham validação
// nenhuma: usavam helpers manuais `txt()`/`num()`, e `num(...) ?? 0` transformava
// qualquer lixo digitado em zero — silenciosamente, num campo de dinheiro.
// `dia_vencimento` aceitava 45.


export const TIPOS_CONTA = ["corrente", "poupanca"] as const;
export const STATUS_CAUCAO = ["em_aberto", "devolvida", "retida"] as const;

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const emailOpcional = (rotulo: string) =>
  z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: `${rotulo} inválido.`,
    })
    .transform((v) => (v && v.length > 0 ? v : null));

/** Número opcional que aceita vírgula decimal, como o usuário digita. */
const numeroOpcional = (msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().replace(",", "."))
    .refine((v) => v === "" || Number.isFinite(Number(v)), { message: msg })
    .transform((v) => (v === "" ? null : Number(v)));

const dinheiro = (msg: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? "").trim().replace(",", "."))
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: msg,
    })
    .transform((v) => (v === "" ? 0 : Number(v)));

export const imovelSchema = z.object({
  id: z.string().uuid().optional(),
  tipo: z.enum(TIPOS_IMOVEL as [TipoImovel, ...TipoImovel[]]),
  apelido: z
    .string()
    .trim()
    .min(1, "Informe uma identificação (apelido) do imóvel.")
    .max(120),
  endereco: texto(300),
  cidade: texto(120),
  uf: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: "UF deve ter 2 letras." })
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  capacidade_pessoas: numeroOpcional("Capacidade inválida."),
  area_m2: numeroOpcional("Área inválida."),
  obra_id: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  status: z.enum(["ativo", "desocupacao", "encerrado"] as const),
  proprietario_nome: texto(200),
  proprietario_telefone: texto(40),
  proprietario_email: emailOpcional("E-mail do proprietário"),
  imobiliaria_nome: texto(200),
  imobiliaria_telefone: texto(40),
  imobiliaria_email: emailOpcional("E-mail da imobiliária"),
  banco: texto(80),
  agencia: texto(20),
  conta: texto(30),
  tipo_conta: z
    .string()
    .optional()
    .transform((v) => (v && (TIPOS_CONTA as readonly string[]).includes(v) ? v : null)),
  titular_conta: texto(200),
  pix_chave: texto(200),
  observacoes: texto(1000),
});

export type ImovelInput = z.input<typeof imovelSchema>;
export type ImovelDados = z.output<typeof imovelSchema>;

export const contratoImovelSchema = z
  .object({
    id: z.string().uuid().optional(),
    imovel_id: z.string().uuid(),
    data_inicio: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    data_fim: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    valor_aluguel: dinheiro("Valor do aluguel inválido."),
    valor_condominio: dinheiro("Valor do condomínio inválido."),
    valor_iptu: dinheiro("Valor do IPTU inválido."),
    seguro_fianca: dinheiro("Valor do seguro-fiança inválido."),
    seguro_fianca_mensal: z.boolean(),
    dia_vencimento: z
      .string()
      .optional()
      .transform((v) => (v ?? "").trim())
      .refine(
        (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31),
        { message: "O dia do vencimento deve estar entre 1 e 31." },
      )
      .transform((v) => (v === "" ? null : Number(v))),
    indice_reajuste: texto(40),
    data_reajuste: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    caucao_valor: numeroOpcional("Valor da caução inválido."),
    caucao_status: z
      .string()
      .optional()
      .transform((v) =>
        v && (STATUS_CAUCAO as readonly string[]).includes(v) ? v : null,
      ),
    vigente: z.boolean(),
    observacoes: texto(1000),
  })
  .refine((d) => !d.data_fim || !d.data_inicio || d.data_fim >= d.data_inicio, {
    message: "A data de término não pode ser anterior à de início.",
    path: ["data_fim"],
  })
  // Caução com valor precisa de situação, senão o dinheiro fica sem rastro de
  // "devolvida" ou "retida" quando o contrato encerra.
  .refine((d) => !d.caucao_valor || d.caucao_status !== null, {
    message: "Informe a situação da caução.",
    path: ["caucao_status"],
  });

export type ContratoImovelInput = z.input<typeof contratoImovelSchema>;
export type ContratoImovelDados = z.output<typeof contratoImovelSchema>;

export const contaConsumoSchema = z
  .object({
    id: z.string().uuid().optional(),
    imovel_id: z.string().uuid(),
    tipo: z.enum(TIPOS_CONSUMO as [TipoConsumo, ...TipoConsumo[]]),
    competencia: z
      .string()
      .regex(/^\d{4}-\d{2}(-\d{2})?$/, "Competência inválida (use AAAA-MM)."),
    valor: z.coerce.number().positive("O valor deve ser maior que zero."),
    vencimento: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    pago: z.boolean(),
    /** Cria também um lançamento no financeiro, vinculado à obra do imóvel. */
    lancar: z.boolean(),
    observacoes: texto(500),
  })
  .refine(
    (d) => !d.vencimento || d.vencimento >= `${d.competencia.slice(0, 7)}-01`,
    {
      message: "O vencimento não pode ser anterior ao mês de competência.",
      path: ["vencimento"],
    },
  );

export type ContaConsumoInput = z.input<typeof contaConsumoSchema>;
export type ContaConsumoDados = z.output<typeof contaConsumoSchema>;
