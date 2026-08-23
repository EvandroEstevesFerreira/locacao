// Gráfico de barras simples em CSS (sem biblioteca de gráfico). Server-safe.
// Alturas em pixels (não em %) para não depender da altura do contêiner flex.
//
// As barras usam `--foreground` com opacidade, não `--primary`. Com a paleta
// Sistenge 2026 o primary é slate-900 no claro e inverte para slate-50 no
// escuro — o que daria barras de branco puro sobre o card escuro, agressivo
// demais. O foreground com opacidade dá a mesma hierarquia (mês corrente forte,
// demais apagados) e se comporta nos dois temas.

import Link from "next/link";

export type BarPoint = {
  label: string;
  value: number;
  destaque?: boolean;
  /** Quando informado, a coluna inteira vira link para o detalhe do ponto. */
  href?: string;
};

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
          const titulo = `${d.label}: ${formatValue(d.value)}`;
          const classe = "flex min-w-8 flex-1 flex-col items-center justify-end gap-1";

          // A barra pode ter 3px num mês quase vazio — clicar nela seria um
          // exercício de pontaria. Por isso o link envolve a COLUNA inteira, do
          // topo do gráfico à base: o alvo é a faixa toda.
          const coluna = (
            <>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {d.value > 0 ? formatValue(d.value) : ""}
              </span>
              <div
                className={`w-full rounded-t-sm ${d.destaque ? "bg-foreground/90" : "bg-foreground/40"}`}
                style={{ height: alturaPx }}
              />
            </>
          );

          return d.href ? (
            <Link
              key={i}
              href={d.href}
              title={`${titulo} — ver os lançamentos do mês`}
              className={`${classe} rounded-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
            >
              {coluna}
            </Link>
          ) : (
            <div key={i} className={classe} title={titulo}>
              {coluna}
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

/**
 * Barras horizontais para ranking de categorias — o gráfico de /relatorios, que
 * antes era montado à mão na própria página.
 *
 * É um componente separado, e não um prop `orientation` no BarChart, de
 * propósito: os dois são gráficos genuinamente diferentes. O BarChart é série
 * temporal com destaque do mês corrente e o valor sobre a coluna; este é
 * ranking com o valor na linha do rótulo, sem noção de "agora". Um booleano de
 * orientação seria a proliferação de prop que o Sistenge People evita — mas o
 * cálculo do máximo e o vocabulário de cor ficam compartilhados aqui.
 */
export function HBarChart({
  data,
  formatValue = (n) => String(n),
}: {
  data: { label: string; valor: number }[];
  formatValue?: (n: number) => string;
}) {
  if (data.length === 0) return null;
  const max = data.reduce((m, d) => Math.max(m, d.valor), 0);

  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={i}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{d.label}</span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatValue(d.valor)}
            </span>
          </div>
          {/* Trilha e preenchimento arredondados: a borda reta sem raio era
              artefato do antigo --radius: 0. */}
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground/80"
              style={{ width: `${max > 0 ? (d.valor / max) * 100 : 0}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
