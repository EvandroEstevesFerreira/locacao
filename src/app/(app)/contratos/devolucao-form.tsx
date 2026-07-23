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
    <div className="min-w-[300px]">
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="item_locado_id" value={itemLocadoId} />
        <input type="hidden" name="contrato_id" value={contratoId} />
        <label className="text-xs text-muted-foreground">Qtd.</label>
        <Input
          name="quantidade"
          type="number"
          step="0.01"
          min="0.01"
          max={saldo}
          defaultValue={saldo}
          className="h-8 w-16"
        />
        <label className="text-xs text-muted-foreground">Data</label>
        <Input
          name="data"
          type="date"
          defaultValue={hoje()}
          className="h-8 w-36"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={isPending}
          title="Registra a devolução e abre o relatório fotográfico para anexar as fotos"
        >
          {isPending ? "…" : "Devolver"}
        </Button>
      </form>
      {state.error ? (
        <p className="mt-1 text-xs text-destructive">{state.error}</p>
      ) : null}
    </div>
  );
}
