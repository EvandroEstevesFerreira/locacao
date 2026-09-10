// Módulos do sistema e regras de acesso por usuário — SEM dependências de
// servidor nem de ícones, para poder ser importado no middleware (proxy),
// em Server Components e em Client Components.

export type ModuloKey =
  | "obras"
  | "avanco"
  | "fornecedores"
  | "itens"
  | "frota"
  | "estoque"
  | "contratos"
  | "recebimentos"
  | "devolucoes"
  | "imoveis"
  | "vistorias"
  | "termos"
  | "financeiro"
  | "relatorios";

/**
 * Grupo do módulo, espelhando o agrupamento do menu.
 *
 * Existe para o cadastro de usuário poder liberar um assunto inteiro de uma
 * vez. O controle de acesso continua sendo por MÓDULO, um a um — o grupo é só
 * o atalho de quem marca. Acoplar os módulos entre si em código, de modo que
 * desmarcar um apagasse outro, produziria permissão que ninguém consegue
 * auditar depois.
 */
export type GrupoModulo = "Obra" | "Equipamento" | "Imóveis" | "Financeiro";

/** Módulos que o Master pode liberar/bloquear por usuário. */
export const MODULOS: {
  chave: ModuloKey;
  label: string;
  href: string;
  grupo: GrupoModulo;
}[] = [
  { grupo: "Obra", chave: "obras", label: "Obras", href: "/obras" },
  { grupo: "Obra", chave: "avanco", label: "Avanço", href: "/avanco" },
  { grupo: "Equipamento", chave: "fornecedores", label: "Fornecedores", href: "/fornecedores" },
  { grupo: "Equipamento", chave: "itens", label: "Itens", href: "/itens" },
  { grupo: "Equipamento", chave: "frota", label: "Frota", href: "/frota" },
  { grupo: "Equipamento", chave: "estoque", label: "Estoque", href: "/estoque" },
  { grupo: "Equipamento", chave: "contratos", label: "Contratos", href: "/contratos" },
  { grupo: "Equipamento", chave: "recebimentos", label: "Recebimentos", href: "/recebimentos" },
  { grupo: "Equipamento", chave: "devolucoes", label: "Devoluções", href: "/devolucoes" },
  { grupo: "Imóveis", chave: "imoveis", label: "Imóveis", href: "/imoveis" },
  { grupo: "Equipamento", chave: "vistorias", label: "Vistorias", href: "/vistorias" },
  { grupo: "Equipamento", chave: "termos", label: "Termos de responsabilidade", href: "/termos" },
  { grupo: "Financeiro", chave: "financeiro", label: "Financeiro", href: "/financeiro" },
  { grupo: "Financeiro", chave: "relatorios", label: "Relatórios", href: "/relatorios" },
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

/**
 * Módulos que NEGAM quando não dá para ter certeza.
 *
 * O resto do sistema é fail-open de propósito: um soluço na leitura do perfil
 * não deve trancar quem está trabalhando. Para um módulo que existe para ser
 * restrito, esse padrão está invertido — "não consegui conferir" não pode
 * significar "entra".
 *
 * A lista é curta e deve continuar curta. Cada nome aqui é um lugar onde uma
 * instabilidade de banco vira uma pessoa impedida de trabalhar, e isso só se
 * paga quando o dado do outro lado não deve ser visto por quem passa.
 */
export const MODULOS_FECHADOS: ModuloKey[] = ["frota"];

export function moduloFechado(modulo: ModuloKey): boolean {
  return MODULOS_FECHADOS.includes(modulo);
}

/**
 * A guarda de módulo das server actions.
 *
 * POR QUE AS ACTIONS PRECISAM DELA. O middleware só barra `GET` — ele protege
 * a navegação, não a escrita. As actions até hoje conferiam PAPEL, e papel não
 * sabe nada de módulo: um operador com a Frota desmarcada, numa aba que ficou
 * aberta antes da mudança, continuava movimentando peça.
 *
 * Devolve a mensagem de recusa, ou `null` quando pode passar — assim quem chama
 * decide o formato (`falha(...)`, `notFound()`, `redirect()`) sem esta função
 * precisar conhecer nenhum deles.
 */
export function exigirModulo(
  perfil: { papel: string; modulos: string[] | null } | null | undefined,
  modulo: ModuloKey,
): string | null {
  if (!perfil) return "Sessão inválida. Entre novamente.";
  if (moduloLiberado(perfil.modulos, perfil.papel === "master", modulo)) {
    return null;
  }
  const rotulo = MODULOS.find((m) => m.chave === modulo)?.label ?? modulo;
  return `Você não tem acesso ao módulo ${rotulo}.`;
}

/** Os grupos na ordem em que o menu os mostra. */
export const GRUPOS_MODULO: GrupoModulo[] = [
  "Obra",
  "Equipamento",
  "Imóveis",
  "Financeiro",
];

export function modulosDoGrupo(grupo: GrupoModulo): ModuloKey[] {
  return MODULOS.filter((m) => m.grupo === grupo).map((m) => m.chave);
}
