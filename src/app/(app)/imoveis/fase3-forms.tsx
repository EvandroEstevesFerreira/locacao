"use client";

import { useActionState } from "react";
import {
  salvarReparo,
  salvarOcorrencia,
  salvarVistoriaImovel,
  type ImovelFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export function ReparoForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarReparo, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="r_data">Data</Label>
          <Input id="r_data" name="data" type="date" required />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="r_desc">Descrição</Label>
          <Input id="r_desc" name="descricao" required placeholder="O que foi reparado" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="r_valor">Valor (R$)</Label>
          <Input id="r_valor" name="valor" type="number" step="0.01" min={0} />
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="r_exec">Executado por</Label>
          <Input id="r_exec" name="executor" placeholder="Nome do prestador/empresa" />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Adicionar reparo"}</Button>
    </form>
  );
}

export function OcorrenciaForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarOcorrencia, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="o_data">Data</Label>
          <Input id="o_data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o_tipo">Tipo</Label>
          <select id="o_tipo" name="tipo" defaultValue="outro" className={selectClasses}>
            <option value="avaria">Avaria</option>
            <option value="reparo">Reparo</option>
            <option value="desentendimento">Desentendimento</option>
            <option value="outro">Outro</option>
          </select>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="o_desc">Descrição</Label>
          <Input id="o_desc" name="descricao" required />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Registrar ocorrência"}</Button>
    </form>
  );
}

export function VistoriaImovelForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarVistoriaImovel, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="v_data">Data</Label>
          <Input id="v_data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="v_resp">Responsável</Label>
          <Input id="v_resp" name="responsavel" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="v_obs">Observações</Label>
        <Textarea id="v_obs" name="observacoes" rows={2} />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Adicionar vistoria"}</Button>
    </form>
  );
}
