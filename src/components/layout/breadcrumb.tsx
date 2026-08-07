"use client";

// Trilha de navegação derivada do pathname — não configurada por página.
//
// Ela é o que substitui a prop `eyebrow` que o PageHeader tinha: em 24 das 26
// páginas o eyebrow repetia exatamente este rótulo de módulo.
//
// Duas decisões sobre os segmentos finais:
// - segmentos dinâmicos (UUID) são omitidos. "Contratos › 8f3a-..." não informa
//   nada que o título da página já não diga.
// - segmentos estáticos conhecidos ganham rótulo em PT-BR pelo mapa abaixo. Um
//   segmento não mapeado também é omitido, em vez de aparecer cru ("recorrentes"
//   com r minúsculo, sem acento) — é melhor mostrar menos do que mostrar feio.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { itemDaRota } from "@/lib/nav";

/** Rótulos dos segmentos estáticos que aparecem depois do módulo. */
const SEGMENTO_LABEL: Record<string, string> = {
  nova: "Nova",
  novo: "Novo",
  editar: "Editar",
  baixa: "Baixa",
  fluxo: "Fluxo de caixa",
  recorrentes: "Recorrentes",
  documentos: "Documentos",
  templates: "Templates",
  auditoria: "Auditoria",
  empresa: "Empresa",
};

export function Breadcrumb() {
  const pathname = usePathname();

  // No Início a trilha seria só o próprio Início.
  if (pathname === "/") return null;

  const item = itemDaRota(pathname);
  if (!item) return null;

  const resto = pathname
    .slice(item.href.length)
    .split("/")
    .filter(Boolean)
    .map((s) => SEGMENTO_LABEL[s])
    .filter((s): s is string => Boolean(s));

  return (
    <nav
      aria-label="Trilha de navegação"
      className="hidden min-w-0 items-center gap-1.5 text-sm text-muted-foreground md:flex"
    >
      <Link
        href="/"
        aria-label="Início"
        className="rounded transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Home className="size-4" />
      </Link>

      <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
      {resto.length === 0 ? (
        <span className="truncate text-foreground">{item.label}</span>
      ) : (
        <Link
          href={item.href}
          className="truncate rounded transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {item.label}
        </Link>
      )}

      {resto.map((label, i) => (
        <span key={`${label}-${i}`} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="size-4 shrink-0 opacity-50" aria-hidden />
          <span className="truncate">{label}</span>
        </span>
      ))}
    </nav>
  );
}
