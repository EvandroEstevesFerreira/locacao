import "server-only";

// Geração e conferência do token de assinatura à distância.
//
// Escrita compartilhada entre grupos de rota, então mora em `src/lib/` e não em
// `src/lib/data/` (que é só leitura): quem chama é a área autenticada, que gera
// o link, e a rota pública `/assinar/[token]`, que o consome.

import { createHash, randomBytes } from "node:crypto";

/**
 * O token que vai no link.
 *
 * 256 bits de `randomBytes`, em base64url. `Math.random()` não serve nem de
 * longe: ele é previsível, e um token previsível assina o documento de outra
 * pessoa.
 */
export function novoToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * O que É gravado no banco.
 *
 * O token em claro existe no e-mail do funcionário e em lugar nenhum mais. Se o
 * banco vazar, os links não vazam junto — é a mesma razão pela qual senha não se
 * guarda em texto, e um link destes assina um documento.
 */
export function hashDoToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
