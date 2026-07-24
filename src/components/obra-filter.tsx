"use client";

import { useRouter } from "next/navigation";

/** Filtro por obra que navega via querystring (?obra=<id>). */
export function ObraFilter({
  obras,
  value,
  basePath,
}: {
  obras: { id: string; codigo: string; nome: string }[];
  value?: string;
  basePath: string;
}) {
  const router = useRouter();
  if (obras.length === 0) return null;

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Obra</span>
      <select
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `${basePath}?obra=${v}` : basePath);
        }}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring"
      >
        <option value="">Todas as obras</option>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.codigo} — {o.nome}
          </option>
        ))}
      </select>
    </label>
  );
}
