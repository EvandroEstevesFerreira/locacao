export type TipoVistoria = "entrada" | "devolucao";
export type StatusAvaria = "aberta" | "cobrada" | "resolvida";

export const TIPO_VISTORIA: Record<
  TipoVistoria,
  { label: string; variant: "default" | "secondary" }
> = {
  entrada: { label: "Entrada (retirada)", variant: "default" },
  devolucao: { label: "Devolução", variant: "secondary" },
};

// Reexportado de `avaria.ts`, que é a fonte única. A cópia que morava aqui já
// divergia da de lá em `aberta` — a mesma avaria saía com cor diferente na
// vistoria e na lista de avarias. Os consumidores antigos continuam importando
// `STATUS_AVARIA` daqui, sem mudança.
export { STATUS_AVARIA_INFO as STATUS_AVARIA } from "./avaria";
