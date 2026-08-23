"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  FREQUENCIAS_RELATORIO,
  configRelatorioSchema,
  diaMaximo,
  type ConfigRelatorioDados,
  type ConfigRelatorioInput,
  type FrequenciaRelatorio,
} from "@/lib/config";
import { TIPOS_RELATORIO } from "@/lib/relatorios";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarConfigRelatorioEmail } from "./actions";

const LABEL_FREQUENCIA: Record<FrequenciaRelatorio, string> = {
  semanal: "Semanal",
  mensal: "Mensal",
};

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
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ConfigRelatorioInput, unknown, ConfigRelatorioDados>({
    resolver: zodResolver(configRelatorioSchema),
    defaultValues: {
      ativo: config.ativo,
      tipo: config.tipo,
      frequencia: (config.frequencia as FrequenciaRelatorio) ?? "mensal",
      dia: config.dia,
      // O schema recebe o texto cru e faz a divisão — é ele que sabe aceitar
      // linha, vírgula ou ponto e vírgula.
      destinatarios: (config.destinatarios ?? []).join("\n"),
    },
  });

  const frequencia = useWatch({ control, name: "frequencia" });
  const max = diaMaximo((frequencia as FrequenciaRelatorio) ?? "mensal");

  function onSubmit(values: ConfigRelatorioDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarConfigRelatorioEmail(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Envio de relatório salvo.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          disabled={pendente}
          {...register("ativo")}
        />
        Enviar um relatório automaticamente por e-mail
      </label>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="tipo">Relatório</Label>
          <NativeSelect
            className="w-auto"
            id="tipo"
            disabled={pendente}
            {...register("tipo")}
          >
            {TIPOS_RELATORIO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="frequencia">Frequência</Label>
          <NativeSelect
            className="w-auto"
            id="frequencia"
            disabled={pendente}
            {...register("frequencia")}
          >
            {FREQUENCIAS_RELATORIO.map((f) => (
              <option key={f} value={f}>
                {LABEL_FREQUENCIA[f]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="dia">Dia</Label>
          {/* `max` acompanha a frequência escolhida. Antes era fixo em 28, e um
              relatório semanal marcado para o dia 20 era aceito e nunca
              disparava. */}
          <Input
            id="dia"
            type="number"
            min={1}
            max={max}
            className="max-w-24"
            aria-invalid={!!errors.dia}
            disabled={pendente}
            {...register("dia")}
          />
        </div>
      </div>

      {errors.dia ? (
        <p className="text-xs text-destructive">{errors.dia.message}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          <strong>Semanal:</strong> dia 1 a 7 (1 = segunda-feira).{" "}
          <strong>Mensal:</strong> dia 1 a 28 do mês (para existir em todos).
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="destinatarios_rel">Destinatários</Label>
        <Textarea
          id="destinatarios_rel"
          rows={4}
          placeholder={"um e-mail por linha\nex.: gestao@sistenge.com"}
          aria-invalid={!!errors.destinatarios}
          disabled={pendente}
          {...register("destinatarios")}
        />
        {errors.destinatarios ? (
          <p className="text-xs text-destructive">{errors.destinatarios.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Um e-mail por linha (ou separados por vírgula). O PDF vai anexado.
          </p>
        )}
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
        {pendente ? "Salvando…" : "Salvar envio de relatório"}
      </Button>
    </form>
  );
}
