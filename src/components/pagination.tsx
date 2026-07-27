"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Controles de paginação que preservam busca/filtros/ordenação na URL. */
export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (total <= pageSize) return null;

  const ir = (p: number) => {
    const params = new URLSearchParams(sp.toString());
    if (p <= 1) params.delete("page");
    else params.set("page", String(p));
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="text-muted-foreground tabular-nums">
        {inicio}–{fim} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={page <= 1}
          onClick={() => ir(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="px-2 tabular-nums text-muted-foreground">
          {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Próxima página"
          disabled={page >= totalPages}
          onClick={() => ir(page + 1)}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
