"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarLancamento, type LancamentoFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Lancamento = {
  id: string;
  obra_id: string;
  contrato_id: string | null;
  descricao: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago";
};

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function LancamentoForm({
  lancamento,
  obras,
  contratos,
}: {
  lancamento?: Lancamento;
  obras: { id: string; codigo: string; nome: string }[];
  contratos: { id: string; numero: string }[];
}) {
  const [state, formAction, isPending] = useActionState<
    LancamentoFormState,
    FormData
  >(salvarLancamento, {});

  return (
    <form action={formAction} className="space-y-5">
      {lancamento ? <input type="hidden" name="id" value={lancamento.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="obra_id">Obra *</Label>
          <select
            id="obra_id"
            name="obra_id"
            required
            defaultValue={lancamento?.obra_id ?? ""}
            className={selectClasses}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contrato_id">Contrato (opcional)</Label>
          <select
            id="contrato_id"
            name="contrato_id"
            defaultValue={lancamento?.contrato_id ?? ""}
            className={selectClasses}
          >
            <option value="">—</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          name="descricao"
          required
          maxLength={200}
          defaultValue={lancamento?.descricao ?? ""}
          placeholder="Ex.: Locação betoneira - julho"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="competencia">Competência *</Label>
          <Input
            id="competencia"
            name="competencia"
            type="month"
            required
            defaultValue={lancamento?.competencia?.slice(0, 7) ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor">Valor (R$) *</Label>
          <Input
            id="valor"
            name="valor"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={lancamento?.valor ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vencimento">Vencimento *</Label>
          <Input
            id="vencimento"
            name="vencimento"
            type="date"
            required
            defaultValue={lancamento?.vencimento ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          name="status"
          defaultValue={lancamento?.status ?? "pendente"}
          className={`${selectClasses} max-w-48`}
        >
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </select>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/financeiro" />}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
