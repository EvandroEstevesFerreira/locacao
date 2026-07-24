"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import {
  salvarConfigRelatorioEmail,
  type ConfigFormState,
} from "./actions";
import { TIPOS_RELATORIO } from "@/lib/relatorios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none";

export function ConfigRelatorioForm({
  config,
}: {
  config: {
    ativo: boolean;
    tipo: string;
    frequencia: string;
    dia: number;
    destinatarios: string[];
  };
}) {
  const [state, formAction, isPending] = useActionState<ConfigFormState, FormData>(
    salvarConfigRelatorioEmail,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Envio de relatório salvo.");
  }, [state.ok]);

  return (
    <form action={formAction} className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={config.ativo}
          className="size-4"
        />
        Enviar um relatório automaticamente por e-mail
      </label>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tipo">Relatório</Label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={config.tipo}
            className={selectClasses}
          >
            {TIPOS_RELATORIO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="frequencia">Frequência</Label>
          <select
            id="frequencia"
            name="frequencia"
            defaultValue={config.frequencia}
            className={selectClasses}
          >
            <option value="semanal">Semanal</option>
            <option value="mensal">Mensal</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="dia">Dia</Label>
          <Input
            id="dia"
            name="dia"
            type="number"
            min={1}
            max={28}
            defaultValue={config.dia}
            className="max-w-24"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        <strong>Semanal:</strong> dia 1 a 7 (1 = segunda-feira).{" "}
        <strong>Mensal:</strong> dia 1 a 28 do mês.
      </p>

      <div className="space-y-2">
        <Label htmlFor="destinatarios_rel">Destinatários</Label>
        <Textarea
          id="destinatarios_rel"
          name="destinatarios"
          rows={4}
          defaultValue={(config.destinatarios ?? []).join("\n")}
          placeholder={"um e-mail por linha\nex.: gestao@sistenge.com"}
        />
        <p className="text-xs text-muted-foreground">
          Um e-mail por linha (ou separados por vírgula). O PDF vai anexado.
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar envio de relatório"}
      </Button>
    </form>
  );
}
