"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarVistoria, type VistoriaFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";


export function VistoriaForm({
  contratos,
  contratoIdInicial,
}: {
  contratos: { id: string; numero: string; obra: string }[];
  contratoIdInicial?: string;
}) {
  const [state, formAction, isPending] = useActionState<
    VistoriaFormState,
    FormData
  >(salvarVistoria, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="contrato_id">Contrato *</Label>
        <NativeSelect
          id="contrato_id"
          name="contrato_id"
          required
          defaultValue={contratoIdInicial ?? ""}
        >
          <option value="" disabled>
            Selecione…
          </option>
          {contratos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.numero} — {c.obra}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo *</Label>
          <NativeSelect id="tipo" name="tipo" defaultValue="entrada">
            <option value="entrada">Entrada (retirada)</option>
            <option value="devolucao">Devolução</option>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="data">Data *</Label>
          <Input id="data" name="data" type="date" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="responsavel">Responsável</Label>
        <Input id="responsavel" name="responsavel" maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={3} maxLength={1000} />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar e continuar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/vistorias" />}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
