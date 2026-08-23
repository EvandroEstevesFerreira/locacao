// Domínio Alojamento: medida disciplinar (FRM-RH-002) e entregas ao ocupante
// (FRM-RH-003 chaves, FRM-RH-004 kit).
//
// Sem dependência de servidor: os schemas são importados tanto pela action
// (validação de verdade) quanto pelos formulários (validação por campo via
// zodResolver). Um arquivo "use server" não pode ser importado por componente
// cliente, então o schema não pode morar no actions.ts.

import { z } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Medida disciplinar
// ═══════════════════════════════════════════════════════════════════════════

export const TIPOS_MEDIDA = ["verbal", "escrita", "suspensao", "outra"] as const;
export type TipoMedida = (typeof TIPOS_MEDIDA)[number];

export const TIPO_MEDIDA_INFO: Record<
  TipoMedida,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  verbal: { label: "Advertência verbal", variant: "outline" },
  escrita: { label: "Advertência escrita", variant: "secondary" },
  suspensao: { label: "Suspensão", variant: "destructive" },
  outra: { label: "Outra medida", variant: "default" },
};

export const CIENCIAS = ["recebeu", "com_ressalva", "recusou"] as const;
export type Ciencia = (typeof CIENCIAS)[number];

export const CIENCIA_INFO: Record<Ciencia, string> = {
  recebeu: "Recebeu e deu ciência",
  com_ressalva: "Recebeu com ressalva (manifestação em 5 dias úteis)",
  recusou: "Recusou-se a assinar (registrado com duas testemunhas)",
};

/** Itens da POL-RH-001 que uma medida pode invocar. */
export const REGRAS_POLITICA: { chave: string; label: string }[] = [
  { chave: "6.1", label: "Convivência (item 6.1)" },
  { chave: "6.2", label: "Higiene e organização (item 6.2)" },
  { chave: "6.3", label: "Segurança (item 6.3)" },
  { chave: "6.4", label: "Refeitório e cozinha (item 6.4)" },
  { chave: "6.5", label: "Áreas externas e fumantes (item 6.5)" },
  { chave: "7.1", label: "Substâncias e comportamentos (item 7.1)" },
  { chave: "7.2", label: "Proibição de cozinhar (item 7.2)" },
  { chave: "8", label: "Armário individual (item 8)" },
  { chave: "9", label: "Sistema de câmeras / CFTV (item 9)" },
];

export function tipoMedidaLabel(t: string): string {
  return TIPO_MEDIDA_INFO[t as TipoMedida]?.label ?? "Medida disciplinar";
}

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

const dataOpcional = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

