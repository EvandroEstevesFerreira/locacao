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

export const devolucaoItemSchema = z.object({
  item_id: z.string().uuid(),
  data_devolucao: z.string().min(1, "Informe a data da devolução."),
  estado_devolucao: z.enum(ESTADOS),
  observacoes: textoOpcional(300),
});

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
