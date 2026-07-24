"use client";

import { useActionState } from "react";
import { salvarContratoImovel, type ImovelFormState } from "./actions";
import { STATUS_CAUCAO_INFO, type StatusCaucao } from "@/lib/imoveis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export type ContratoImovelDados = {
  id?: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  valor_aluguel?: number | null;
  valor_condominio?: number | null;
  dia_vencimento?: number | null;
  indice_reajuste?: string | null;
  data_reajuste?: string | null;
  caucao_valor?: number | null;
  caucao_status?: string | null;
  vigente?: boolean;
  observacoes?: string | null;
};

export function ContratoImovelForm({
  imovelId,
  contrato,
  onDoneLabel = "Salvar contrato",
}: {
  imovelId: string;
  contrato?: ContratoImovelDados;
  onDoneLabel?: string;
}) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(
    salvarContratoImovel,
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      {contrato?.id ? <input type="hidden" name="id" value={contrato.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="data_inicio">Início</Label>
          <Input id="data_inicio" name="data_inicio" type="date" defaultValue={contrato?.data_inicio ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_fim">Fim</Label>
          <Input id="data_fim" name="data_fim" type="date" defaultValue={contrato?.data_fim ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_aluguel">Aluguel (R$)</Label>
          <Input id="valor_aluguel" name="valor_aluguel" type="number" step="0.01" min={0} defaultValue={contrato?.valor_aluguel ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
          <Input id="valor_condominio" name="valor_condominio" type="number" step="0.01" min={0} defaultValue={contrato?.valor_condominio ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dia_vencimento">Dia de vencimento</Label>
          <Input id="dia_vencimento" name="dia_vencimento" type="number" min={1} max={31} defaultValue={contrato?.dia_vencimento ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="indice_reajuste">Índice de reajuste</Label>
          <Input id="indice_reajuste" name="indice_reajuste" placeholder="IGP-M / IPCA" defaultValue={contrato?.indice_reajuste ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data_reajuste">Próximo reajuste</Label>
          <Input id="data_reajuste" name="data_reajuste" type="date" defaultValue={contrato?.data_reajuste ?? ""} />
        </div>
      </div>

      <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <legend className="text-sm font-medium">Caução</legend>
        <div className="space-y-2">
          <Label htmlFor="caucao_valor">Valor da caução (R$)</Label>
          <Input id="caucao_valor" name="caucao_valor" type="number" step="0.01" min={0} defaultValue={contrato?.caucao_valor ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="caucao_status">Situação da caução</Label>
          <select id="caucao_status" name="caucao_status" defaultValue={contrato?.caucao_status ?? ""} className={selectClasses}>
            <option value="">— Não aplicável —</option>
            {(Object.keys(STATUS_CAUCAO_INFO) as StatusCaucao[]).map((s) => (
              <option key={s} value={s}>{STATUS_CAUCAO_INFO[s]}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={2} defaultValue={contrato?.observacoes ?? ""} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="vigente" defaultChecked={contrato?.vigente ?? true} className="size-4" />
        Este é o contrato vigente (os demais deste imóvel deixam de ser vigentes)
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : onDoneLabel}
      </Button>
    </form>
  );
}
