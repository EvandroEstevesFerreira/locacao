// Navegação principal do app. Dados puros e serializáveis: sem componentes de
// ícone, sem imports de servidor — pode ser importado por Server Components,
// Client Components e pelo proxy/edge, igual a src/lib/modulos.ts.
//
// IMPORTANTE: não referenciar componentes Lucide aqui. O layout (server) filtra
// esta lista pelas permissões e passa os itens como props para componentes
// client; funções não são serializáveis nesse boundary. O lookup nome→componente
// vive em src/components/layout/nav-icon.tsx ("use client").
//
// Antes da v0.21 o `icon` era um LucideIcon e a filtragem acontecia no client
// (a sidebar importava NAV_ITEMS ela mesma). Funcionava, mas obrigava o bundle
// do cliente a carregar a entrada de /configuracoes para todo mundo e impedia
// que este arquivo fosse usado fora do browser.

import type { ModuloKey } from "@/lib/modulos";

export type NavIconName =
  | "layout-dashboard"
  | "hard-hat"
  | "trending-up"
  | "truck"
  | "package"
  | "boxes"
  | "file-text"
  | "building-2"
  | "clipboard-check"
  | "clipboard-list"
  | "file-signature"
  | "wallet"
  | "bar-chart-3"
  | "sparkles"
  | "settings";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
  /** Visível apenas para o perfil master (ex.: Configurações). */
  apenasMaster?: boolean;
  /** Módulo controlável por usuário (Início/Novidades/Configurações não têm). */
  modulo?: ModuloKey;
  /** Separador visual antes do item — marca o começo da "cauda de sistema". */
  separadorAntes?: boolean;
  /**
   * Grupo do menu. Existe porque o Loca passou de 8 para 15 itens em uma
   * semana, e lista plana desse tamanho é o que faz o usuário desistir de
   * procurar. O grupo é só rótulo visual: quem controla acesso é `modulo`.
   */
  grupo?: GrupoNav;
};

export const GRUPOS_NAV = [
  "Obra",
  "Equipamento",
  "Imóveis",
  "Financeiro",
] as const;
export type GrupoNav = (typeof GRUPOS_NAV)[number];

export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Início", href: "/", icon: "layout-dashboard" },

  { label: "Obras", href: "/obras", icon: "hard-hat", modulo: "obras", grupo: "Obra" },
  { label: "Avanço", href: "/avanco", icon: "trending-up", modulo: "avanco", grupo: "Obra" },

  { label: "Itens", href: "/itens", icon: "package", modulo: "itens", grupo: "Equipamento" },
  { label: "Frota", href: "/frota", icon: "boxes", modulo: "frota", grupo: "Equipamento" },
  { label: "Contratos", href: "/contratos", icon: "file-text", modulo: "contratos", grupo: "Equipamento" },
  { label: "Recebimentos", href: "/recebimentos", icon: "clipboard-list", modulo: "recebimentos", grupo: "Equipamento" },
  { label: "Vistorias", href: "/vistorias", icon: "clipboard-check", modulo: "vistorias", grupo: "Equipamento" },
  { label: "Fornecedores", href: "/fornecedores", icon: "truck", modulo: "fornecedores", grupo: "Equipamento" },

  { label: "Imóveis", href: "/imoveis", icon: "building-2", modulo: "imoveis", grupo: "Imóveis" },

  { label: "Financeiro", href: "/financeiro", icon: "wallet", modulo: "financeiro", grupo: "Financeiro" },
  { label: "Relatórios", href: "/relatorios", icon: "bar-chart-3", modulo: "relatorios", grupo: "Financeiro" },

  { label: "Novidades", href: "/novidades", icon: "sparkles", separadorAntes: true },
  { label: "Configurações", href: "/configuracoes", icon: "settings", apenasMaster: true },
] as const;

/**
 * Itens visíveis para um usuário. Roda no server, uma vez por request — antes a
 * mesma filtragem acontecia duas vezes, uma por árvore de navegação.
 */
export function navVisivel(
  isMaster: boolean,
  moduloLiberado: (modulo: ModuloKey) => boolean,
): NavItem[] {
  return NAV_ITEMS.filter((item) => {
    if (item.apenasMaster && !isMaster) return false;
    if (item.modulo && !moduloLiberado(item.modulo)) return false;
    return true;
  });
}

/** O item de nav que "governa" um pathname — o de prefixo mais longo. */
export function itemDaRota(pathname: string): NavItem | null {
  if (pathname === "/") return NAV_ITEMS[0] ?? null;
  let melhor: NavItem | null = null;
  for (const item of NAV_ITEMS) {
    if (item.href === "/") continue;
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!melhor || item.href.length > melhor.href.length) melhor = item;
    }
  }
  return melhor;
}
