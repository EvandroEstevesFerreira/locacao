// Fallbacks de carregamento em duas camadas, como no Sistenge People.
//
// O `loading.tsx` do grupo (app) usa o spinner: ele dispara em TODA navegação
// interna, inclusive nas 17 páginas de formulário, e um esqueleto de tabela ali
// mentiria sobre a forma da tela.
//
// Rotas com payload pesado — listas com várias consultas, detalhes que assinam
// URLs de Storage — ganham um `loading.tsx` próprio com o esqueleto da forma
// real, que evita salto de layout quando o conteúdo chega.

import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Fallback neutro: não afirma nada sobre a forma da página. */
export function SpinnerCarregando() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      role="status"
      aria-label="Carregando"
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Cabeçalho + barra de filtros + tabela — a forma das 9 listagens. */
export function SkeletonLista({ linhas = 8 }: { linhas?: number }) {
  return (
    <div
      className="mx-auto max-w-6xl space-y-6"
      role="status"
      aria-label="Carregando"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Skeleton className="h-10 w-full sm:max-w-xs" />
        <Skeleton className="h-10 w-48" />
      </div>

      <div className="rounded-lg border">
        <div className="h-12 border-b bg-muted/30" />
        <div className="divide-y">
          {Array.from({ length: linhas }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Cabeçalho + blocos de seção — a forma das telas de detalhe. */
export function SkeletonDetalhe({ secoes = 3 }: { secoes?: number }) {
  return (
    <div
      className="mx-auto max-w-5xl space-y-6"
      role="status"
      aria-label="Carregando"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {Array.from({ length: secoes }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <span className="sr-only">Carregando…</span>
    </div>
  );
}
