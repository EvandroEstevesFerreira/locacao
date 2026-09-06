// Domínio Termo de equipamento — schemas e rótulos, client-safe.
//
// Os schemas são importados tanto pela action quanto pelo formulário; um
// arquivo "use server" não pode ser importado por componente cliente, então
// eles não moram no actions.ts.

import { z } from "zod";
import {
  opcional,
  textoOpcional,
  dataOpcional,
  uuidOpcional,
} from "@/lib/campos";
// Estado de conservação é o MESMO conceito da peça de frota, e o mesmo enum
// no banco. Importar em vez de redeclarar é o que impede as duas cópias de
// divergirem — e a divergência apareceria como rótulo errado num documento
// assinado.
import { ESTADOS, ESTADO_INFO, type Estado } from "@/lib/frota";

export { ESTADOS, ESTADO_INFO };
export type { Estado };

export const SITUACOES_TERMO = [
  "rascunho",
  "em_uso",
  "devolvido_parcial",
  "devolvido",
  "cancelado",
] as const;
export type SituacaoTermo = (typeof SITUACOES_TERMO)[number];

export const SITUACAO_TERMO_INFO: Record<
  SituacaoTermo,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive"; ajuda: string }
> = {
  rascunho: {
    label: "Rascunho", variant: "secondary",
    ajuda: "Ainda não assinado. Não gastou número e pode ser excluído.",
  },
  em_uso: {
    label: "Em uso", variant: "default",
    ajuda: "Assinado. O equipamento está com o funcionário.",
  },
  devolvido_parcial: {
    label: "Devolução parcial", variant: "outline",
    ajuda: "Parte dos itens voltou. O termo segue aberto.",
  },
  devolvido: {
    label: "Devolvido", variant: "secondary",
    ajuda: "Encerrado. Itens não devolvidos ficam registrados como pendência.",
  },
  cancelado: {
    label: "Cancelado", variant: "destructive",
    ajuda: "Anulado com motivo. O documento continua no histórico.",
  },
};

export const funcionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário.").max(200),
  cpf: textoOpcional(20),
  cargo: textoOpcional(100),
  matricula: textoOpcional(40),
  telefone: textoOpcional(40),
  obra_id: uuidOpcional,
});
export type FuncionarioInput = z.infer<typeof funcionarioSchema>;

/** O domínio de e-mail da Sistenge. Uma constante, não uma string solta. */
const DOMINIO_EMAIL = "sistenge.com";

/**
 * O endereço provável de um funcionário, a partir do nome.
 *
 * É um PALPITE, e por isso quem grava tem de marcar `email_confirmado = false`.
 * O padrão aparece na própria planilha de inventário, que traz alguns nomes já
 * em formato de login (`Rodrigo.Ferreira`).
 *
 * Devolve `null` quando não dá para formar `nome.sobrenome` — nome de uma
 * palavra só, vazio, ou com algarismo (`Monitor 0109947` é uma linha da
 * planilha, não uma pessoa). Inventar `lourival.lourival` seria produzir um
 * endereço com cara de verdadeiro, que é pior que endereço nenhum.
 */
export function emailDerivado(nome: string): string | null {
  const partes = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // O ponto separa nome de sobrenome tanto em "Rodrigo.Ferreira" quanto no
    // endereço final, então vale como espaço.
    .replace(/[.\s]+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => p.length > 0);

  // Uma parte que não é palavra derruba o nome inteiro, e não só a parte: um
  // "nome" com algarismo dentro não é nome de gente.
  if (partes.length < 2 || partes.some((p) => !/^[a-z]+$/.test(p))) return null;
  return `${partes[0]}.${partes[partes.length - 1]}@${DOMINIO_EMAIL}`;
}

/**
 * O e-mail passa a valer como conferido?
 *
 * Duas maneiras de confirmar, e uma armadilha que a regra fecha.
 *
 * As maneiras: **digitar um endereço diferente** (quem apagou o palpite e
 * escreveu outro, conferiu) ou **marcar a caixa** na tela.
 *
 * A armadilha: sem esta regra, editar o CARGO de alguém reenviaria o e-mail
 * derivado inalterado, e ele viraria "conferido" sem ninguém ter olhado.
 *
 * Comparação por `toLowerCase()` porque o índice único do banco é por
 * `lower(email)`: trocar a caixa não é conferir.
 */
export function confirmacaoDoEmail(
  atual: { email: string | null; confirmado: boolean },
  enviado: { email: string | null; marcouConfirmar: boolean },
): boolean {
  if (!enviado.email) return false;
  if (enviado.email.toLowerCase() !== (atual.email ?? "").toLowerCase()) return true;
  return atual.confirmado || enviado.marcouConfirmar;
}

export const termoSchema = z.object({
  funcionario_id: z.string().uuid("Selecione o funcionário."),
  obra_id: uuidOpcional,
  contrato_id: uuidOpcional,
  data_entrega: z.string().min(1, "Informe a data da entrega."),
  previsao_devolucao: dataOpcional,
  observacoes: textoOpcional(500),
});
export type TermoInput = z.infer<typeof termoSchema>;

/**
 * `controle` não é campo do banco: vem do `item_catalogo` escolhido e existe só
 * para a validação cruzada. Item por peça sem patrimônio é o defeito que torna
 * o termo inútil — "uma betoneira" não identifica qual betoneira.
 */
export const termoItemSchema = z
  .object({
    item_id: z.string().uuid("Selecione o item."),
    controle: z.enum(["quantidade", "peca"]),
    unidade_id: uuidOpcional,
    item_locado_id: uuidOpcional,
    quantidade: z.coerce.number().positive("Quantidade deve ser maior que zero."),
    estado_entrega: z.enum(ESTADOS),
    observacoes: textoOpcional(300),
  })
  .refine((v) => v.controle !== "peca" || v.unidade_id !== null, {
    message: "Item controlado por peça exige o patrimônio.",
    path: ["unidade_id"],
  });
export type TermoItemInput = z.infer<typeof termoItemSchema>;

/**
 * Devolução de um item do termo.
 *
 * `data_entrega` NÃO vai ao banco: entra só para a validação cruzada. Sem ela,
 * devolução retrodatada passava aqui e estourava adiante no check
 * `fim >= inicio` do livro de custódia, como erro cru de Postgres.
 */
export const devolucaoItemSchema = z
  .object({
    item_id: z.string().uuid(),
    data_entrega: dataOpcional,
    data_devolucao: z.string().min(1, "Informe a data da devolução."),
    estado_devolucao: z.enum(ESTADOS),
    observacoes: textoOpcional(300),
  })
  .refine(
    (v) => v.data_entrega === null || v.data_devolucao >= v.data_entrega,
    {
      message: "A devolução não pode ser anterior à entrega.",
      path: ["data_devolucao"],
    },
  );

export const assinaturaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome de quem assina."),
  cpf: textoOpcional(20),
  imagem: opcional,
});

export const cancelamentoSchema = z.object({
  motivo: z.string().trim().min(1, "Informe o motivo do cancelamento.").max(300),
});

/** Rótulo curto para o select de estado. */
export function estadoLabel(e: string): string {
  return ESTADO_INFO[e as Estado]?.label ?? e;
}
