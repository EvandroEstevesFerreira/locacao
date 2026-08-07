import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Validade das URLs assinadas de anexo, em segundos.
 *
 * 10 minutos: sobra para clicar e baixar, e é curto o bastante para uma URL
 * copiada por engano morrer sozinha. Antes o TTL era inconsistente — 600 em
 * contratos/[id] e 3600 em imoveis/[id] e imoveis/documentos, sem motivo.
 */
export const TTL_URL_ASSINADA = 600;

/**
 * Assina vários caminhos de um bucket em UMA requisição e devolve um mapa
 * caminho → URL.
 *
 * O motivo de existir: as telas de detalhe faziam
 * `Promise.all(paths.map(p => createSignedUrl(p, ...)))`, ou seja, uma
 * requisição por arquivo. Um imóvel com 3 contratos, 8 reparos e 12 fotos de
 * vistoria disparava ~25 chamadas ao Storage ANTES do primeiro byte de HTML.
 * `createSignedUrls` (plural) resolve o lote de uma vez — forma que
 * vistorias/[id] já usava e que era o modelo a seguir.
 *
 * Caminhos vazios são descartados e repetidos são deduplicados, então quem
 * chama pode passar o resultado de um `.map()` cru com nulos no meio.
 */
export async function assinarUrls(
  bucket: string,
  paths: (string | null | undefined)[],
  ttl: number = TTL_URL_ASSINADA,
): Promise<Map<string, string>> {
  const unicos = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  if (unicos.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrls(unicos, ttl);

  if (error) {
    // Anexo é acessório: a tela continua útil sem o link. Mas loga, porque
    // silêncio aqui já custou tempo de diagnóstico antes.
    console.error("[assinarUrls]", bucket, error);
    return new Map();
  }

  // Laço em vez de filter+map porque `path` é `string | null` no retorno do
  // supabase-js e o filter não estreita o tipo.
  const mapa = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}
