// KpiCard — primitivo de indicador para painéis e cabeçalhos de listagem.
// Substitui as três definições inline que existiam (o bloco do painel e as
// funções `Kpi` locais de /imoveis e /financeiro).
//
// - variantes de cor (default | success | warning | danger | info | brand)
// - delta opcional, com inversão de polaridade para KPIs em que cair é bom
//   (custo, vencido, avaria)
// - `href` opcional torna o card clicável
// - valor em tabular-nums, para que os números não dancem entre linhas
//
// `variant="brand"` usa o vermelho da marca e é reservado a criticidade —
// nunca a um CTA, conforme a restrição do token --brand.

import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

export type KpiDelta = {
  sentido: "up" | "down" | "flat" | "novo";
  pct: number | null;
};

const VARIANTES: Record<KpiVariant, { fundo: string; icone: string }> = {
  default: { fundo: "bg-muted", icone: "text-muted-foreground" },
  success: { fundo: "bg-success/10", icone: "text-success" },
  warning: { fundo: "bg-warning/10", icone: "text-warning" },
  danger: { fundo: "bg-destructive/10", icone: "text-destructive" },
  info: { fundo: "bg-info/10", icone: "text-info" },
  brand: { fundo: "bg-brand/10", icone: "text-brand" },
};

export function KpiCard({
  icon,
  label,
  value,
  detail,
  delta,
  invertido,
  variant = "default",
  href,
  className,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  detail?: React.ReactNode;
  delta?: KpiDelta;
  /** KPIs em que diminuir é positivo (custo, vencido). Inverte a cor do delta. */
  invertido?: boolean;
  variant?: KpiVariant;
  href?: string;
  className?: string;
}) {
  const v = VARIANTES[variant];

  const conteudo = (
    <Card
      className={cn(
        "h-full transition-all",
        href && "cursor-pointer hover:border-primary/30 hover:shadow-md",
        className,
      )}
    >
      <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? (
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md",
                  v.fundo,
                )}
              >
                <span className={cn("[&_svg]:size-4", v.icone)}>{icon}</span>
              </div>
            ) : null}
            <span className="truncate text-xs font-medium text-muted-foreground">
              {label}
            </span>
          </div>
          {delta ? <Delta delta={delta} invertido={invertido} /> : null}
        </div>
        <div className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </div>
        {detail ? (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {detail}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {conteudo}
      </Link>
    );
  }
  return conteudo;
}

function Delta({
  delta,
  invertido,
}: {
  delta: KpiDelta;
  invertido?: boolean;
}) {
  if (delta.sentido === "flat" && delta.pct === null) return null;

  const positivo =
    delta.sentido === "novo"
      ? !invertido
      : invertido
        ? delta.sentido === "down"
        : delta.sentido === "up";

  const Icone =
    delta.sentido === "up"
      ? TrendingUp
      : delta.sentido === "down"
        ? TrendingDown
        : Minus;

  const texto =
    delta.sentido === "novo"
      ? "novo"
      : delta.pct === null
        ? "—"
        : `${delta.pct > 0 ? "+" : ""}${delta.pct.toFixed(1)}%`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
        positivo
          ? "bg-success/10 text-success"
          : delta.sentido === "flat"
            ? "bg-muted text-muted-foreground"
            : "bg-destructive/10 text-destructive",
      )}
    >
      <Icone className="size-3" />
      {texto}
    </span>
  );
}
