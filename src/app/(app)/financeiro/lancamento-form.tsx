"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  lancamentoSchema,
  type LancamentoDados,
  type LancamentoInput,
  type StatusLancamento,
} from "@/lib/financeiro";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarLancamento } from "./actions";

type Lancamento = {
  id: string;
  obra_id: string;
  contrato_id: string | null;
  descricao: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: StatusLancamento;
};

export function LancamentoForm({
  lancamento,
  obras,
  contratos,
}: {
  lancamento?: Lancamento;
  obras: { id: string; codigo: string; nome: string }[];
  contratos: { id: string; numero: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LancamentoInput, unknown, LancamentoDados>({
    resolver: zodResolver(lancamentoSchema),
    defaultValues: {
      id: lancamento?.id,
      obra_id: lancamento?.obra_id ?? "",
      contrato_id: lancamento?.contrato_id ?? "",
      descricao: lancamento?.descricao ?? "",
      // O input `type="month"` só aceita AAAA-MM; o banco guarda o primeiro dia.
      competencia: lancamento?.competencia?.slice(0, 7) ?? "",
      valor: lancamento?.valor ?? "",
      vencimento: lancamento?.vencimento ?? "",
      status: lancamento?.status ?? "pendente",
      data_pagamento: "",
    },
  });

  function onSubmit(values: LancamentoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarLancamento(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(lancamento ? "Lançamento atualizado." : "Lançamento criado.");
      router.replace("/financeiro");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="obra_id">Obra</Label>
          <NativeSelect id="obra_id" disabled={pendente} {...register("obra_id")}>
            <option value="">Selecione…</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </NativeSelect>
          {errors.obra_id ? (
            <p className="text-xs text-destructive">{errors.obra_id.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contrato_id">
            Contrato{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <NativeSelect
            id="contrato_id"
            disabled={pendente}
            {...register("contrato_id")}
          >
            <option value="">—</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.numero}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          placeholder="Ex.: Locação betoneira — julho"
          aria-invalid={!!errors.descricao}
          disabled={pendente}
          {...register("descricao")}
        />
        {errors.descricao ? (
          <p className="text-xs text-destructive">{errors.descricao.message}</p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="competencia">Competência</Label>
          <Input
            id="competencia"
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
          <Label htmlFor="valor">Valor (R$)</Label>
          <Input
            id="valor"
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
          <Label htmlFor="vencimento">Vencimento</Label>
          <Input
            id="vencimento"
            type="date"
            aria-invalid={!!errors.vencimento}
            disabled={pendente}
            {...register("vencimento")}
          />
          {/* Regra cruzada: vencimento antes do mês de competência é erro de
              digitação, e antes passava — reaparecendo como "vencido" num mês
              que nem começou. */}
          {errors.vencimento ? (
            <p className="text-xs text-destructive">{errors.vencimento.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Status</Label>
        <NativeSelect
          id="status"
          className="max-w-48"
          disabled={pendente}
          {...register("status")}
        >
          <option value="pendente">Pendente</option>
          <option value="pago">Pago</option>
        </NativeSelect>
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          render={<Link href="/financeiro" />}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
