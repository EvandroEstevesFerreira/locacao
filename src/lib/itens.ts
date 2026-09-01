import { z } from "zod";
import { idOpcional, textoOpcional } from "@/lib/campos";

export type TipoItem = "equipamento" | "material_retornavel" | "consumivel";

export const TIPO_ITEM: Record<
  TipoItem,
  { label: string; descricao: string; variant: "default" | "secondary" | "outline" }
> = {
  equipamento: {
    label: "Equipamento",
    descricao: "Retornável, controlado por unidade (nº de série/patrimônio).",
    variant: "default",
  },
  material_retornavel: {
    label: "Material retornável",
    descricao: "Retornável, controlado por quantidade/saldo.",
    variant: "secondary",
  },
  consumivel: {
    label: "Consumível",
    descricao: "Não retorna.",
    variant: "outline",
  },
};

/** Sugestões de unidade de medida (o campo é livre). */
export const UNIDADES = ["un", "m", "m²", "m³", "kg", "L", "par", "cj"];

// ── Schema ───────────────────────────────────────────────────────────────────
// Fica aqui, e não em `itens/actions.ts`, para poder ser importado pelo
// formulário — um arquivo "use server" não atravessa para o cliente.


export const TIPOS_ITEM = [
  "equipamento",
  "material_retornavel",
  "consumivel",
] as const;

export const itemSchema = z.object({
  id: idOpcional,
  tipo: z.enum(TIPOS_ITEM),
  descricao: z.string().trim().min(1, "Informe a descrição do item.").max(200),
  unidade: textoOpcional(10),
  ativo: z.boolean(),
});

export type ItemInput = z.input<typeof itemSchema>;
export type ItemDados = z.output<typeof itemSchema>;
