// Domínio Serviços e licenças de TI: rótulos, schema e helpers puros.
//
// Sem dependências de servidor — o schema é importado tanto pela action
// (validação de verdade) quanto pelo formulário (validação por campo via
// zodResolver). Um arquivo "use server" não pode ser importado por componente
// cliente, e é por isso que o schema não mora no `actions.ts`.

import { z } from "zod";
import { idOpcional, dataOpcional, textoOpcional } from "@/lib/campos";

export const CATEGORIA_SERVICO = [
  "licenca",
  "conectividade",
  "seguranca",
  "outro",
] as const;
export type CategoriaServico = (typeof CATEGORIA_SERVICO)[number];

export const CATEGORIA_SERVICO_INFO: Record<
  CategoriaServico,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  licenca: { label: "Licença", variant: "default" },
  conectividade: { label: "Conectividade", variant: "secondary" },
  seguranca: { label: "Segurança", variant: "secondary" },
  outro: { label: "Outro", variant: "outline" },
};

/**
 * Quantos dias uma conferência vale antes de virar suspeita.
 *
 * A atribuição de licença é digitada à mão e diverge do provedor com o tempo.
 * Noventa dias não é ciência — é o prazo a partir do qual o número deixa de
 * merecer a confiança de quem vai cancelar assinatura em cima dele.
 */
export const DIAS_CONFERENCIA_VALIDA = 90;

/**
 * A contagem de licenças em uso ainda é confiável?
 *
 * `null` (nunca conferido) conta como **vencido**, e não como neutro: um
 * contrato que ninguém nunca conferiu é o caso em que o número tem menos
 * chance de estar certo, não mais.
 *
 * Compara `'yyyy-mm-dd'` como string de propósito — o formato é ordenável
 * lexicograficamente, então não há conversão de data nem fuso no meio. É a
 * mesma escolha do `superRefine` de período em `src/lib/obra.ts`.
 */
export function conferenciaVencida(
  conferidoEm: string | null,
  hojeISO: string,
): boolean {
  if (!conferidoEm) return true;

  const [a1, m1, d1] = conferidoEm.split("-").map(Number);
  const [a2, m2, d2] = hojeISO.split("-").map(Number);
  const dias =
    (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000;

  return dias > DIAS_CONFERENCIA_VALIDA;
}

/**
 * O custo do contrato no período, em centavos.
 *
 * `quantidade * unitário` — a conta é trivial, e existir como função é o que
 * impede a tela e o rateio de a escreverem cada um do seu jeito.
 */
export function totalDoPeriodoCentavos(
  quantidade: number,
  valorUnitarioCentavos: number,
): number {
  return quantidade * valorUnitarioCentavos;
}

export const servicoSchema = z
  .object({
    // `id` presente = edição; em branco = criação (o <input hidden> manda `""`).
    id: idOpcional,
    nome: z.string().trim().min(1, "Informe o nome do serviço.").max(200),
    categoria: z.enum(CATEGORIA_SERVICO).default("licenca"),
    fornecedor_id: z.string().uuid("Escolha o fornecedor."),
    quantidade: z.coerce
      .number()
      .int("A quantidade tem de ser um número inteiro.")
      .min(1, "Não existe contrato de zero licenças."),
    // Em CENTAVOS. `numeric` vira `number` no JavaScript, e R$ 3.500 ÷ 43 é
    // exatamente a divisão que perde centavo — ver `ratearPorCabeca`.
    valor_unitario_centavos: z.coerce
      .number()
      .int("O valor tem de vir em centavos, sem casa decimal.")
      .min(0, "O valor não pode ser negativo."),
    cadencia: z.enum(["diaria", "semanal", "quinzenal", "mensal"]).default("mensal"),
    data_inicio: z.string().min(1, "Informe o início da vigência."),
    // Nulo = vigência indeterminada. Contrato assim não gera alerta de
    // renovação (não há data); gera o de conferência vencida.
    data_fim: dataOpcional,
    renova_automaticamente: z.coerce.boolean().default(true),
    conferido_em: dataOpcional,
    status: z.enum(["ativo", "encerrado", "cancelado"]).default("ativo"),
    observacoes: textoOpcional(1000),
  })
  .superRefine((d, ctx) => {
    // A mesma regra vive no CHECK `contrato_servico_periodo` da migration 0115.
    // Aqui ela existe para dar MENSAGEM no campo certo: o banco recusaria com
    // erro cru, sem nome de campo, e o formulário não teria onde pendurá-lo.
    if (d.data_fim && d.data_fim < d.data_inicio) {
      ctx.addIssue({
        code: "custom",
        path: ["data_fim"],
        message: "O fim da vigência não pode ser anterior ao início.",
      });
    }
  });

export type ServicoInput = z.input<typeof servicoSchema>;
export type ServicoDados = z.output<typeof servicoSchema>;

export const atribuicaoSchema = z.object({
  contrato_id: z.string().uuid(),
  funcionario_id: z.string().uuid("Escolha a pessoa."),
  atribuido_em: z.string().min(1, "Informe a data da atribuição."),
});

export type AtribuicaoDados = z.output<typeof atribuicaoSchema>;