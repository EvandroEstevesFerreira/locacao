"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  dataDeISO,
  formatarBRL,
  itemLocadoSchema,
  periodosEntre,
  type Cadencia,
  type ItemLocadoDados,
  type ItemLocadoInput,
} from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { adicionarItemLocado } from "./actions";

const VAZIO: ItemLocadoInput = {
  contrato_id: "",
  item_id: "",
  quantidade: "1",
  valor_unitario_periodo: "0",
  data_retirada: "",
  data_devolucao_prevista: "",
  identificacao: "",
};

export function AddItemLocadoForm({
  contratoId,
  itens,
  cadencia,
  prorata = false,
}: {
  contratoId: string;
  itens: { id: string; descricao: string; unidade: string | null }[];
  /** Cadência do contrato — usada para estimar o custo antes de salvar. */
  cadencia?: Cadencia;
  prorata?: boolean;
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ItemLocadoInput, unknown, ItemLocadoDados>({
    resolver: zodResolver(itemLocadoSchema),
    defaultValues: { ...VAZIO, contrato_id: contratoId },
  });

  const [quantidade, valorUnit, retirada, devolucao] = useWatch({
    control,
    name: [
      "quantidade",
      "valor_unitario_periodo",
      "data_retirada",
      "data_devolucao_prevista",
    ],
  });

  // Custo estimado, calculado com as MESMAS funções puras que o detalhe do
  // contrato usa (e que têm teste em locacao.test.ts). Antes o usuário só
  // descobria o valor depois de salvar.
  const numero = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0;
  let estimativa: { periodos: number; total: number } | null = null;
  if (cadencia && retirada && devolucao && devolucao >= retirada) {
    const periodos = periodosEntre(
      cadencia,
      dataDeISO(String(retirada)),
      dataDeISO(String(devolucao)),
      prorata,
    );
    estimativa = {
      periodos,
      total: periodos * numero(quantidade) * numero(valorUnit),
    };
  }

  function onSubmit(values: ItemLocadoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await adicionarItemLocado(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Item adicionado ao contrato.");
      // Formulário embutido: limpa para o próximo item e recarrega a rota.
      reset({ ...VAZIO, contrato_id: contratoId });
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <input type="hidden" {...register("contrato_id")} />

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="item_id">Item</Label>
          <NativeSelect id="item_id" disabled={pendente} {...register("item_id")}>
            <option value="">Selecione o item…</option>
            {itens.map((i) => (
              <option key={i.id} value={i.id}>
                {i.descricao}
                {i.unidade ? ` (${i.unidade})` : ""}
              </option>
            ))}
          </NativeSelect>
          {errors.item_id ? (
            <p className="text-xs text-destructive">{errors.item_id.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quantidade">Quantidade</Label>
          <Input
            id="quantidade"
            type="number"
            step="0.01"
            min="0.01"
            aria-invalid={!!errors.quantidade}
            disabled={pendente}
            {...register("quantidade")}
          />
          {errors.quantidade ? (
            <p className="text-xs text-destructive">{errors.quantidade.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="valor_unitario_periodo">Valor unit. / período</Label>
          <Input
            id="valor_unitario_periodo"
            type="number"
            step="0.01"
            min="0"
            aria-invalid={!!errors.valor_unitario_periodo}
            disabled={pendente}
            {...register("valor_unitario_periodo")}
          />
          {errors.valor_unitario_periodo ? (
            <p className="text-xs text-destructive">
              {errors.valor_unitario_periodo.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_retirada">Retirada</Label>
          <Input
            id="data_retirada"
            type="date"
            aria-invalid={!!errors.data_retirada}
            disabled={pendente}
            {...register("data_retirada")}
          />
          {errors.data_retirada ? (
            <p className="text-xs text-destructive">{errors.data_retirada.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_devolucao_prevista">
            Devolução prevista{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="data_devolucao_prevista"
            type="date"
            aria-invalid={!!errors.data_devolucao_prevista}
            disabled={pendente}
            {...register("data_devolucao_prevista")}
          />
          {errors.data_devolucao_prevista ? (
            <p className="text-xs text-destructive">
              {errors.data_devolucao_prevista.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="identificacao">
            Nº de série / registro / tag{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="identificacao"
            placeholder="Identificação do equipamento"
            disabled={pendente}
            {...register("identificacao")}
          />
        </div>
      </div>

      {estimativa ? (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          Custo estimado até a devolução prevista:{" "}
          <strong className="tabular-nums">{formatarBRL(estimativa.total)}</strong>{" "}
          <span className="text-muted-foreground">
            ({estimativa.periodos.toFixed(prorata ? 2 : 0)}{" "}
            {estimativa.periodos === 1 ? "período" : "períodos"}
            {prorata ? ", pró-rata" : ""})
          </span>
        </div>
      ) : null}

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        {pendente ? "Adicionando…" : "Adicionar item"}
      </Button>
    </form>
  );
}
