// Módulos do sistema e regras de acesso por usuário — SEM dependências de
// servidor nem de ícones, para poder ser importado no middleware (proxy),
// em Server Components e em Client Components.

export type ModuloKey =
  | "obras"
  | "fornecedores"
  | "itens"
  | "contratos"
  | "imoveis"
  | "vistorias"
  | "financeiro"
  | "relatorios";

/** Módulos que o Master pode liberar/bloquear por usuário. */
export const MODULOS: { chave: ModuloKey; label: string; href: string }[] = [
  { chave: "obras", label: "Obras", href: "/obras" },
  { chave: "fornecedores", label: "Fornecedores", href: "/fornecedores" },
  { chave: "itens", label: "Itens", href: "/itens" },
  { chave: "contratos", label: "Contratos", href: "/contratos" },
  { chave: "imoveis", label: "Imóveis", href: "/imoveis" },
  { chave: "vistorias", label: "Vistorias", href: "/vistorias" },
  { chave: "financeiro", label: "Financeiro", href: "/financeiro" },
  { chave: "relatorios", label: "Relatórios", href: "/relatorios" },
];

export const MODULO_CHAVES: ModuloKey[] = MODULOS.map((m) => m.chave);

/** Filtra uma lista qualquer, mantendo só as chaves de módulo válidas. */
export function normalizarModulos(valores: string[]): ModuloKey[] {
  return valores.filter((v): v is ModuloKey =>
    (MODULO_CHAVES as string[]).includes(v),
  );
}

/**
 * Chave do módulo correspondente a um pathname, ou null quando a rota não é
 * "modulável" (ex.: "/", "/perfil", "/usuarios", "/configuracoes").
 */
export function moduloDaRota(pathname: string): ModuloKey | null {
  const hit = MODULOS.find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );
  return hit?.chave ?? null;
}

/**
 * O usuário pode acessar o módulo?
 * - Master: sempre (nunca é restringido).
 * - modulos == null: acesso total (retrocompatível — padrão de quem nunca
 *   teve módulos definidos).
 * - Caso contrário: só os módulos presentes na lista.
 */
export function moduloLiberado(
  modulos: string[] | null | undefined,
  isMaster: boolean,
  modulo: ModuloKey,
): boolean {
  if (isMaster) return true;
  if (modulos == null) return true;
  return modulos.includes(modulo);
}
