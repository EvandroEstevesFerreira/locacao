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

// ── Anexos da vistoria: protocolo e OS da contraparte ────────────────────────

/**
 * Rótulos dos tipos de anexo. As CHAVES são os valores que a coluna
 * `vistoria_anexo.tipo` aceita no `check` da migration 0098 — mexer aqui sem
 * mexer lá (ou o contrário) faz o banco recusar a linha depois de o arquivo já
 * ter subido para o Storage.
 */
export const TIPO_ANEXO_VISTORIA = {
  protocolo: "Protocolo de retirada",
  os: "Ordem de serviço",
  outro: "Outro documento",
} as const;

export type TipoAnexoVistoria = keyof typeof TIPO_ANEXO_VISTORIA;

/**
 * Normaliza o tipo vindo do formulário para um valor que a coluna aceita.
 *
 * Cai em `outro` em vez de lançar: o arquivo JÁ subiu para o Storage quando
 * isto roda, e recusar o registro por causa do rótulo deixaria o documento
 * órfão. Guardar como "outro documento" perde a etiqueta e preserva o papel.
 */
export function tipoAnexoValido(tipo: string | undefined | null): TipoAnexoVistoria {
  const t = (tipo ?? "").trim().toLowerCase();
  return t in TIPO_ANEXO_VISTORIA ? (t as TipoAnexoVistoria) : "outro";
}
