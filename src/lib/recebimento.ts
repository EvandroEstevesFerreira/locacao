// Domínio Recebimento de equipamento — schemas e rótulos, client-safe.
//
// Os schemas são importados tanto pela action (validação de verdade) quanto
// pelo formulário (validação por campo via zodResolver). Um arquivo "use
// server" não pode ser importado por componente cliente, então eles não podem
// morar no actions.ts.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import { opcional, textoOpcional, uuidOpcional } from "@/lib/campos";

// ═══════════════════════════════════════════════════════════════════════════
// Estados e rótulos
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS_RECEBIMENTO = ["rascunho", "fechado"] as const;
export type StatusRecebimento = (typeof STATUS_RECEBIMENTO)[number];

export const STATUS_RECEBIMENTO_INFO: Record<
  StatusRecebimento,
  { label: string; variant: "secondary" | "default"; ajuda: string }
> = {
  rascunho: {
    label: "Rascunho",
    variant: "secondary",
    ajuda: "Ainda editável. Nada saiu do sistema.",
  },
  fechado: {
    label: "Fechado",
    variant: "default",
    ajuda: "Congelado, numerado e comunicado ao fornecedor.",
  },
};

export const CONDICOES = ["ok", "avaria", "divergencia"] as const;
export type Condicao = (typeof CONDICOES)[number];

export const CONDICAO_INFO: Record<
  Condicao,
  { label: string; variant: "outline" | "destructive" | "secondary"; ajuda: string }
> = {
  ok: {
    label: "Conforme",
    variant: "outline",
    ajuda: "Chegou como esperado.",
  },
  avaria: {
    label: "Com avaria",
    variant: "destructive",
    ajuda: "Chegou danificado. Registre o que foi encontrado.",
  },
  divergencia: {
    label: "Divergência",
    variant: "secondary",
    ajuda: "Quantidade, modelo ou item diferente do contratado.",
  },
};

/** Como o item é controlado — decide o campo que o formulário mostra. */
export const CONTROLES = ["quantidade", "peca"] as const;
export type Controle = (typeof CONTROLES)[number];

export const CONTROLE_INFO: Record<Controle, { label: string; ajuda: string }> = {
  quantidade: {
    label: "Por quantidade",
    ajuda: "Material de repetição: andaime, escora, prancha. O lote é a unidade.",
  },
  peca: {
    label: "Por peça (patrimônio)",
    ajuda:
      "Equipamento de valor: betoneira, gerador. Cada peça tem identificador e histórico próprios.",
  },
};

export function condicaoLabel(c: string): string {
  return CONDICAO_INFO[c as Condicao]?.label ?? c;
}

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Cabeçalho do recebimento. `id` presente = edição do rascunho.
 *
 * `recebido_em` é obrigatório e NÃO tem default de "hoje" no schema: quem lança
 * dias depois precisa informar a data real, e um default silencioso faria o
 * documento sair com a data do lançamento em vez da da entrega.
 */
export const recebimentoSchema = z.object({
  id: uuidOpcional,
  contrato_id: z.string().uuid("Selecione o contrato."),
  recebido_em: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data do recebimento."),
  conferente: textoOpcional(200),
  nota_fornecedor: textoOpcional(60),
  observacoes: textoOpcional(2000),
});

export type RecebimentoInput = z.input<typeof recebimentoSchema>;
export type RecebimentoDados = z.output<typeof recebimentoSchema>;

/**
 * Uma linha do recebimento.
 *
 * `item_locado_id` opcional é o que permite registrar DIVERGÊNCIA — chegou algo
 * fora do contrato. Sem isso, o conferente teria de mentir no documento para
 * conseguir salvar.
 */
export const recebimentoItemSchema = z
  .object({
    id: uuidOpcional,
    recebimento_id: z.string().uuid(),
    item_locado_id: uuidOpcional,
    item_id: z.string().uuid("Selecione o item."),
    unidade_id: uuidOpcional,
    quantidade: z.coerce
      .number()
      .positive("A quantidade recebida tem de ser maior que zero."),
    condicao: z.enum(CONDICOES),
    observacoes: textoOpcional(1000),
    /**
     * Como o item selecionado é controlado. Não vai para o banco — serve para o
     * refine abaixo saber se a peça é exigida. O formulário preenche a partir do
     * catálogo.
     */
    controle: z.enum(CONTROLES).optional(),
  })
  // Item controlado por peça SEM peça informada é um recebimento que não
  // rastreia nada: o patrimônio existe justamente para dizer QUAL betoneira
  // chegou. A obrigação fica aqui e não no banco porque o banco precisa aceitar
  // os `item_locado` antigos, que nasceram sem peça.
  .refine((v) => v.controle !== "peca" || v.unidade_id !== null, {
    message: "Este item é controlado por patrimônio. Informe a peça recebida.",
    path: ["unidade_id"],
  })
  // Avaria e divergência sem descrição deixam o documento inútil: o fornecedor
  // recebe "1 item com avaria" e não sabe qual nem o quê.
  .refine((v) => v.condicao === "ok" || v.observacoes !== null, {
    message: "Descreva a avaria ou a divergência encontrada.",
    path: ["observacoes"],
  });

export type RecebimentoItemInput = z.input<typeof recebimentoItemSchema>;
export type RecebimentoItemDados = z.output<typeof recebimentoItemSchema>;

/** Fechamento — o passo irreversível. */
export const fecharRecebimentoSchema = z.object({
  id: z.string().uuid(),
  /**
   * Confirmação explícita de que o fechamento dispara o e-mail ao fornecedor.
   * Um booleano, e não um `confirm()` no cliente: a action é o último ponto em
   * que dá para exigir a decisão, e o cliente pode ser contornado.
   */
  ciente: z.literal(true, {
    message: "Confirme que o fornecedor será avisado ao fechar.",
  }),
  observacoes: opcional,
});

export type FecharRecebimentoDados = z.output<typeof fecharRecebimentoSchema>;
