"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * Busca genérica sincronizada na querystring. Preserva os demais filtros e
 * reinicia a paginação (`page`). Use em qualquer lista.
 */
export function ListSearch({
  placeholder = "Buscar…",
  paramName = "q",
  ariaLabel = "Buscar",
}: {
  placeholder?: string;
  paramName?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [texto, setTexto] = useState(sp.get(paramName) ?? "");
  const [, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(sp.toString());
    if (texto.trim()) params.set(paramName, texto.trim());
    else params.delete(paramName);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname));
  }

  return (
    <form onSubmit={submit} className="relative flex-1">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
        aria-label={ariaLabel}
      />
    </form>
  );
}
