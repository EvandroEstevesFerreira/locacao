"use client";

// Filtro de lista por mês, sincronizado na querystring.
//
// Um `<input type="month">` e não um `<select>` de 12 meses: o recorte útil não
// é só o horizonte do gráfico da home. Quem procura "aquela conta de março do
// ano passado" precisa alcançá-la, e uma lista fixa de opções esconderia
// justamente o mês que se está procurando.
//
// Como o ListSearch e o SelectFilter, aplica na hora e apaga `page`: sem isso
// quem está na página 7 continua pedindo a página 7 de um resultado que agora
// tem 2.

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function MesFilter({
  param = "mes",
  label = "Mês do vencimento",
  className,
}: {
  param?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();

  function aplicar(valor: string) {
    const params = new URLSearchParams(sp.toString());
    if (valor) params.set(param, valor);
    else params.delete(param);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <label className={className}>
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      <Input
        type="month"
        className="w-auto"
        value={sp.get(param) ?? ""}
        onChange={(e) => aplicar(e.target.value)}
        disabled={pendente}
        aria-label={label}
      />
    </label>
  );
}
