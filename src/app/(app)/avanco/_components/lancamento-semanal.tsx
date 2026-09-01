"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ObraAvanco } from "@/lib/data/avanco";
import { percentualPrazo, desvio } from "@/lib/avanco";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarAvancos } from "../actions";

type Linha = { percentual: string; observacoes: string };
type Form = { linhas: Linha[] };

/** Pontos de atraso desta obra, ou null quando falta período ou avanço. */
function atraso(obra: ObraAvanco, hojeISO: string, percentual: string): number | null {
  const fisico = percentual.trim() === "" ? obra.semanaAnterior : Number(percentual);
  if (fisico === null || Number.isNaN(fisico)) return null;
  return desvio(percentualPrazo(obra, hojeISO), fisico);
}

export function LancamentoSemanal({
  obras,
  semana,
  hojeISO,
}: {
  obras: ObraAvanco[];
  /** Segunda-feira da semana, já canonizada no servidor. */
  semana: string;
  hojeISO: string;
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const { register, handleSubmit, control } = useForm<Form>({
    defaultValues: {
      linhas: obras.map((o) => ({
        percentual: o.semanaAtual === null ? "" : String(o.semanaAtual),
        observacoes: "",
      })),
    },
  });

  // `useWatch` e não `watch()`: o segundo não memoiza com segurança e o lint
  // do projeto reprova. Mesmo padrão do formulário de itens.
  const linhas = useWatch({ control, name: "linhas" });

  function onSubmit(valores: Form) {
    setErroServidor(null);

    // Linha em branco é DESCARTADA, não vira lançamento zero. Sem isso, abrir a
    // tela e salvar registraria "0% de avanço" em toda obra não preenchida — e,
    // como o avanço é acumulado, isso apagaria o progresso real dela.
    const preenchidas = valores.linhas
      .map((l, i) => ({ ...l, obra: obras[i] }))
      .filter((l) => l.percentual.trim() !== "")
      .map((l) => ({
        obra_id: l.obra.id,
        semana,
        percentual: l.percentual,
        observacoes: l.observacoes,
      }));

    if (preenchidas.length === 0) {
      setErroServidor("Informe o avanço de ao menos uma obra.");
      return;
    }

    startTransition(async () => {
      const r = await salvarAvancos({ linhas: preenchidas });
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(
        preenchidas.length === 1
          ? "Avanço lançado."
          : `${preenchidas.length} avanços lançados.`,
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-4"
    >
      <div className="divide-y rounded-md border">
        {obras.map((o, i) => {
          const pontos = atraso(o, hojeISO, linhas?.[i]?.percentual ?? "");
          return (
            <div
              key={o.id}
              className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_8rem_6rem_minmax(0,1fr)]"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {o.codigo} · {o.nome}
                </p>
                {o.semanaAtual === null ? (
                  <p className="text-xs text-destructive">Sem lançamento nesta semana</p>
                ) : pontos === null ? (
                  <p className="text-xs text-muted-foreground">Período não informado</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {pontos > 0
                      ? `${pontos.toFixed(0)} pontos de atraso`
                      : pontos < 0
                        ? `${Math.abs(pontos).toFixed(0)} pontos adiantada`
                        : "No prazo"}
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Anterior: {o.semanaAnterior === null ? "—" : `${o.semanaAnterior}%`}
              </p>

              <Input
                type="number"
                min={0}
                max={100}
                step="0.01"
                inputMode="decimal"
                placeholder="%"
                aria-label={`Avanço de ${o.codigo}`}
                disabled={pendente}
                {...register(`linhas.${i}.percentual`)}
              />

              <Input
                placeholder="Observação (opcional)"
                aria-label={`Observação de ${o.codigo}`}
                disabled={pendente}
                {...register(`linhas.${i}.observacoes`)}
              />
            </div>
          );
        })}
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar avanços"}
        </Button>
      </div>
    </form>
  );
}
