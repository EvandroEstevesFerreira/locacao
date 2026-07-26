"use client";

import { useActionState } from "react";
import { salvarOcupante, type ImovelFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OcupanteForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarOcupante, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="oc_nome">Nome</Label>
          <Input id="oc_nome" name="nome" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_cpf">CPF</Label>
          <Input id="oc_cpf" name="cpf" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_contato">Contato</Label>
          <Input id="oc_contato" name="contato" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_entrada">Entrada</Label>
          <Input id="oc_entrada" name="data_entrada" type="date" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="oc_saida">Saída</Label>
          <Input id="oc_saida" name="data_saida" type="date" />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Adicionar ocupante"}</Button>
    </form>
  );
}
