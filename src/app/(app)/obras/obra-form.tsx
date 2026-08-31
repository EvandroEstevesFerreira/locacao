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
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  destinatarios_alerta: string[] | null;
};

export function ObraForm({
  obra,
  vinculados = [],
}: {
  obra?: Obra;
  /** E-mails que já recebem por estarem vinculados à obra. Só para exibir. */
  vinculados?: string[];
}) {
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
      destinatarios_alerta: (obra?.destinatarios_alerta ?? []).join("\n"),
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
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      {/* Num cadastro novo este input manda `""`, e o schema TEM de aceitar —
          ver `idOpcional` em @/lib/campos. */}
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

      <div className="space-y-1.5">
        <Label htmlFor="destinatarios_alerta">
          E-mails extras para avisos{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="destinatarios_alerta"
          rows={3}
          disabled={pendente}
          placeholder={"mestre.obra@terceirizada.com.br\nalmoxarifado@obra.com.br"}
          aria-invalid={!!errors.destinatarios_alerta}
          {...register("destinatarios_alerta")}
        />
        {errors.destinatarios_alerta ? (
          <p className="text-xs text-destructive">
            {errors.destinatarios_alerta.message}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Um por linha. Use apenas para quem <strong>não tem login</strong> no
          Loca — quem está vinculado à obra já recebe automaticamente.
        </p>
        {/* Mostrar quem já é coberto evita o erro mais provável: digitar de
            novo endereços que o vínculo com a obra já entrega. */}
        {vinculados.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Já recebem por estarem vinculados a esta obra:{" "}
            <span className="text-foreground">{vinculados.join(", ")}</span>.
          </p>
        ) : obra ? (
          <p className="text-xs text-muted-foreground">
            Nenhum usuário está vinculado a esta obra. Sem e-mails extras, os
            avisos dela vão só para a lista central.
          </p>
        ) : null}
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
