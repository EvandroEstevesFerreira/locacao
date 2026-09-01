"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_CONSUMO,
  TIPO_CONSUMO_INFO,
  contaConsumoSchema,
  type ContaConsumoDados,
  type ContaConsumoInput,
} from "@/lib/imoveis";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarContaConsumo } from "./actions";

export function ContaConsumoForm({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContaConsumoInput, unknown, ContaConsumoDados>({
    resolver: zodResolver(contaConsumoSchema),
    defaultValues: {
      imovel_id: imovelId,
      tipo: "luz",
      competencia: "",
      valor: "",
      vencimento: "",
      pago: false,
      lancar: true,
      observacoes: "",
    },
  });

  function onSubmit(values: ContaConsumoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarContaConsumo(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Conta de consumo adicionada.");
      // Formulário embutido na própria tela: limpa para o próximo lançamento e
      // recarrega a rota. `router.refresh()` é essencial — antes a action fazia
      // `redirect()` para a MESMA URL só para provocar o re-render, e sem ele a
      // conta criada simplesmente não apareceria.
      reset({
        imovel_id: imovelId,
        tipo: "luz",
        competencia: "",
        valor: "",
        vencimento: "",
        pago: false,
        lancar: true,
        observacoes: "",
      });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="tipo_c">Tipo</Label>
          <NativeSelect id="tipo_c" disabled={pendente} {...register("tipo")}>
            {TIPOS_CONSUMO.map((t) => (
              <option key={t} value={t}>
                {TIPO_CONSUMO_INFO[t]}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="competencia_c">Competência (mês)</Label>
          <Input
            id="competencia_c"
            type="month"
            aria-invalid={!!errors.competencia}
            disabled={pendente}
            {...register("competencia")}
          />
          {errors.competencia ? (
            <p className="text-xs text-destructive">{errors.competencia.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="valor_c">Valor (R$)</Label>
          <Input
            id="valor_c"
            type="number"
            step="0.01"
            min="0.01"
            aria-invalid={!!errors.valor}
            disabled={pendente}
            {...register("valor")}
          />
          {errors.valor ? (
            <p className="text-xs text-destructive">{errors.valor.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="vencimento_c">
            Vencimento{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="vencimento_c"
            type="date"
            aria-invalid={!!errors.vencimento}
            disabled={pendente}
            {...register("vencimento")}
          />
          {errors.vencimento ? (
            <p className="text-xs text-destructive">{errors.vencimento.message}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            disabled={pendente}
            {...register("pago")}
          />
          Já pago
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            disabled={pendente}
            {...register("lancar")}
          />
          Lançar no financeiro (requer obra vinculada)
        </label>
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
        {pendente ? "Salvando…" : "Adicionar conta"}
      </Button>
    </form>
  );
}
