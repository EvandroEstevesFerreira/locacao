"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Exibe um dado sensível (CPF, conta, chave PIX) mascarado, com botão para
 * revelar sob demanda. Reduz exposição de PII na tela.
 */
export function PiiText({
  value,
  keepStart = 0,
  keepEnd = 2,
}: {
  value: string | null | undefined;
  keepStart?: number;
  keepEnd?: number;
}) {
  const [revelado, setRevelado] = useState(false);
  if (!value) return <>—</>;

  const mascarar = (v: string) => {
    if (v.length <= keepStart + keepEnd) return "•".repeat(Math.max(4, v.length));
    const inicio = v.slice(0, keepStart);
    const fim = keepEnd > 0 ? v.slice(-keepEnd) : "";
    const meio = "•".repeat(Math.max(3, v.length - keepStart - keepEnd));
    return `${inicio}${meio}${fim}`;
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="tabular-nums">{revelado ? value : mascarar(value)}</span>
      <button
        type="button"
        onClick={() => setRevelado((r) => !r)}
        className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        aria-label={revelado ? "Ocultar" : "Revelar"}
      >
        {revelado ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
    </span>
  );
}
