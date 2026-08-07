// Domínio Obra: rótulos, schema e helpers puros.
//
// Sem dependências de servidor — o schema é importado tanto pela action
// (validação de verdade) quanto pelo formulário (validação por campo via
// zodResolver). Ficava dentro de `obras/actions.ts`, e um arquivo "use server"
// não pode ser importado por componente cliente.

import { z } from "zod";

export const STATUS_OBRA = ["ativa", "pausada", "encerrada"] as const;
export type StatusObra = (typeof STATUS_OBRA)[number];

export const STATUS_OBRA_INFO: Record<
  StatusObra,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  encerrada: { label: "Encerrada", variant: "outline" },
};

/**
 * Campos de texto opcionais chegam como "" do formulário e precisam virar NULL
 * no banco — senão um "sem responsável" fica gravado como string vazia e
 * qualquer `is null` deixa de encontrá-lo.
 */
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));

export const obraSchema = z.object({
  // `id` presente = edição. Vem do schema em vez de um <input hidden>.
  id: z.string().uuid().optional(),
  codigo: z.string().trim().min(1, "Informe o código da obra.").max(50),
  nome: z.string().trim().min(1, "Informe o nome da obra.").max(200),
  endereco: textoOpcional(300),
  responsavel: textoOpcional(200),
  centro_custo: textoOpcional(100),
  status: z.enum(STATUS_OBRA),
});

export type ObraInput = z.input<typeof obraSchema>;
export type ObraDados = z.output<typeof obraSchema>;
