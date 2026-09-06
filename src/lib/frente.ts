// Domínio Frente de serviço — schemas e rótulos, client-safe.
//
// A frente é DA OBRA: "Fundação" na obra A e "Fundação" na obra B são frentes
// diferentes, com equipe, prazo e custo próprios.

import { z } from "zod";
import { uuidOpcional } from "@/lib/campos";

export const frenteSchema = z.object({
  id: uuidOpcional,
  obra_id: z.string().uuid("Selecione a obra."),
  nome: z
    .string()
    .trim()
    .min(2, "Informe o nome da frente.")
    .max(60, "Use no máximo 60 caracteres."),
  ativo: z.boolean(),
});

export type FrenteInput = z.input<typeof frenteSchema>;
export type FrenteDados = z.output<typeof frenteSchema>;
