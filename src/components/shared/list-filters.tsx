"use client";

// Casca da barra de filtros das listagens: só layout e o botão de limpar tudo.
//
// Deliberadamente magra. O Sistenge People tem um `filtros.tsx` por módulo, mas
// ele não tem paginação nem ordenação compartilhadas — o Loca tem os três
// (ListSearch, SortHeader, Pagination), então um componente por módulo aqui
// seria duplicação. Este envolve os filtros que a página já monta e acrescenta o
// reset.
//
// Uma exceção justificada, registrada no AGENTS.md: /relatorios continua com
// submit em botão. Seus 6 controles precisam ser aplicados juntos, e um
// `router.replace` por controle dispararia 6 navegações, cada uma re-executando
// `gerarRelatorio()`.

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ListFilters({
  children,
  /** Parâmetros que o botão de limpar NÃO deve remover (ex.: "sort", "dir"). */
  preservar = ["sort", "dir"],
  className,
}: {
  children: React.ReactNode;
  preservar?: string[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();

  // "Tem filtro ativo" ignora o que é ordenação, senão o botão apareceria só
  // por o usuário ter clicado num cabeçalho de coluna.
  const ativos = [...sp.keys()].filter(
    (k) => k !== "page" && !preservar.includes(k),
  );

  function limpar() {
    const params = new URLSearchParams();
    for (const k of preservar) {
      const v = sp.get(k);
      if (v) params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-md border bg-muted/20 p-3",
        className,
      )}
    >
      {children}
      {ativos.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limpar}
          disabled={pendente}
          className="ml-auto"
        >
          <RotateCcw className="size-4" />
          Limpar
        </Button>
      ) : null}
    </div>
  );
}
