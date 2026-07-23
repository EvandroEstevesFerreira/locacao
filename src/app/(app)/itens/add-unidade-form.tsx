"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { adicionarUnidade, type UnidadeFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddUnidadeForm({ itemId }: { itemId: string }) {
  const [state, formAction, isPending] = useActionState<
    UnidadeFormState,
    FormData
  >(adicionarUnidade, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="item_id" value={itemId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="identificador"
          required
          maxLength={80}
          placeholder="Identificador (nº série / patrimônio)"
          className="sm:max-w-xs"
        />
        <Input
          name="observacoes"
          maxLength={300}
          placeholder="Observações (opcional)"
          className="flex-1"
        />
        <Button type="submit" disabled={isPending}>
          <Plus className="size-4" />
          {isPending ? "Adicionando…" : "Adicionar"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
