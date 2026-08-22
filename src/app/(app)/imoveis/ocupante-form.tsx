"use client";

// `OcupanteForm` está em react-hook-form: são 8 campos e há validação cruzada
// (a saída não pode ser anterior à entrada). Cruza o limiar do AGENTS.md, igual
// ao ReparoForm. Antes eram 5 campos em useActionState, que era suficiente.
//
// Função, quarto e armário entraram porque alimentam o bloco de identificação
// do FRM-RH-001 — sem eles o termo sai com três linhas em branco a mais.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ocupanteSchema,
  type OcupanteDados,
  type OcupanteInput,
} from "@/lib/imoveis";
import { salvarOcupante } from "./actions";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OcupanteForm({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const vazio: OcupanteInput = {
    imovel_id: imovelId,
    nome: "",
    cpf: "",
    contato: "",
    cargo: "",
    quarto: "",
    armario: "",
    data_entrada: "",
    data_saida: "",
    observacoes: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OcupanteInput, unknown, OcupanteDados>({
    resolver: zodResolver(ocupanteSchema),
    defaultValues: vazio,
  });

  function onSubmit(values: OcupanteDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarOcupante(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Ocupante cadastrado.");
      // Form embutido na própria tela: limpa e recarrega a rota. A action não
      // redireciona, então o refresh é o que traz o ocupante novo para a lista.
      reset(vazio);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="oc_nome">Nome</Label>
          <Input
            id="oc_nome"
            aria-invalid={!!errors.nome}
            disabled={pendente}
            {...register("nome")}
          />
          {errors.nome ? (
            <p className="text-xs text-destructive">{errors.nome.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_cpf">CPF</Label>
          <Input id="oc_cpf" disabled={pendente} {...register("cpf")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_contato">Contato</Label>
          <Input id="oc_contato" disabled={pendente} {...register("contato")} />
        </div>

        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="oc_cargo">
            Função / Cargo{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="oc_cargo" disabled={pendente} {...register("cargo")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_quarto">
            Nº do quarto{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="oc_quarto" disabled={pendente} {...register("quarto")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_armario">
            Nº do armário{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="oc_armario" disabled={pendente} {...register("armario")} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_entrada">Entrada</Label>
          <Input
            id="oc_entrada"
            type="date"
            disabled={pendente}
            {...register("data_entrada")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oc_saida">Saída</Label>
          <Input
            id="oc_saida"
            type="date"
            aria-invalid={!!errors.data_saida}
            disabled={pendente}
            {...register("data_saida")}
          />
          {errors.data_saida ? (
            <p className="text-xs text-destructive">{errors.data_saida.message}</p>
          ) : null}
        </div>
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Salvando…
          </>
        ) : (
          "Adicionar ocupante"
        )}
      </Button>
    </form>
  );
}
