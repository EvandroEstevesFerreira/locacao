"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarContrato, type ContratoFormState } from "./actions";
import { CADENCIA, type Cadencia, type StatusContrato } from "@/lib/locacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Contrato = {
  id: string;
  obra_id: string;
  fornecedor_id: string;
  numero: string;
  cadencia: Cadencia;
  data_inicio: string;
  data_fim_prevista: string | null;
  status: StatusContrato;
  observacoes: string | null;
  cobranca_prorata?: boolean;
};

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ContratoForm({
  contrato,
  obras,
  fornecedores,
}: {
  contrato?: Contrato;
  obras: { id: string; codigo: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
}) {
  const [state, formAction, isPending] = useActionState<
    ContratoFormState,
    FormData
  >(salvarContrato, {});

  return (
    <form action={formAction} className="space-y-5">
      {contrato ? <input type="hidden" name="id" value={contrato.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="obra_id">Obra *</Label>
          <select
            id="obra_id"
            name="obra_id"
            required
            defaultValue={contrato?.obra_id ?? ""}
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
          <Label htmlFor="fornecedor_id">Fornecedor *</Label>
          <select
            id="fornecedor_id"
            name="fornecedor_id"
            required
            defaultValue={contrato?.fornecedor_id ?? ""}
            className={selectClasses}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="numero">Número do contrato *</Label>
          <Input
            id="numero"
            name="numero"
            required
            maxLength={60}
            defaultValue={contrato?.numero ?? ""}
            placeholder="Ex.: CT-2026-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cadencia">Cadência de cobrança *</Label>
          <select
            id="cadencia"
            name="cadencia"
            defaultValue={contrato?.cadencia ?? "mensal"}
            className={selectClasses}
          >
            {(Object.keys(CADENCIA) as Cadencia[]).map((c) => (
              <option key={c} value={c}>
                {CADENCIA[c].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="data_inicio">Início *</Label>
          <Input
            id="data_inicio"
            name="data_inicio"
            type="date"
            required
            defaultValue={contrato?.data_inicio ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_fim_prevista">Fim previsto</Label>
          <Input
            id="data_fim_prevista"
            name="data_fim_prevista"
            type="date"
            defaultValue={contrato?.data_fim_prevista ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={contrato?.status ?? "ativo"}
            className={selectClasses}
          >
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      <label className="flex items-start gap-2 border border-border p-3 text-sm">
        <input
          type="checkbox"
          name="cobranca_prorata"
          defaultChecked={contrato?.cobranca_prorata ?? false}
          className="mt-0.5 size-4"
        />
        <span>
          <span className="font-medium">Cobrança pró-rata</span>
          <span className="block text-xs text-muted-foreground">
            Cobra períodos proporcionais aos dias usados, em vez de período cheio
            (ex.: meia semana = metade do valor).
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          maxLength={1000}
          defaultValue={contrato?.observacoes ?? ""}
        />
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
          render={<Link href="/contratos" />}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
