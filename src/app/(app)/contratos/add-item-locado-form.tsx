"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import {
  adicionarItemLocado,
  type ItemLocadoFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function AddItemLocadoForm({
  contratoId,
  itens,
}: {
  contratoId: string;
  itens: { id: string; descricao: string; unidade: string | null }[];
}) {
  const [state, formAction, isPending] = useActionState<
    ItemLocadoFormState,
    FormData
  >(adicionarItemLocado, {});

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="contrato_id" value={contratoId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="item_id">Item *</Label>
          <select id="item_id" name="item_id" required defaultValue="" className={selectClasses}>
            <option value="" disabled>
              Selecione o item…
            </option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.descricao}
                {i.unidade ? ` (${i.unidade})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="quantidade">Quantidade *</Label>
          <Input
            id="quantidade"
            name="quantidade"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue="1"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_unitario_periodo">Valor unit. / período *</Label>
          <Input
            id="valor_unitario_periodo"
            name="valor_unitario_periodo"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue="0"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_retirada">Retirada *</Label>
          <Input id="data_retirada" name="data_retirada" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_devolucao_prevista">Devolução prevista</Label>
          <Input
            id="data_devolucao_prevista"
            name="data_devolucao_prevista"
            type="date"
          />
        </div>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={isPending}>
        <Plus className="size-4" />
        {isPending ? "Adicionando…" : "Adicionar item"}
      </Button>
    </form>
  );
}
