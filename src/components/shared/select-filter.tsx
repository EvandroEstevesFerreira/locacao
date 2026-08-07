"use client";

// Filtro de lista por seleção, sincronizado na querystring.
//
// Genérico de propósito: absorve o antigo ObraFilter (que era o mesmo código
// com `obra` fixo no lugar de `param`) e substitui os blocos
// `<form method="get">` + `<select>` + botão "Filtrar" que existiam em
// /imoveis, /financeiro e /vistorias/[id]. Aplica na hora, sem botão.
//
// Como o ListSearch, apaga `page` ao mudar o filtro: sem isso quem está na
// página 7 continua pedindo a página 7 de um resultado que agora tem 2.

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

export type OpcaoFiltro = { value: string; label: string };

export function SelectFilter({
  param,
  label,
  opcoes,
  placeholder = "Todos",
  className,
}: {
  /** Nome do parâmetro na querystring (ex.: "obra", "status"). */
  param: string;
  label: string;
  opcoes: OpcaoFiltro[];
  /** Texto da opção que representa "sem filtro". */
  placeholder?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pendente, startTransition] = useTransition();

  // Sem opções não há o que filtrar — não ocupa espaço na barra.
  if (opcoes.length === 0) return null;

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
      <NativeSelect
        className="w-auto"
        value={sp.get(param) ?? ""}
        onChange={(e) => aplicar(e.target.value)}
        disabled={pendente}
        aria-label={label}
      >
        <option value="">{placeholder}</option>
        {opcoes.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
