// Frota: a peça de equipamento, e a regra de como sua situação muda.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// O catálogo (`item_catalogo`) diz O QUE a coisa é. A peça
// (`equipamento_unidade`) diz QUAL coisa, individualmente — e tinha dois campos
// úteis: identificador e observações. É lá que faltava tudo para responder "onde
// está minha betoneira".
//
// A MATRIZ DE TRANSIÇÃO mora aqui, e só aqui. Espalhada pelas actions, cada
// tela inventa a sua regra e a sexta esquece uma — e a regra que se esquece é
// sempre a que protege: marcar "perdida" numa peça em uso apagaria em silêncio
// o fato de alguém ter ASSINADO por ela.
//
// Nesta fatia o evento (termo assinado) ainda não existe, então `em_uso` é
// inalcançável e toda peça nasce `disponivel`. A matriz é escrita e testada
// agora para que a fatia do termo só CHAME a função, sem redecidir a regra.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional, opcional, textoOpcional, uuidOpcional } from "@/lib/campos";

export const SITUACOES = [
  "disponivel",
  "em_uso",
  "manutencao",
  "baixada",
  "perdida",
] as const;
export type Situacao = (typeof SITUACOES)[number];

export const SITUACAO_INFO: Record<
  Situacao,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  disponivel: { label: "Disponível", variant: "default" },
  em_uso: { label: "Em uso", variant: "secondary" },
  manutencao: { label: "Em manutenção", variant: "outline" },
  baixada: { label: "Baixada", variant: "outline" },
  perdida: { label: "Perdida", variant: "destructive" },
};

export const PROPRIEDADES = ["locada", "propria"] as const;
export type Propriedade = (typeof PROPRIEDADES)[number];

export const PROPRIEDADE_INFO: Record<Propriedade, { label: string }> = {
  locada: { label: "Locada de terceiro" },
  propria: { label: "Própria da Sistenge" },
};

export const ESTADOS = ["novo", "bom", "regular", "com_avaria"] as const;
export type Estado = (typeof ESTADOS)[number];

export const ESTADO_INFO: Record<Estado, { label: string }> = {
  novo: { label: "Novo" },
  bom: { label: "Bom" },
  regular: { label: "Regular" },
  com_avaria: { label: "Com avaria" },
};

/** De onde a mudança vem: da mão do usuário ou de um evento do sistema. */
export type Origem = "manual" | "evento";

/**
 * A matriz. Cada situação lista para onde pode ir, e por qual origem.
 *
 * Ausência de uma chave é bloqueio — o padrão é NÃO permitir. É o que faz uma
 * transição nova precisar ser escrita aqui de propósito, em vez de aparecer por
 * descuido.
 */
const MATRIZ: Record<Situacao, Partial<Record<Situacao, Origem[]>>> = {
  disponivel: {
    // Só evento: o termo assinado é o que autoriza dizer que está em uso.
    em_uso: ["evento"],
    manutencao: ["manual"],
    baixada: ["manual"],
    perdida: ["manual"],
  },
  em_uso: {
    // Só evento: a devolução registrada no termo é o que libera a peça.
    disponivel: ["evento"],
    // manutencao, baixada e perdida NÃO entram de propósito. Ver `motivoBloqueio`.
  },
  manutencao: {
    // Passa por `disponivel` antes de voltar a uso: é onde alguém confere que a
    // peça voltou inteira.
    disponivel: ["manual"],
    baixada: ["manual"],
  },
  baixada: {
    // Reversão de erro de digitação.
    disponivel: ["manual"],
  },
  perdida: {
    // A peça apareceu.
    disponivel: ["manual"],
  },
};

/** A transição é permitida? Salvar sem mudar a situação sempre é. */
export function podeTransicionar(
  de: Situacao,
  para: Situacao,
  origem: Origem,
): boolean {
  if (de === para) return true;
  return MATRIZ[de][para]?.includes(origem) ?? false;
}

/**
 * Por que a transição foi bloqueada, em texto para o usuário.
 *
 * Dizer o MOTIVO é o que transforma um bloqueio em instrução. "Não permitido"
 * faria a pessoa tentar de novo; "encerre o termo primeiro" resolve.
 */
export function motivoBloqueio(de: Situacao, para: Situacao): string | null {
  if (podeTransicionar(de, para, "manual")) return null;

  if (de === "em_uso") {
    return "A peça está em uso. Encerre o termo de responsabilidade antes de baixá-la.";
  }
  if (para === "em_uso") {
    return "“Em uso” é definido pelo termo de responsabilidade, não à mão.";
  }
  return `Não é possível passar de ${SITUACAO_INFO[de].label} para ${SITUACAO_INFO[para].label}.`;
}

/**
 * Os destinos que o formulário pode oferecer a partir de uma situação.
 *
 * Inclui a própria situação: o select precisa poder mostrar o valor atual sem
 * que salvar sem mexer seja um erro.
 */
export function transicoesManuais(de: Situacao): Situacao[] {
  return SITUACOES.filter((s) => podeTransicionar(de, s, "manual"));
}

// ── Schema ───────────────────────────────────────────────────────────────────
// Mudou de lugar: morava dentro de `itens/actions.ts`, que é "use server" —
// inalcançável para componente cliente e invisível para a varredura de schemas.

/** Ano de fabricação. A faixa espelha o `check` da migration. */
const anoOpcional = z
  .union([z.literal(""), z.null(), z.coerce.number()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1950 && v <= 2100), {
    message: "Ano deve estar entre 1950 e 2100.",
  });

/** Enum opcional que também aceita `""` do `<option>` vazio e o próprio `null`. */
const enumOpcionalEstado = z
  .union([z.literal(""), z.null(), z.enum(ESTADOS)])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

export const unidadeSchema = z.object({
  id: idOpcional,
  item_id: z.string().uuid("Selecione o item do catálogo."),
  identificador: z.string().trim().min(1, "Informe o identificador.").max(80),
  numero_serie: textoOpcional(80),
  propriedade: z.enum(PROPRIEDADES).default("locada"),
  situacao: z.enum(SITUACOES).default("disponivel"),
  // NULO = almoxarifado central. Não é dado faltando: é um estado legítimo, e é
  // o de toda peça já cadastrada.
  obra_id: uuidOpcional,
  ano: anoOpcional,
  estado: enumOpcionalEstado,
  observacoes: opcional.refine((v) => v === null || v.length <= 300, {
    message: "Use no máximo 300 caracteres.",
  }),
});

export type UnidadeInput = z.input<typeof unidadeSchema>;
export type UnidadeDados = z.output<typeof unidadeSchema>;

export const categoriaSchema = z.object({
  id: idOpcional,
  nome: z.string().trim().min(1, "Informe o nome da categoria.").max(80),
  ordem: z.coerce.number().int().min(0).max(999).default(0),
  ativo: z.boolean().default(true),
});

export type CategoriaInput = z.input<typeof categoriaSchema>;
export type CategoriaDados = z.output<typeof categoriaSchema>;
