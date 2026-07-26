// Tipos e rótulos do módulo Imóveis (client-safe — sem imports de servidor).

export type TipoImovel =
  | "kitnet"
  | "apartamento"
  | "casa"
  | "galpao"
  | "escritorio"
  | "outro";

export type StatusImovel = "ativo" | "desocupacao" | "encerrado";

export type StatusCaucao = "em_aberto" | "devolvida" | "retida";

export const TIPO_IMOVEL_INFO: Record<TipoImovel, string> = {
  kitnet: "Kitnet",
  apartamento: "Apartamento",
  casa: "Casa",
  galpao: "Galpão",
  escritorio: "Escritório",
  outro: "Outro",
};

export const TIPOS_IMOVEL = Object.keys(TIPO_IMOVEL_INFO) as TipoImovel[];

export const STATUS_IMOVEL_INFO: Record<
  StatusImovel,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  ativo: { label: "Ativo", variant: "default" },
  desocupacao: { label: "Em desocupação", variant: "secondary" },
  encerrado: { label: "Encerrado", variant: "destructive" },
};

export const STATUS_CAUCAO_INFO: Record<StatusCaucao, string> = {
  em_aberto: "Em aberto",
  devolvida: "Devolvida",
  retida: "Retida",
};

export function tipoImovelLabel(t: string): string {
  return TIPO_IMOVEL_INFO[t as TipoImovel] ?? t;
}

// --- Contas de consumo (Fase 2) ---
export type TipoConsumo = "agua" | "luz" | "gas" | "internet" | "iptu" | "outro";

export const TIPO_CONSUMO_INFO: Record<TipoConsumo, string> = {
  agua: "Água",
  luz: "Luz",
  gas: "Gás",
  internet: "Internet",
  iptu: "IPTU",
  outro: "Outro",
};

export const TIPOS_CONSUMO = Object.keys(TIPO_CONSUMO_INFO) as TipoConsumo[];

export function tipoConsumoLabel(t: string): string {
  return TIPO_CONSUMO_INFO[t as TipoConsumo] ?? t;
}
