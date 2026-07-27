"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";

/**
 * Cabeçalho de coluna clicável que alterna ordenação (sort/dir) na URL.
 * Usar dentro de <TableHead>.
 */
export function SortHeader({ column, label }: { column: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const sortAtual = sp.get("sort");
  const dirAtual = sp.get("dir") === "desc" ? "desc" : "asc";
  const ativo = sortAtual === column;
  const proxDir = ativo && dirAtual === "asc" ? "desc" : "asc";

  function ordenar() {
    const params = new URLSearchParams(sp.toString());
    params.set("sort", column);
    params.set("dir", proxDir);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={ordenar}
      className="-ml-1 inline-flex items-center gap-1 rounded px-1 py-0.5 font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Ordenar por ${label}`}
    >
      {label}
      {ativo ? (
        dirAtual === "asc" ? (
          <ChevronUp className="size-3.5" />
        ) : (
          <ChevronDown className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 text-muted-foreground/60" />
      )}
    </button>
  );
}
