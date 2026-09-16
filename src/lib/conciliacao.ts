import { z } from "zod";

/** Confirmar uma sugestão é dar a baixa que ela propõe. */
export const confirmarSchema = z.object({
  id: z.string().uuid(),
  lancamentoId: z.string().uuid("Esta sugestão não aponta para nenhum lançamento."),
  valorPago: z.coerce.number().positive("Informe o valor pago."),
  dataPagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de pagamento inválida."),
  multa: z.coerce.number().min(0, "Multa inválida.").default(0),
  juros: z.coerce.number().min(0, "Juros inválidos.").default(0),
  // SEM `nfNumero`, de propósito. O conciliador nunca corrige a NF do Loca a
  // partir do número de documento do Mega — em RECIBO ele é "1", "2", "3", e
  // corrigir destrói o dado bom. Não aceitar o campo no schema é o que impede
  // alguém de reintroduzi-lo sem perceber.
});

export const recusarSchema = z.object({ id: z.string().uuid() });

export type ConfirmarInput = z.input<typeof confirmarSchema>;
export type RecusarInput = z.input<typeof recusarSchema>;