export const medidaDisciplinarSchema = z
  .object({
    ocupante_id: z.string().uuid("Selecione o alojado."),
    imovel_id: z.string().uuid(),
    data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data da medida."),
    tipo: z.enum(TIPOS_MEDIDA),
    suspensao_dias: z
      .union([z.literal(""), z.coerce.number().int()])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    suspensao_inicio: dataOpcional,
    suspensao_fim: dataOpcional,
    fato_em: dataOpcional,
    fato_local: texto(200),
    fato_descricao: z
      .string()
      .trim()
      .min(10, "Descreva o fato com pelo menos 10 caracteres.")
      .max(4000),
    testemunhas: texto(500),
    regras_violadas: z.array(z.string()).optional().default([]),
    clt_artigo: texto(60),
    reincidencia: z.boolean().optional().default(false),
    fundamentacao: texto(4000),
    ciencia: z
      .union([z.literal(""), z.enum(CIENCIAS)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    ciencia_em: dataOpcional,
  })
  // O art. 474 da CLT limita a suspensão a 30 dias; acima disso a medida
  // configura rescisão. O banco também recusa, mas o formulário avisa antes.
  .refine(
    (v) =>
      v.tipo !== "suspensao" ||
      (v.suspensao_dias !== null && v.suspensao_dias >= 1 && v.suspensao_dias <= 30),
    {
      message: "A suspensão vai de 1 a 30 dias (CLT, art. 474).",
      path: ["suspensao_dias"],
    },
  )
  .refine((v) => v.tipo !== "suspensao" || v.suspensao_inicio !== null, {
    message: "Informe a data de início da suspensão.",
    path: ["suspensao_inicio"],
  })
  .refine(
    (v) => !v.suspensao_fim || !v.suspensao_inicio || v.suspensao_fim >= v.suspensao_inicio,
    { message: "O fim não pode ser anterior ao início.", path: ["suspensao_fim"] },
  );

export type MedidaDisciplinarInput = z.input<typeof medidaDisciplinarSchema>;
export type MedidaDisciplinarDados = z.output<typeof medidaDisciplinarSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Entrega ao ocupante (chaves e kit)
// ═══════════════════════════════════════════════════════════════════════════

export const TIPOS_ENTREGA = ["chaves", "kit"] as const;
export type TipoEntrega = (typeof TIPOS_ENTREGA)[number];

export const TIPO_ENTREGA_INFO: Record<TipoEntrega, { label: string; doc: string }> = {
  chaves: { label: "Chaves e acessos", doc: "FRM-RH-003" },
  kit: { label: "Kit de alojamento", doc: "FRM-RH-004" },
};

export const MOTIVOS_DEVOLUCAO = [
  "desligamento",
  "transferencia",
  "termino_contrato",
  "outro",
] as const;
export type MotivoDevolucao = (typeof MOTIVOS_DEVOLUCAO)[number];

export const MOTIVO_DEVOLUCAO_INFO: Record<MotivoDevolucao, string> = {
  desligamento: "Desligamento da empresa",
  transferencia: "Transferência para outro contrato ou alojamento",
  termino_contrato: "Término do contrato ou da obra",
  outro: "Outro motivo",
};

export const TRATATIVAS = ["sem_ressalva", "desgaste_natural", "atribuivel"] as const;
export type Tratativa = (typeof TRATATIVAS)[number];

export const TRATATIVA_INFO: Record<Tratativa, string> = {
  sem_ressalva: "Sem avarias — devolução aceita integralmente",
  desgaste_natural: "Desgaste natural — não gera cobrança",
  atribuivel: "Atribuível ao empregado — encaminhar ao RH",
};

/**
 * Itens de cada tipo de entrega — FONTE ÚNICA.
 *
 * O formulário grava exatamente estes rótulos em `entrega_ocupante.itens`, e o
 * PDF os compara para marcar as caixas. Duas listas separadas já produziram um
 * defeito silencioso: o formulário gravava "Lençol (par)" e o PDF comparava com
 * "Lençol (par — inferior e superior)", então o lençol nunca era marcado e nada
 * acusava. `alojamento.test.ts` guarda a coincidência entre as duas pontas.
 */
export const ITENS_ENTREGA: Record<
  TipoEntrega,
  { item: string; quantidade: string }[]
> = {
  chaves: [
    { item: "Chave da porta de entrada do alojamento", quantidade: "" },
    { item: "Chave da porta do quarto", quantidade: "" },
    { item: "Cadeado do armário individual", quantidade: "" },
    { item: "Chave / segredo do cadeado", quantidade: "" },
    { item: "Controle de portão / acesso", quantidade: "" },
  ],
  kit: [
    { item: "Lençol (par — inferior e superior)", quantidade: "1 jogo" },
    { item: "Fronha", quantidade: "1 unid." },
    { item: "Travesseiro", quantidade: "1 unid." },
    { item: "Cobertor", quantidade: "1 unid." },
  ],
};

/** Só os rótulos, para os checkboxes do formulário. */
export const ITENS_PADRAO: Record<TipoEntrega, string[]> = {
  chaves: ITENS_ENTREGA.chaves.map((i) => i.item),
  kit: ITENS_ENTREGA.kit.map((i) => i.item),
};

export function tipoEntregaLabel(t: string): string {
  return TIPO_ENTREGA_INFO[t as TipoEntrega]?.label ?? "Entrega";
}

export const entregaOcupanteSchema = z
  .object({
    ocupante_id: z.string().uuid("Selecione o alojado."),
    imovel_id: z.string().uuid(),
    tipo: z.enum(TIPOS_ENTREGA),
    entregue_em: dataOpcional,
    devolvido_em: dataOpcional,
    devolucao_motivo: z
      .union([z.literal(""), z.enum(MOTIVOS_DEVOLUCAO)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    itens: z.array(z.string()).optional().default([]),
    avarias: texto(4000),
    tratativa: z
      .union([z.literal(""), z.enum(TRATATIVAS)])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
  })
  .refine((v) => v.entregue_em !== null || v.devolvido_em !== null, {
    message: "Informe a data de entrega ou a de devolução.",
    path: ["entregue_em"],
  })
  .refine(
    (v) => !v.devolvido_em || !v.entregue_em || v.devolvido_em >= v.entregue_em,
    {
      message: "A devolução não pode ser anterior à entrega.",
      path: ["devolvido_em"],
    },
  )
  // Devolução sem tratativa deixa em aberto se houve cobrança — que é
  // justamente o que o formulário existe para registrar.
  .refine((v) => !v.devolvido_em || v.tratativa !== null, {
    message: "Registre a tratativa da devolução.",
    path: ["tratativa"],
  });

export type EntregaOcupanteInput = z.input<typeof entregaOcupanteSchema>;
export type EntregaOcupanteDados = z.output<typeof entregaOcupanteSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Semana da rotina de limpeza
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Segunda-feira da semana de uma data ISO (`yyyy-mm-dd`).
 *
 * A folha de limpeza é semanal e a coluna `semana_inicio` guarda sempre a
 * segunda. O cálculo é feito em UTC de propósito: a entrada JÁ É uma data de
 * calendário (vinda de `hojeISOSaoPaulo()`), e reinterpretá-la num fuso local
 * a deslocaria de um dia — o mesmo erro que cobrava um dia extra de locação na
 * 0.22.0. Aqui não há instante nenhum, só aritmética de dias.
 */
export function segundaFeiraDaSemana(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  // getUTCDay(): 0 = domingo. Domingo pertence à semana que começou na segunda
  // anterior, seis dias antes — e não à que começa no dia seguinte.
  const diaDaSemana = d.getUTCDay();
  const recuo = diaDaSemana === 0 ? 6 : diaDaSemana - 1;
  d.setUTCDate(d.getUTCDate() - recuo);
  return d.toISOString().slice(0, 10);
}

/** Rótulo "dd/mm a dd/mm" da semana que começa na segunda informada. */
export function rotuloSemana(segunda: string): string {
  const [a, m, d] = segunda.split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 1, d));
  const fim = new Date(Date.UTC(a, m - 1, d + 6));
  const fmt = (x: Date) =>
    `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${fmt(ini)} a ${fmt(fim)}`;
}
