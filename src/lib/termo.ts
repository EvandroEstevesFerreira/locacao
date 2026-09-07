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
  enumOpcional,
  emailOpcional,
  uuidOpcional,
} from "@/lib/campos";
// Estado de conservação é o MESMO conceito da peça de frota, e o mesmo enum
// no banco. Importar em vez de redeclarar é o que impede as duas cópias de
// divergirem — e a divergência apareceria como rótulo errado num documento
// assinado.
import { ESTADOS, ESTADO_INFO, type Estado } from "@/lib/frota";
import { ehDataISO } from "@/lib/locacao";

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

/**
 * As categorias de habilitação, na forma da resolução do Contran.
 *
 * Combinações, e não letras soltas: quem tem AB tem as duas, e guardar “A” e
 * “B” em duas linhas exigiria uma tabela para uma pergunta que é de uma coluna.
 * Lista fechada porque campo livre aqui produz “B”, “b” e “A/B” na mesma
 * coluna — e aí “quem pode dirigir o caminhão” deixa de ter resposta.
 */
export const CATEGORIAS_CNH = [
  "A", "B", "AB", "C", "AC", "D", "AD", "E", "AE",
] as const;

export type CategoriaCNH = (typeof CATEGORIAS_CNH)[number];

export const funcionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário.").max(200),
  cpf: textoOpcional(20),
  cargo: textoOpcional(100),
  matricula: textoOpcional(40),
  telefone: textoOpcional(40),
  // `emailOpcional` ja e idempotente e valida o formato. NAO escreva
  // `z.string().email().optional()` aqui: `parse(parse(x))` quebraria, e
  // `schemas-varredura.test.ts` cobra essa propriedade de todo schema.
  //
  // `email_confirmado` NAO entra no schema: nao vem do formulario como valor,
  // e calculado pela action a partir de `confirmacaoDoEmail`.
  email: emailOpcional(200),
  obra_id: uuidOpcional,

  // CNH — só faz sentido para quem dirige, e por isso os três são opcionais.
  //
  // A trava é CRUZADA e espelha a do banco: número sem validade é o caso
  // perigoso, porque a tela diria “habilitado” sem saber até quando — e
  // entregar carro a quem está com a CNH vencida faz a autuação cair na
  // empresa, que é a proprietária.
  cnh: textoOpcional(20),
  cnh_categoria: enumOpcional(CATEGORIAS_CNH),
  cnh_validade: dataOpcional.refine(
    (v) => v === null || ehDataISO(v),
    "Informe a validade da CNH.",
  ),
})
  .refine(
    (f) => (f.cnh === null) === (f.cnh_validade === null),
    {
      message:
        "Preencha o número da CNH e a validade juntos — um sem o outro não diz se a pessoa pode dirigir.",
      path: ["cnh_validade"],
    },
  );
export type FuncionarioInput = z.infer<typeof funcionarioSchema>;

// A derivação do e-mail vive em `email-corporativo.ts`, sem dependência
// nenhuma, porque o importador do inventário roda em Node puro e precisa da
// MESMA regra. Reexportado aqui para que a tela continue importando do domínio.
export { emailDerivado, DOMINIO_EMAIL } from "@/lib/email-corporativo";

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
