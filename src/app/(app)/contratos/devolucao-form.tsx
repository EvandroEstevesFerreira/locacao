"use client";

import { useActionState } from "react";
import { registrarDevolucao, type DevolucaoFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const hoje = () => new Date().toISOString().slice(0, 10);

export function DevolucaoForm({
  itemLocadoId,
  contratoId,
  saldo,
}: {
  itemLocadoId: string;
  contratoId: string;
  saldo: number;
}) {
  const [state, formAction, isPending] = useActionState<
    DevolucaoFormState,
    FormData
  >(registrarDevolucao, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="item_locado_id" value={itemLocadoId} />
      <input type="hidden" name="contrato_id" value={contratoId} />
      <div className="w-24">
        <label className="text-xs text-muted-foreground">Qtd.</label>
        <Input
          name="quantidade"
          type="number"
          step="0.01"
          min="0.01"
          max={saldo}
          defaultValue={saldo}
          className="h-8"
        />
      </div>
      <div className="w-40">
        <label className="text-xs text-muted-foreground">Data</label>
        <Input name="data" type="date" defaultValue={hoje()} className="h-8" />
      </div>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={isPending}
        title="Registra a devolução e abre o relatório fotográfico para anexar as fotos"
      >
        {isPending ? "…" : "Devolver"}
      </Button>
      {state.error ? (
        <p className="w-full text-xs text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
