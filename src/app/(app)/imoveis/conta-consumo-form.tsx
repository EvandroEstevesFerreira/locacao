"use client";

import { useActionState } from "react";
import { salvarContaConsumo, type ImovelFormState } from "./actions";
import { TIPOS_CONSUMO, TIPO_CONSUMO_INFO } from "@/lib/imoveis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";


export function ContaConsumoForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(
    salvarContaConsumo,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="tipo_c">Tipo</Label>
          <NativeSelect id="tipo_c" name="tipo" defaultValue="luz">
            {TIPOS_CONSUMO.map((t) => (
              <option key={t} value={t}>{TIPO_CONSUMO_INFO[t]}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="competencia">Competência (mês)</Label>
          <Input id="competencia" name="competencia" type="month" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_c">Valor (R$)</Label>
          <Input id="valor_c" name="valor" type="number" step="0.01" min={0} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vencimento_c">Vencimento</Label>
          <Input id="vencimento_c" name="vencimento" type="date" />
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="pago" className="size-4" /> Já pago
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="lancar" defaultChecked className="size-4" />
          Lançar no financeiro (requer obra vinculada)
        </label>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Adicionar conta"}
      </Button>
    </form>
  );
}
