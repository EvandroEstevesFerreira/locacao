// Domínio Devolução de equipamento — schemas e rótulos, client-safe.
//
// Espelha `recebimento.ts`, que é o modelo aprovado: os schemas são importados
// tanto pela action (validação de verdade) quanto pelo formulário (validação
// por campo via zodResolver), e um arquivo "use server" não pode ser importado
// por componente cliente.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import { opcional, textoOpcional, uuidOpcional } from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";

// ═══════════════════════════════════════════════════════════════════════════
// Estados e rótulos
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS_DEVOLUCAO = ["rascunho", "fechado"] as const;
export type StatusDevolucao = (typeof STATUS_DEVOLUCAO)[number];

export const STATUS_DEVOLUCAO_INFO: Record<
  StatusDevolucao,
  { label: string; variant: "secondary" | "default"; ajuda: string }
> = {
  rascunho: {
    label: "Rascunho",
    variant: "secondary",
    ajuda: "Ainda editável. O saldo do contrato não foi baixado.",
  },
  fechado: {
    label: "Fechado",
    variant: "default",
    ajuda: "Congelado, numerado, saldo baixado e fornecedor avisado.",
  },
};

/**
 * Em que estado o item voltou.
 *
 * NÃO é o mesmo conjunto do recebimento, e a diferença é real: lá existe
 * "divergência" (chegou algo fora do contrato), que na devolução não faz
 * sentido — só se devolve o que foi locado. No lugar dela entra "faltante",
 * que é o caso que só existe na volta: o equipamento não voltou porque sumiu.
 */
export const CONDICOES_DEVOLUCAO = ["ok", "avaria", "faltante"] as const;
export type CondicaoDevolucao = (typeof CONDICOES_DEVOLUCAO)[number];

export const CONDICAO_DEVOLUCAO_INFO: Record<
  CondicaoDevolucao,
  { label: string; variant: "outline" | "destructive" | "secondary"; ajuda: string }
> = {
  ok: {
    label: "Conforme",
    variant: "outline",
    ajuda: "Voltou em ordem, com o desgaste normal do uso.",
  },
  avaria: {
    label: "Com avaria",
    variant: "destructive",
    ajuda: "Voltou danificado. Descreva o dano — vira laudo de avaria.",
  },
  faltante: {
    label: "Não devolvido",
    variant: "secondary",
    ajuda:
      "Extraviado ou consumido em obra. Baixa o saldo e encerra a cobrança, mas o fornecedor vai cobrar a reposição.",
  },
};

export function condicaoDevolucaoLabel(c: string): string {
  return CONDICAO_DEVOLUCAO_INFO[c as CondicaoDevolucao]?.label ?? c;
}

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cabeçalho da devolução. `id` presente = edição do rascunho.
 *
 * `devolvido_em` é obrigatório e NÃO tem default de "hoje": o caminhão sai da
 * obra num dia e a nota chega ao escritório noutro, e um default silencioso
 * faria o documento sair com a data da digitação em vez da da entrega.
 *
 * A validação é `ehDataISO` e não um regex escrito aqui. Um `/^\d{4}-\d{2}-\d{2}$/`
 * digitado dentro de template literal já perdeu as barras invertidas duas vezes
 * neste projeto, e a segunda foi para produção: o botão de registrar recebimento
 * ficou sem fazer nada, em silêncio (v0.39.0).
 */
export const devolucaoSchema = z.object({
  id: uuidOpcional,
  contrato_id: z.string().uuid("Selecione o contrato."),
  devolvido_em: z
    .string()
    .refine(ehDataISO, "Informe a data da devolução."),
  responsavel: textoOpcional(200),
  nota_fornecedor: textoOpcional(60),
  observacoes: textoOpcional(2000),
});

export type DevolucaoInput = z.input<typeof devolucaoSchema>;
export type DevolucaoDados = z.output<typeof devolucaoSchema>;

/**
 * Uma linha da devolução.
 *
 * `item_locado_id` é OBRIGATÓRIO aqui, ao contrário do recebimento. A assimetria
 * é deliberada: no recebimento pode chegar algo fora do contrato e o conferente
 * precisa poder registrar isso; na devolução, devolver item que não está no
 * contrato não é divergência a registrar, é erro de digitação a corrigir.
 */
export const devolucaoItemSchema = z
  .object({
    id: uuidOpcional,
    devolucao_id: z.string().uuid(),
    item_locado_id: z.string().uuid("Selecione o item do contrato."),
    unidade_id: uuidOpcional,
    quantidade: z.coerce
      .number()
      .positive("A quantidade devolvida tem de ser maior que zero."),
    condicao: z.enum(CONDICOES_DEVOLUCAO),
    observacoes: textoOpcional(1000),
  })
  // Avaria ou falta sem descrição deixam o documento inútil: o fornecedor recebe
  // "1 item com avaria" e não sabe qual peça nem qual dano — e é sobre esse
  // texto que a cobrança de reposição vai ser discutida.
  .refine((v) => v.condicao === "ok" || v.observacoes !== null, {
    message: "Descreva a avaria ou explique por que o item não voltou.",
    path: ["observacoes"],
  });

export type DevolucaoItemInput = z.input<typeof devolucaoItemSchema>;
export type DevolucaoItemDados = z.output<typeof devolucaoItemSchema>;

/** Fechamento — o passo irreversível. */
export const fecharDevolucaoSchema = z.object({
  id: z.string().uuid(),
  /**
   * Confirmação explícita de que o fechamento baixa o saldo e avisa o
   * fornecedor. Um booleano, e não um `confirm()` no cliente: a action é o
   * último ponto em que dá para exigir a decisão, e o cliente pode ser
   * contornado.
   */
  ciente: z.literal(true, {
    message: "Confirme que o saldo será baixado e o fornecedor avisado.",
  }),
  observacoes: opcional,
});

export type FecharDevolucaoDados = z.output<typeof fecharDevolucaoSchema>;
