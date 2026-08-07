import "server-only";

/**
 * O que `parseListParams` (em `@/lib/lista`) devolve e todo leitor de listagem
 * consome. Fica num módulo próprio para os leitores não dependerem uns dos
 * outros só por causa deste tipo.
 *
 * Nota sobre `cache()`: os leitores de LISTA deliberadamente não são
 * memoizados. `cache()` chaveia por identidade de argumento, e estes recebem um
 * objeto literal montado a cada chamada — o cache nunca acertaria. Onde a
 * memoização paga (`getCurrentPerfil`, `listarObrasParaFiltro`,
 * `obterItensLocadosCalculados`) os argumentos são primitivos ou inexistentes.
 */
export type ListaParams = {
  /** Termo de busca já saneado. Vazio significa "sem busca". */
  q: string;
  /** Coluna de ordenação, validada por `parseListParams` contra uma allowlist. */
  sort: string;
  ascending: boolean;
  from: number;
  to: number;
};

/** Retorno padrão de listagem: a página pedida mais o total do filtro. */
export type Pagina<T> = { itens: T[]; total: number };
