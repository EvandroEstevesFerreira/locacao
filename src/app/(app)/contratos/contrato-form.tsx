"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarContrato, type ContratoFormState } from "./actions";
import { CADENCIA, type Cadencia, type StatusContrato } from "@/lib/locacao";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";

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


export function ContratoForm({
  contrato,
  obras,
  fornecedores,
  numeroSugerido,
}: {
  contrato?: Contrato;
  obras: { id: string; codigo: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  numeroSugerido?: string;
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
          <NativeSelect
            id="obra_id"
            name="obra_id"
            required
            defaultValue={contrato?.obra_id ?? ""}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="fornecedor_id">Fornecedor *</Label>
          <NativeSelect
            id="fornecedor_id"
            name="fornecedor_id"
            required
            defaultValue={contrato?.fornecedor_id ?? ""}
          >
            <option value="" disabled>
              Selecione…
            </option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </NativeSelect>
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
            defaultValue={contrato?.numero ?? numeroSugerido ?? ""}
            placeholder="Ex.: CT-2026-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cadencia">Cadência de cobrança *</Label>
          <NativeSelect
            id="cadencia"
            name="cadencia"
            defaultValue={contrato?.cadencia ?? "mensal"}
          >
            {(Object.keys(CADENCIA) as Cadencia[]).map((c) => (
              <option key={c} value={c}>
                {CADENCIA[c].label}
              </option>
            ))}
          </NativeSelect>
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
          <NativeSelect
            id="status"
            name="status"
            defaultValue={contrato?.status ?? "ativo"}
          >
            <option value="ativo">Ativo</option>
            <option value="encerrado">Encerrado</option>
            <option value="cancelado">Cancelado</option>
          </NativeSelect>
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
