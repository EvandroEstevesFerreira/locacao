// Tipos e rótulos do módulo Imóveis (client-safe — sem imports de servidor).

import { z } from "zod";
import { idOpcional } from "@/lib/campos";

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

/**
 * IDEMPOTÊNCIA — leia antes de mexer nestes helpers.
 *
 * Toda action deste módulo re-valida o que recebe (`schema.safeParse(raw)`), e o
 * que ela recebe é o OUTPUT do mesmo schema, já transformado pelo zodResolver no
 * cliente. Logo o schema tem de aceitar o próprio output: `parse(parse(x))` deve
 * dar `parse(x)`.
 *
 * Os helpers abaixo não aceitavam. Produziam `null` para campo vazio e só
 * aceitavam `string | undefined` na entrada, então re-validar devolvia
 * "Invalid input: expected string, received null" e a action respondia com erro
 * genérico. Efeito prático: registrar reparo sem preencher "Executor" falhava
 * desde a 0.23.0, e cadastrar ocupante sem CPF falhava desde a 0.24.0 — sem
 * nenhum teste acusar, porque os testes só validavam a PRIMEIRA passagem.
 *
 * `imoveis.test.ts` e `alojamento.test.ts` guardam a idempotência de cada schema.
 */
const texto = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = (v ?? "").trim();
      return s.length > 0 ? s : null;
    })
    .refine((v) => v === null || v.length <= max, {
      message: `Use no máximo ${max} caracteres.`,
    });

/** String opcional crua (data, uuid, chave de enum), idempotente. */
const stringOpcional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => {
    const s = (v ?? "").trim();
    return s.length > 0 ? s : null;
  });

/** Como stringOpcional, mas só aceita valores de uma lista conhecida. */
const daLista = (valores: readonly string[]) =>
  stringOpcional.transform((v) => (v && valores.includes(v) ? v : null));

const emailOpcional = (rotulo: string) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = (v ?? "").trim();
      return s.length > 0 ? s : null;
    })
    .refine((v) => v === null || v.length <= 200, {
      message: `${rotulo} muito longo.`,
    })
    .refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: `${rotulo} inválido.`,
    });

/** Número opcional que aceita vírgula decimal, como o usuário digita. */
const numeroOpcional = (msg: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
    )
    .refine((v) => v === "" || Number.isFinite(Number(v)), { message: msg })
    .transform((v) => (v === "" ? null : Number(v)));

const dinheiro = (msg: string) =>
  z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .transform((v) =>
      typeof v === "number" ? String(v) : (v ?? "").trim().replace(",", "."),
    )
    .refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), {
      message: msg,
    })
    .transform((v) => (v === "" ? 0 : Number(v)));

export const imovelSchema = z.object({
  id: idOpcional,
  tipo: z.enum(TIPOS_IMOVEL as [TipoImovel, ...TipoImovel[]]),
  apelido: z
    .string()
    .trim()
    .min(1, "Informe uma identificação (apelido) do imóvel.")
    .max(120),
  endereco: texto(300),
  cidade: texto(120),
  uf: z
    .union([z.string(), z.null()])
    .optional()
    .transform((v) => {
      const s = (v ?? "").trim();
      return s.length > 0 ? s.toUpperCase() : null;
    })
    .refine((v) => v === null || /^[A-Z]{2}$/.test(v), {
      message: "UF deve ter 2 letras.",
    }),
  capacidade_pessoas: numeroOpcional("Capacidade inválida."),
  area_m2: numeroOpcional("Área inválida."),
  obra_id: stringOpcional,
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
  tipo_conta: daLista(TIPOS_CONTA),
  titular_conta: texto(200),
  pix_chave: texto(200),
  observacoes: texto(1000),
});

export type ImovelInput = z.input<typeof imovelSchema>;
export type ImovelDados = z.output<typeof imovelSchema>;

export const contratoImovelSchema = z
  .object({
    id: idOpcional,
    imovel_id: z.string().uuid(),
    data_inicio: z
      .string()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    data_fim: stringOpcional,
    valor_aluguel: dinheiro("Valor do aluguel inválido."),
    valor_condominio: dinheiro("Valor do condomínio inválido."),
    valor_iptu: dinheiro("Valor do IPTU inválido."),
    seguro_fianca: dinheiro("Valor do seguro-fiança inválido."),
    seguro_fianca_mensal: z.boolean(),
    dia_vencimento: z
      .union([z.string(), z.number(), z.null()])
      .optional()
      .transform((v) => (typeof v === "number" ? String(v) : (v ?? "").trim()))
      .refine(
        (v) => v === "" || (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 31),
        { message: "O dia do vencimento deve estar entre 1 e 31." },
      )
      .transform((v) => (v === "" ? null : Number(v))),
    indice_reajuste: texto(40),
    data_reajuste: stringOpcional,
    caucao_valor: numeroOpcional("Valor da caução inválido."),
    caucao_status: daLista(STATUS_CAUCAO),
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
    id: idOpcional,
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

/**
 * Reparo executado no imóvel.
 *
 * `valor` é opcional (às vezes o reparo é por conta do proprietário), mas quando
 * vem preenchido tem de ser um número — a versão anterior fazia `num(...) ?? 0`
 * e transformava qualquer texto inválido em zero, em silêncio, num campo de
 * dinheiro.
 */
export const reparoSchema = z.object({
  imovel_id: z.string().uuid(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do reparo."),
  descricao: z
    .string()
    .trim()
    .min(3, "Descreva o que foi reparado (mínimo 3 caracteres).")
    .max(300, "Descrição muito longa (máximo 300 caracteres)."),
  // `z.null()` antes do coerce: `z.coerce.number()` converteria null em 0 e
  // esconderia a diferença entre "não informado" e "zero".
  valor: z
    .union([
      z.literal(""),
      z.null(),
      z.coerce.number().nonnegative("O valor não pode ser negativo."),
    ])
    .optional()
    .transform((v) => (v === "" || v == null ? 0 : v)),
  executor: texto(120),
});

export type ReparoInput = z.input<typeof reparoSchema>;
export type ReparoDados = z.output<typeof reparoSchema>;

/**
 * Ocupante (alojado) de um imóvel.
 *
 * `cargo`, `quarto` e `armario` alimentam o bloco de identificação do
 * FRM-RH-001. Os demais campos daquele bloco (RG, admissão, encarregado,
 * contato de emergência) saem em branco no PDF de propósito — ver a migration
 * 0043 e a spec de 2026-08-22.
 *
 * A comparação de datas é lexicográfica sobre `yyyy-mm-dd`, que para esse
 * formato é idêntica à cronológica. Nada de `new Date()` aqui: seria fuso
 * errado (o Vercel roda em UTC) e desnecessário.
 */
export const ocupanteSchema = z
  .object({
    imovel_id: z.string().uuid(),
    nome: z.string().trim().min(1, "Informe o nome do ocupante.").max(200),
    cpf: texto(20),
    contato: texto(40),
    cargo: texto(120),
    quarto: texto(40),
    armario: texto(40),
    data_entrada: texto(10),
    data_saida: texto(10),
    observacoes: texto(1000),
  })
  .refine(
    (v) => !v.data_entrada || !v.data_saida || v.data_saida >= v.data_entrada,
    { message: "A saída não pode ser anterior à entrada.", path: ["data_saida"] },
  );

export type OcupanteInput = z.input<typeof ocupanteSchema>;
export type OcupanteDados = z.output<typeof ocupanteSchema>;
