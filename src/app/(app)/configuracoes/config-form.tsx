"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { salvarConfigAlerta, type ConfigFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConfigAlertaForm({
  config,
}: {
  config: {
    ativo: boolean;
    dias_alerta: number[];
    destinatarios: string[];
  };
}) {
  const [state, formAction, isPending] = useActionState<ConfigFormState, FormData>(
    salvarConfigAlerta,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Configurações salvas.");
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
        Enviar avisos automáticos de vencimento por e-mail
      </label>

      <div className="space-y-2">
        <Label htmlFor="dias_alerta">Prazos de aviso (dias antes)</Label>
        <Input
          id="dias_alerta"
          name="dias_alerta"
          type="text"
          inputMode="numeric"
          defaultValue={(config.dias_alerta ?? [3]).join(", ")}
          placeholder="ex.: 30, 15, 3"
          className="max-w-48"
        />
        <p className="text-xs text-muted-foreground">
          Um ou mais prazos, separados por vírgula. É enviado um aviso ao
          atingir cada marco (ex.: 30, 15 e 3 dias antes do vencimento).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destinatarios">Destinatários</Label>
        <Textarea
          id="destinatarios"
          name="destinatarios"
          rows={4}
          defaultValue={(config.destinatarios ?? []).join("\n")}
          placeholder={"um e-mail por linha\nex.: financeiro@sistenge.com"}
        />
        <p className="text-xs text-muted-foreground">
          Um e-mail por linha (ou separados por vírgula).
        </p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar configurações"}
      </Button>
    </form>
  );
}
