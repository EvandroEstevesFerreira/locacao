export type TipoVistoria = "entrada" | "devolucao";
export type StatusAvaria = "aberta" | "cobrada" | "resolvida";

export const TIPO_VISTORIA: Record<
  TipoVistoria,
  { label: string; variant: "default" | "secondary" }
> = {
  entrada: { label: "Entrada (retirada)", variant: "default" },
  devolucao: { label: "Devolução", variant: "secondary" },
};

export const STATUS_AVARIA: Record<
  StatusAvaria,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  aberta: { label: "Aberta", variant: "default" },
  cobrada: { label: "Cobrada", variant: "secondary" },
  resolvida: { label: "Resolvida", variant: "outline" },
};
