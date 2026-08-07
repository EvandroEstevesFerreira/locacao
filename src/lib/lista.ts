// Helpers para listas paginadas/ordenáveis/pesquisáveis (server-side).

export const PAGE_SIZE = 20;

export type ListParams = {
  page: number;
  q: string;
  sort: string;
  dir: "asc" | "desc";
  ascending: boolean;
  from: number;
  to: number;
};

/**
 * Normaliza os parâmetros de lista a partir da querystring, validando a coluna
 * de ordenação contra uma allowlist (evita injeção no `.order()`).
 */
export function parseListParams(
  sp: Record<string, string | undefined>,
  opts: { sortCols: string[]; defaultSort: string; defaultDir?: "asc" | "desc" },
): ListParams {
  const page = Math.max(1, Number(sp.page) || 1);
  const q = (sp.q ?? "").trim();
  const sort = opts.sortCols.includes(sp.sort ?? "") ? (sp.sort as string) : opts.defaultSort;
  const dir: "asc" | "desc" =
    sp.dir === "asc" || sp.dir === "desc" ? sp.dir : opts.defaultDir ?? "asc";
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  return { page, q, sort, dir, ascending: dir === "asc", from, to };
}

/** Sanitiza um termo de busca para uso seguro em `.or(ilike...)` do PostgREST. */
export function termoOr(campos: string[], q: string): string {
  const safe = q.replace(/[,()*%\\]/g, " ").trim();
  return campos.map((c) => `${c}.ilike.%${safe}%`).join(",");
}

/**
 * "12 contratos" / "1 contrato" — a frase de contagem dos cabeçalhos de lista.
 *
 * Recebe as duas formas em vez de acrescentar "s": em PT-BR o plural não é
 * regular (fornecedor → fornecedores, usuário → usuários). O Sistenge People
 * escreve o ternário inline em cada página; aqui fica num lugar, testável.
 */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
