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
