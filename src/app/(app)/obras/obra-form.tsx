"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_OBRA,
  STATUS_OBRA_INFO,
  obraSchema,
  type ObraDados,
  type ObraInput,
  type StatusObra,
} from "@/lib/obra";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarObra } from "./actions";

type Obra = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  responsavel: string | null;
  centro_custo: string | null;
  status: StatusObra;
};

export function ObraForm({ obra }: { obra?: Obra }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
    // Três parâmetros de tipo porque o schema TRANSFORMA: os campos opcionais
    // viram `null` na saída (ver textoOpcional em src/lib/obra.ts). Entrada é o
    // que o formulário guarda, saída é o que a action recebe — sem os três, o
    // TypeScript reclama que os Resolver são "dois tipos diferentes com o mesmo
    // nome".
  } = useForm<ObraInput, unknown, ObraDados>({
    resolver: zodResolver(obraSchema),
    defaultValues: {
      id: obra?.id,
      codigo: obra?.codigo ?? "",
      nome: obra?.nome ?? "",
      endereco: obra?.endereco ?? "",
      responsavel: obra?.responsavel ?? "",
      centro_custo: obra?.centro_custo ?? "",
      status: obra?.status ?? "ativa",
    },
  });

  function onSubmit(values: ObraDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarObra(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(obra ? "Obra atualizada." : "Obra cadastrada.");
      router.replace("/obras");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* `id` é campo do schema, não mais um <input hidden>. */}
      <input type="hidden" {...register("id")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          {/* Sem o "*": quem diz que o campo falta é o zod, com a mensagem
              embaixo do próprio campo — é a razão de existir da migração. */}
          <Label htmlFor="codigo">Código</Label>
          <Input
            id="codigo"
            placeholder="Ex.: OB-001"
            aria-invalid={!!errors.codigo}
            disabled={pendente}
            {...register("codigo")}
          />
          {errors.codigo ? (
            <p className="text-xs text-destructive">{errors.codigo.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" disabled={pendente} {...register("status")}>
            {STATUS_OBRA.map((s) => (
              <option key={s} value={s}>
                {STATUS_OBRA_INFO[s].label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          placeholder="Ex.: Edifício Aurora"
          aria-invalid={!!errors.nome}
          disabled={pendente}
          {...register("nome")}
        />
        {errors.nome ? (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="endereco">
          Endereço{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input id="endereco" disabled={pendente} {...register("endereco")} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="responsavel">
            Responsável{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="responsavel" disabled={pendente} {...register("responsavel")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="centro_custo">
            Centro de custo{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="centro_custo"
            disabled={pendente}
            {...register("centro_custo")}
          />
        </div>
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" render={<Link href="/obras" />}>
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
