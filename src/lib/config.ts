// Domínio de configuração: empresa e relatório automático por e-mail.
// Client-safe — os schemas são compartilhados entre a action e o formulário.

import { z } from "zod";
import { cnpjValido, normalizarCnpj } from "@/lib/cnpj";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

/** Campos de `organizacao` que o formulário de empresa edita. */
export const empresaSchema = z.object({
  nome: z.string().trim().min(1, "Informe ao menos o nome da empresa.").max(200),
  razao_social: texto(200),
  nome_fantasia: texto(200),
  cnpj: z
    .string()
    .trim()
    .max(25)
    .optional()
    .refine((v) => !v || normalizarCnpj(v) === "" || cnpjValido(v), {
      message: "CNPJ inválido. Verifique o número (formato alfanumérico).",
    })
    .transform((v) => (v && v.length > 0 ? v : null)),
  inscricao_estadual: texto(40),
  inscricao_municipal: texto(40),
  endereco: texto(300),
  cidade: texto(120),
  uf: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^[A-Za-z]{2}$/.test(v), { message: "UF deve ter 2 letras." })
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  cep: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{5}-?\d{3}$/.test(v), {
      message: "CEP inválido (use 00000-000).",
    })
    .transform((v) => (v && v.length > 0 ? v : null)),
  telefone: texto(40),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), {
      message: "E-mail inválido.",
    })
    .transform((v) => (v && v.length > 0 ? v : null)),
  site: texto(200),
  representante_nome: texto(200),
  representante_cargo: texto(120),
  representante_cpf: texto(20),
  responsaveis: texto(500),
  observacoes: texto(1000),
});

export type EmpresaInput = z.input<typeof empresaSchema>;
export type EmpresaDados = z.output<typeof empresaSchema>;

export const FREQUENCIAS_RELATORIO = ["semanal", "mensal"] as const;
export type FrequenciaRelatorio = (typeof FREQUENCIAS_RELATORIO)[number];

/** Limite superior do campo "dia" conforme a frequência escolhida. */
export function diaMaximo(frequencia: FrequenciaRelatorio): number {
  return frequencia === "semanal" ? 7 : 28;
}

export const configRelatorioSchema = z
  .object({
    ativo: z.boolean(),
    tipo: z.string().min(1, "Escolha o relatório."),
    frequencia: z.enum(FREQUENCIAS_RELATORIO),
    dia: z.coerce.number().int().min(1, "Informe o dia."),
    /** Uma lista por linha, vírgula ou ponto e vírgula — como o usuário digita. */
    destinatarios: z
      .string()
      .transform((v) =>
        v
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.string().email("Há um e-mail inválido na lista de destinatários.")),
      ),
  })
  // O domínio de `dia` depende da frequência. Antes o schema aceitava 1 a 28
  // para os dois casos, mesmo com a mensagem de erro prometendo "1 a 7
  // (semanal)" — então um relatório semanal marcado para o dia 20 passava e
  // nunca disparava.
  .superRefine((d, ctx) => {
    const max = diaMaximo(d.frequencia);
    if (d.dia > max) {
      ctx.addIssue({
        code: "custom",
        path: ["dia"],
        message:
          d.frequencia === "semanal"
            ? "Use 1 a 7 (1 = segunda-feira)."
            : "Use 1 a 28 (para existir em todos os meses).",
      });
    }
  })
  .refine((d) => !d.ativo || d.destinatarios.length > 0, {
    message: "Informe ao menos um destinatário para ativar o envio.",
    path: ["destinatarios"],
  });

export type ConfigRelatorioInput = z.input<typeof configRelatorioSchema>;
export type ConfigRelatorioDados = z.output<typeof configRelatorioSchema>;
