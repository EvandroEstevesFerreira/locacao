"use client";

import { useActionState, useState } from "react";
import { TrendingUp, FilePlus2, CircleSlash, History } from "lucide-react";
import {
  aplicarReajuste,
  registrarAditivo,
  encerrarContrato,
  type ImovelFormState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type HistoricoItem = {
  id: string;
  tipo: string;
  descricao: string;
  data_efeito: string;
};

const TIPO_LABEL: Record<string, string> = {
  aditivo: "Aditivo",
  reajuste: "Reajuste",
  encerramento: "Encerramento",
  renovacao: "Renovação",
};

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dataBR(iso: string) {
  return iso.slice(0, 10).split("-").reverse().join("/");
}

type Aba = "reajuste" | "aditivo" | "encerrar" | null;

export function ContratoImovelAcoes({
  contratoId,
  vigente,
  aluguelAtual,
  historico,
  podeEditar,
}: {
  contratoId: string;
  vigente: boolean;
  aluguelAtual: number;
  historico: HistoricoItem[];
  podeEditar: boolean;
}) {
  const [aba, setAba] = useState<Aba>(null);

  return (
    <div className="mt-3 border-t pt-3">
      {podeEditar ? (
        <div className="flex flex-wrap gap-1">
          <Button
            variant={aba === "reajuste" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAba(aba === "reajuste" ? null : "reajuste")}
          >
            <TrendingUp className="size-4" /> Reajuste
          </Button>
          <Button
            variant={aba === "aditivo" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setAba(aba === "aditivo" ? null : "aditivo")}
          >
            <FilePlus2 className="size-4" /> Aditivo
          </Button>
          {vigente ? (
            <Button
              variant={aba === "encerrar" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setAba(aba === "encerrar" ? null : "encerrar")}
            >
              <CircleSlash className="size-4" /> Encerrar
            </Button>
          ) : null}
        </div>
      ) : null}

      {aba === "reajuste" ? (
        <ReajusteForm contratoId={contratoId} />
      ) : aba === "aditivo" ? (
        <AditivoForm contratoId={contratoId} aluguelAtual={aluguelAtual} />
      ) : aba === "encerrar" ? (
        <EncerrarForm contratoId={contratoId} />
      ) : null}

      {historico.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <History className="size-3.5" /> Histórico do contrato
          </p>
          <ol className="space-y-1">
            {historico.map((h) => (
              <li key={h.id} className="flex gap-2 text-sm">
                <span className="shrink-0 tabular-nums text-muted-foreground">{dataBR(h.data_efeito)}</span>
                <span className="shrink-0 font-medium">{TIPO_LABEL[h.tipo] ?? h.tipo}:</span>
                <span className="text-muted-foreground">{h.descricao}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function Erro({ state }: { state: ImovelFormState }) {
  return state.error ? <p className="text-sm text-destructive">{state.error}</p> : null;
}

function ReajusteForm({ contratoId }: { contratoId: string }) {
  const [state, action, pending] = useActionState<ImovelFormState, FormData>(aplicarReajuste, {});
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="contrato_id" value={contratoId} />
      <div className="space-y-1">
        <Label htmlFor={`pct-${contratoId}`}>Percentual (%)</Label>
        <Input id={`pct-${contratoId}`} name="percentual" type="number" step="0.01" min="0.01" required placeholder="Ex.: 4.5" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`de-${contratoId}`}>Data de efeito</Label>
        <Input id={`de-${contratoId}`} name="data_efeito" type="date" required defaultValue={hojeISO()} />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Aplicando…" : "Aplicar"}</Button>
      </div>
      <div className="sm:col-span-3"><Erro state={state} /></div>
    </form>
  );
}

function AditivoForm({ contratoId, aluguelAtual }: { contratoId: string; aluguelAtual: number }) {
  const [state, action, pending] = useActionState<ImovelFormState, FormData>(registrarAditivo, {});
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2">
      <input type="hidden" name="contrato_id" value={contratoId} />
      <div className="space-y-1">
        <Label htmlFor={`na-${contratoId}`}>Novo aluguel (R$)</Label>
        <Input id={`na-${contratoId}`} name="novo_aluguel" type="number" step="0.01" min="0" placeholder={String(aluguelAtual)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ndf-${contratoId}`}>Novo prazo (fim)</Label>
        <Input id={`ndf-${contratoId}`} name="nova_data_fim" type="date" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`ade-${contratoId}`}>Data de efeito</Label>
        <Input id={`ade-${contratoId}`} name="data_efeito" type="date" required defaultValue={hojeISO()} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`amo-${contratoId}`}>Motivo (opcional)</Label>
        <Input id={`amo-${contratoId}`} name="motivo" maxLength={200} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Registrando…" : "Registrar aditivo"}</Button>
        <Erro state={state} />
      </div>
    </form>
  );
}

function EncerrarForm({ contratoId }: { contratoId: string }) {
  const [state, action, pending] = useActionState<ImovelFormState, FormData>(encerrarContrato, {});
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1fr_auto]">
      <input type="hidden" name="contrato_id" value={contratoId} />
      <div className="space-y-1">
        <Label htmlFor={`ed-${contratoId}`}>Data de encerramento</Label>
        <Input id={`ed-${contratoId}`} name="data_encerramento" type="date" required defaultValue={hojeISO()} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`emo-${contratoId}`}>Motivo (opcional)</Label>
        <Input id={`emo-${contratoId}`} name="motivo" maxLength={200} />
      </div>
      <div className="flex items-end">
        <Button type="submit" size="sm" variant="destructive" disabled={pending}>{pending ? "Encerrando…" : "Encerrar"}</Button>
      </div>
      <div className="sm:col-span-3"><Erro state={state} /></div>
    </form>
  );
}
