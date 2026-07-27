"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Busca (nome/CNPJ) + filtro por obra, sincronizados na querystring. */
export function FornecedoresToolbar({
  obras,
  q = "",
  obra = "",
}: {
  obras: { id: string; codigo: string; nome: string }[];
  q?: string;
  obra?: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);
  const [, startTransition] = useTransition();

  const navegar = (novoQ: string, novaObra: string) => {
    const params = new URLSearchParams();
    if (novoQ.trim()) params.set("q", novoQ.trim());
    if (novaObra) params.set("obra", novaObra);
    const qs = params.toString();
    startTransition(() => router.push(qs ? `/fornecedores?${qs}` : "/fornecedores"));
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <form
        className="relative flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          navegar(texto, obra);
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nome ou CNPJ…"
          className="pl-9"
          aria-label="Buscar fornecedor"
        />
      </form>
      {obras.length > 0 ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Obra</span>
          <select
            value={obra}
            onChange={(e) => navegar(texto, e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
          >
            <option value="">Todas as obras</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}
