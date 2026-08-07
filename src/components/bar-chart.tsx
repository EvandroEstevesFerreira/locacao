// Gráfico de barras simples em CSS (sem dependências). Server-safe.
// Alturas em pixels (não em %) para não depender da altura do contêiner flex.
//
// As barras usam `--foreground` com opacidade, não `--primary`. Com a paleta
// Sistenge 2026 o primary é slate-900 no claro e inverte para slate-50 no
// escuro — o que daria barras de branco puro sobre o card escuro, agressivo
// demais. O foreground com opacidade dá a mesma hierarquia (mês corrente forte,
// demais apagados) e se comporta nos dois temas.

export type BarPoint = { label: string; value: number; destaque?: boolean };

export function BarChart({
  data,
  formatValue = (n) => String(n),
  height = 160,
}: {
  data: BarPoint[];
  formatValue?: (n: number) => string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</p>
    );
  }

  // Reserva ~18px para o rótulo do valor no topo de cada coluna.
  const areaBarras = Math.max(24, height - 18);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const alturaPx =
            d.value > 0 ? Math.max(3, Math.round((d.value / max) * areaBarras)) : 0;
          return (
            <div key={i} className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {d.value > 0 ? formatValue(d.value) : ""}
              </span>
              <div
                className={`w-full rounded-t-sm ${d.destaque ? "bg-foreground/90" : "bg-foreground/40"}`}
                style={{ height: alturaPx }}
                title={`${d.label}: ${formatValue(d.value)}`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex min-w-full gap-2">
        {data.map((d, i) => (
          <div key={i} className="min-w-8 flex-1 text-center text-[10px] text-muted-foreground">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
