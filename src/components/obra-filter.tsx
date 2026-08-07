"use client";

import { useRouter } from "next/navigation";
import { NativeSelect } from "@/components/ui/native-select";

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
      <NativeSelect
        className="w-auto"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          router.push(v ? `${basePath}?obra=${v}` : basePath);
        }}
      >
        <option value="">Todas as obras</option>
        {obras.map((o) => (
          <option key={o.id} value={o.id}>
            {o.codigo} — {o.nome}
          </option>
        ))}
      </NativeSelect>
    </label>
  );
}
