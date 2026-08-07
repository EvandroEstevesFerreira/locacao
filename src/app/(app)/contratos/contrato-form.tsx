"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  CADENCIA,
  CADENCIAS,
  STATUS_CONTRATO,
  STATUS_CONTRATOS,
  contratoSchema,
  type Cadencia,
  type ContratoDados,
  type ContratoInput,
  type StatusContrato,
} from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarContrato } from "./actions";

type Contrato = {
  id: string;
  obra_id: string;
  fornecedor_id: string;
  numero: string;
  cadencia: Cadencia;
  data_inicio: string;
  data_fim_prevista: string | null;
  status: StatusContrato;
  observacoes: string | null;
  cobranca_prorata?: boolean;
};

export function ContratoForm({
  contrato,
  obras,
  fornecedores,
  numeroSugerido,
}: {
  contrato?: Contrato;
  obras: { id: string; codigo: string; nome: string }[];
  fornecedores: { id: string; nome: string }[];
  numeroSugerido?: string;
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContratoInput, unknown, ContratoDados>({
    resolver: zodResolver(contratoSchema),
    defaultValues: {
      id: contrato?.id,
      obra_id: contrato?.obra_id ?? "",
      fornecedor_id: contrato?.fornecedor_id ?? "",
      numero: contrato?.numero ?? numeroSugerido ?? "",
      cadencia: contrato?.cadencia ?? "mensal",
      data_inicio: contrato?.data_inicio ?? "",
      data_fim_prevista: contrato?.data_fim_prevista ?? "",
      status: contrato?.status ?? "ativo",
      observacoes: contrato?.observacoes ?? "",
      cobranca_prorata: contrato?.cobranca_prorata ?? false,
    },
  });

  function onSubmit(values: ContratoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarContrato(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(contrato ? "Contrato atualizado." : "Contrato cadastrado.");
      // Vai para o detalhe, que é onde se adicionam os itens locados.
      router.replace(r.id ? `/contratos/${r.id}` : "/contratos");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
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
          <Label htmlFor="fornecedor_id">Fornecedor</Label>
          <NativeSelect
            id="fornecedor_id"
            disabled={pendente}
            {...register("fornecedor_id")}
          >
            <option value="">Selecione…</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </NativeSelect>
          {errors.fornecedor_id ? (
            <p className="text-xs text-destructive">
              {errors.fornecedor_id.message}
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="numero">Número do contrato</Label>
          <Input
            id="numero"
            placeholder="Ex.: CT-2026-001"
            aria-invalid={!!errors.numero}
            disabled={pendente}
            {...register("numero")}
          />
          {errors.numero ? (
            <p className="text-xs text-destructive">{errors.numero.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cadencia">Cadência de cobrança</Label>
          <NativeSelect id="cadencia" disabled={pendente} {...register("cadencia")}>
            {CADENCIAS.map((c) => (
              <option key={c} value={c}>
                {CADENCIA[c].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio">Início</Label>
          <Input
            id="data_inicio"
            type="date"
            aria-invalid={!!errors.data_inicio}
            disabled={pendente}
            {...register("data_inicio")}
          />
          {errors.data_inicio ? (
            <p className="text-xs text-destructive">{errors.data_inicio.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_fim_prevista">
            Fim previsto{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="data_fim_prevista"
            type="date"
            aria-invalid={!!errors.data_fim_prevista}
            disabled={pendente}
            {...register("data_fim_prevista")}
          />
          {/* Regra cruzada: antes um contrato podia ser salvo terminando antes de
              começar, e o problema só aparecia no cálculo de custo. */}
          {errors.data_fim_prevista ? (
            <p className="text-xs text-destructive">
              {errors.data_fim_prevista.message}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" disabled={pendente} {...register("status")}>
            {STATUS_CONTRATOS.map((s) => (
              <option key={s} value={s}>
                {STATUS_CONTRATO[s].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
        <input
          type="checkbox"
          disabled={pendente}
          className="mt-0.5 size-4"
          {...register("cobranca_prorata")}
        />
        <span>
          <span className="font-medium">Cobrança pró-rata</span>
          <span className="block text-xs text-muted-foreground">
            Cobra períodos proporcionais aos dias usados, em vez de período cheio
            (ex.: meia semana = metade do valor).
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="observacoes"
          rows={3}
          disabled={pendente}
          {...register("observacoes")}
        />
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          render={<Link href="/contratos" />}
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
