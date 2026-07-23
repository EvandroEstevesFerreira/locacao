"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { adicionarAvaria, type AvariaFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddAvariaForm({ vistoriaId }: { vistoriaId: string }) {
  const [state, formAction, isPending] = useActionState<
    AvariaFormState,
    FormData
  >(adicionarAvaria, {});

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="vistoria_id" value={vistoriaId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          name="descricao"
          required
          maxLength={300}
          placeholder="Descrição da avaria"
          className="flex-1"
        />
        <Input
          name="custo_estimado"
          type="number"
          step="0.01"
          min="0"
          defaultValue="0"
          placeholder="Custo estimado"
          className="sm:w-40"
        />
        <Button type="submit" disabled={isPending}>
          <Plus className="size-4" />
          {isPending ? "…" : "Adicionar"}
        </Button>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
