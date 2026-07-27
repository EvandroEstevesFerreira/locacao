// Logger estruturado (JSON por linha) — facilita busca/observabilidade nos
// logs da Vercel e prepara terreno para APM (ex.: Sentry) via SENTRY_DSN.
// Sem dependências: se um dia houver SDK, basta encaminhar aqui.

type Nivel = "info" | "warn" | "error";

function emitir(nivel: Nivel, evento: string, meta?: Record<string, unknown>) {
  const entrada = {
    nivel,
    evento,
    ...(meta ?? {}),
    ts: new Date().toISOString(),
  };
  let linha: string;
  try {
    linha = JSON.stringify(entrada);
  } catch {
    linha = JSON.stringify({ nivel, evento, ts: entrada.ts });
  }
  if (nivel === "error") console.error(linha);
  else if (nivel === "warn") console.warn(linha);
  else console.log(linha);
}

/** Normaliza um erro desconhecido para meta serializável. */
export function erroMeta(e: unknown): Record<string, unknown> {
  if (e instanceof Error) return { erro: e.message, stack: e.stack };
  return { erro: String(e) };
}

export const logger = {
  info: (evento: string, meta?: Record<string, unknown>) => emitir("info", evento, meta),
  warn: (evento: string, meta?: Record<string, unknown>) => emitir("warn", evento, meta),
  error: (evento: string, meta?: Record<string, unknown>) => emitir("error", evento, meta),
};
