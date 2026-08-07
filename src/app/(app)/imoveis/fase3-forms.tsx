"use client";

// `ReparoForm` está em react-hook-form: tem 4 campos, um deles é dinheiro, e o
// zod passou a rejeitar valor inválido em vez de virar zero em silêncio.
// `OcorrenciaForm` e `VistoriaImovelForm` ficam em `useActionState` de propósito
// — três campos sem validação cruzada não pagam o custo da migração.

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  reparoSchema,
  type ReparoDados,
  type ReparoInput,
} from "@/lib/imoveis";
import {
  salvarReparo,
  salvarOcorrencia,
  salvarVistoriaImovel,
  type ImovelFormState,
} from "./actions";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";


export function ReparoForm({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const vazio: ReparoInput = {
    imovel_id: imovelId,
    data: "",
    descricao: "",
    valor: "",
    executor: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReparoInput, unknown, ReparoDados>({
    resolver: zodResolver(reparoSchema),
    defaultValues: vazio,
  });

  function onSubmit(values: ReparoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarReparo(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Reparo registrado.");
      // Form embutido na própria tela: limpa e recarrega a rota. O
      // `router.refresh()` é essencial — a action antes fazia `redirect()` para a
      // MESMA URL só para provocar o re-render, e sem ele o reparo criado não
      // apareceria.
      reset(vazio);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="r_data">Data</Label>
          <Input
            id="r_data"
            type="date"
            aria-invalid={!!errors.data}
            disabled={pendente}
            {...register("data")}
          />
          {errors.data ? (
            <p className="text-xs text-destructive">{errors.data.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="r_desc">Descrição</Label>
          <Input
            id="r_desc"
            placeholder="O que foi reparado"
            aria-invalid={!!errors.descricao}
            disabled={pendente}
            {...register("descricao")}
          />
          {errors.descricao ? (
            <p className="text-xs text-destructive">{errors.descricao.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="r_valor">
            Valor (R$){" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="r_valor"
            type="number"
            step="0.01"
            min="0"
            aria-invalid={!!errors.valor}
            disabled={pendente}
            {...register("valor")}
          />
          {errors.valor ? (
            <p className="text-xs text-destructive">{errors.valor.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="r_exec">
            Executado por{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="r_exec"
            placeholder="Nome do prestador/empresa"
            disabled={pendente}
            {...register("executor")}
          />
        </div>
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
        {pendente ? "Salvando…" : "Adicionar reparo"}
      </Button>
    </form>
  );
}

export function OcorrenciaForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarOcorrencia, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="o_data">Data</Label>
          <Input id="o_data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="o_tipo">Tipo</Label>
          <NativeSelect id="o_tipo" name="tipo" defaultValue="outro">
            <option value="avaria">Avaria</option>
            <option value="reparo">Reparo</option>
            <option value="desentendimento">Desentendimento</option>
            <option value="outro">Outro</option>
          </NativeSelect>
        </div>
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="o_desc">Descrição</Label>
          <Input id="o_desc" name="descricao" required />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Registrar ocorrência"}</Button>
    </form>
  );
}

export function VistoriaImovelForm({ imovelId }: { imovelId: string }) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(salvarVistoriaImovel, {});
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="imovel_id" value={imovelId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="v_data">Data</Label>
          <Input id="v_data" name="data" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="v_resp">Responsável</Label>
          <Input id="v_resp" name="responsavel" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="v_obs">Observações</Label>
        <Textarea id="v_obs" name="observacoes" rows={2} />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>{isPending ? "Salvando…" : "Adicionar vistoria"}</Button>
    </form>
  );
}
