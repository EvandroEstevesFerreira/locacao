"use client";

import { useActionState, useState } from "react";
import { salvarContratoImovel, type ImovelFormState } from "./actions";
import { STATUS_CAUCAO_INFO, type StatusCaucao } from "@/lib/imoveis";
import { formatarBRL } from "@/lib/locacao";
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
  valor_iptu?: number | null;
  seguro_fianca?: number | null;
  seguro_fianca_mensal?: boolean;
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

  const [aluguel, setAluguel] = useState(contrato?.valor_aluguel ?? 0);
  const [condominio, setCondominio] = useState(contrato?.valor_condominio ?? 0);
  const [iptu, setIptu] = useState(contrato?.valor_iptu ?? 0);
  const [seguro, setSeguro] = useState(contrato?.seguro_fianca ?? 0);
  const [seguroMensal, setSeguroMensal] = useState(
    contrato?.seguro_fianca_mensal ?? true,
  );
  const totalMensal =
    (Number(aluguel) || 0) +
    (Number(condominio) || 0) +
    (Number(iptu) || 0) +
    (seguroMensal ? Number(seguro) || 0 : 0);

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
          <Input id="valor_aluguel" name="valor_aluguel" type="number" step="0.01" min={0} value={aluguel} onChange={(e) => setAluguel(e.target.value === "" ? 0 : Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
          <Input id="valor_condominio" name="valor_condominio" type="number" step="0.01" min={0} value={condominio} onChange={(e) => setCondominio(e.target.value === "" ? 0 : Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_iptu">IPTU (R$)</Label>
          <Input id="valor_iptu" name="valor_iptu" type="number" step="0.01" min={0} value={iptu} onChange={(e) => setIptu(e.target.value === "" ? 0 : Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seguro_fianca">Seguro fiança (R$)</Label>
          <Input id="seguro_fianca" name="seguro_fianca" type="number" step="0.01" min={0} value={seguro} onChange={(e) => setSeguro(e.target.value === "" ? 0 : Number(e.target.value))} />
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="seguro_fianca_mensal"
          checked={seguroMensal}
          onChange={(e) => setSeguroMensal(e.target.checked)}
          className="size-4"
        />
        Somar o seguro fiança na parcela mensal
      </label>

      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Total mensal (aluguel + condomínio + IPTU{seguroMensal ? " + seguro fiança" : ""})
        </span>
        <span className="text-base font-semibold">{formatarBRL(totalMensal)}</span>
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
