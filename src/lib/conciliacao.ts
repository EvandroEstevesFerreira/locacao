import { z } from "zod";

/** Confirmar uma sugestão é dar a baixa que ela propõe. */
export const confirmarSchema = z.object({
  id: z.string().uuid(),
  lancamentoId: z.string().uuid("Esta sugestão não aponta para nenhum lançamento."),
  valorPago: z.coerce.number().positive("Informe o valor pago."),
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de pagamento inválida."),
  multa: z.coerce.number().min(0, "Multa inválida.").default(0),
  juros: z.coerce.number().min(0, "Juros inválidos.").default(0),
  nfNumero: z.string().trim().max(60).nullable().optional(),
});

export const recusarSchema = z.object({ id: z.string().uuid() });

export type ConfirmarInput = z.input<typeof confirmarSchema>;
export type RecusarInput = z.input<typeof recusarSchema>;
