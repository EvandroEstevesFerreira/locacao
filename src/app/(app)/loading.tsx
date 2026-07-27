/** Fallback de carregamento para as rotas do app (navegação entre páginas). */
export default function Loading() {
  return (
    <div
      className="mx-auto max-w-5xl space-y-4 py-2"
      role="status"
      aria-label="Carregando"
    >
      <div className="h-8 w-56 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded bg-muted/70" />
      <div className="mt-6 space-y-3 rounded-xl border border-border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-5 w-full animate-pulse rounded bg-muted/60" />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
