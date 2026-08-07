// Domínio Fornecedor: schema e helpers puros, client-safe.
//
// O schema sai de `fornecedores/actions.ts` para poder ser importado pelo
// formulário: um arquivo "use server" não atravessa para o cliente.
//
// Ganho concreto da migração: `cnpjValido` de src/lib/cnpj.ts implementa o CNPJ
// ALFANUMÉRICO de 2026 (DV mód-11 por ASCII−48) e passa a validar no cliente,
// enquanto o usuário digita — antes o erro só chegava depois do submit.

import { z } from "zod";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const fornecedorSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(1, "Informe o nome do fornecedor.").max(200),
  cnpj: z
    .string()
    .trim()
    .max(25)
    .optional()
    .refine((v) => !v || normalizarCnpj(v) === "" || cnpjValido(v), {
      message: "CNPJ inválido. Verifique o número (formato alfanumérico).",
    })
    .transform((v) => (v && normalizarCnpj(v) !== "" ? v : null)),
  contato_nome: textoOpcional(200),
  contato_telefone: textoOpcional(40),
  contato_email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "E-mail de contato inválido.",
    })
    .transform((v) => (v && v.length > 0 ? v : null)),
  observacoes: textoOpcional(1000),
  ativo: z.boolean(),
  /** IDs das obras vinculadas (relação N:N com fornecedor_obra). */
  obras: z.array(z.string().uuid()),
  /**
   * "Salvar mesmo assim" — o CNPJ duplicado avisa na primeira tentativa e só
   * bloqueia até o usuário confirmar. Não é validação, é decisão dele.
   */
  confirmar_duplicado: z.boolean(),
});

export type FornecedorInput = z.input<typeof fornecedorSchema>;
export type FornecedorDados = z.output<typeof fornecedorSchema>;
