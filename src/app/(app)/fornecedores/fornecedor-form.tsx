"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatarCnpj } from "@/lib/cnpj";
import {
  fornecedorSchema,
  type FornecedorDados,
  type FornecedorInput,
} from "@/lib/fornecedor";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { salvarFornecedor } from "./actions";

type Fornecedor = {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export function FornecedorForm({
  fornecedor,
  obras = [],
  obrasDoFornecedor = [],
}: {
  fornecedor?: Fornecedor;
  obras?: { id: string; codigo: string; nome: string }[];
  obrasDoFornecedor?: string[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [duplicado, setDuplicado] = useState(false);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<FornecedorInput, unknown, FornecedorDados>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      id: fornecedor?.id,
      nome: fornecedor?.nome ?? "",
      cnpj: fornecedor?.cnpj ?? "",
      contato_nome: fornecedor?.contato_nome ?? "",
      contato_telefone: fornecedor?.contato_telefone ?? "",
      contato_email: fornecedor?.contato_email ?? "",
      observacoes: fornecedor?.observacoes ?? "",
      ativo: fornecedor?.ativo ?? true,
      obras: obrasDoFornecedor,
      confirmar_duplicado: false,
    },
  });

  // `useWatch` em vez de `watch()`: o React Compiler não consegue memoizar a
  // função devolvida por `watch` e por isso pula a otimização do componente
  // inteiro (lint react-hooks/incompatible-library). `useWatch` é a API
  // observável do RHF e não tem esse problema.
  const cnpj = useWatch({ control, name: "cnpj" }) ?? "";

  function onSubmit(values: FornecedorDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarFornecedor(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        // CNPJ repetido não é erro de validação: pode haver matriz e filial com
        // o mesmo raiz. Libera a caixa de "salvar mesmo assim".
        if (r.duplicado) setDuplicado(true);
        return;
      }
      toast.success(fornecedor ? "Fornecedor atualizado." : "Fornecedor cadastrado.");
      router.replace("/fornecedores");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            placeholder="Ex.: Locadora Alfa"
            aria-invalid={!!errors.nome}
            disabled={pendente}
            {...register("nome")}
          />
          {errors.nome ? (
            <p className="text-xs text-destructive">{errors.nome.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cnpj">
            CNPJ{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          {/* Controlado para aplicar a máscara enquanto digita. O dígito
              verificador é validado pelo zodResolver a cada mudança, então o
              erro aparece antes do submit — antes só chegava depois. */}
          <Input
            id="cnpj"
            inputMode="text"
            autoCapitalize="characters"
            maxLength={18}
            placeholder="12.ABC.345/01DE-35"
            aria-invalid={!!errors.cnpj}
            disabled={pendente}
            value={cnpj}
            onChange={(e) =>
              setValue("cnpj", formatarCnpj(e.target.value), {
                shouldValidate: true,
              })
            }
          />
          {errors.cnpj ? (
            <p className="text-xs text-destructive">{errors.cnpj.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aceita o CNPJ alfanumérico (letras e números).
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="contato_nome">Contato</Label>
          <Input id="contato_nome" disabled={pendente} {...register("contato_nome")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contato_telefone">Telefone</Label>
          <Input
            id="contato_telefone"
            disabled={pendente}
            {...register("contato_telefone")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contato_email">E-mail</Label>
          <Input
            id="contato_email"
            type="email"
            aria-invalid={!!errors.contato_email}
            disabled={pendente}
            {...register("contato_email")}
          />
          {errors.contato_email ? (
            <p className="text-xs text-destructive">{errors.contato_email.message}</p>
          ) : null}
        </div>
      </div>

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

      <div className="space-y-2">
        <Label>Obras / locais atendidos</Label>
        <p className="text-xs text-muted-foreground">
          Vincule as obras onde este fornecedor atua (fornecedores costumam ser
          locais). Serve para organizar e filtrar — não impede usá-lo em outras
          obras.
        </p>
        {obras.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>
        ) : (
          <div className="grid max-h-56 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
            {obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={o.id}
                  disabled={pendente}
                  className="size-4"
                  {...register("obras")}
                />
                <span>
                  <span className="font-medium">{o.codigo}</span> — {o.nome}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={pendente}
          className="size-4"
          {...register("ativo")}
        />
        Fornecedor ativo
      </label>

      <FormError>{erroServidor}</FormError>

      {duplicado ? (
        <label className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <input
            type="checkbox"
            className="size-4"
            disabled={pendente}
            {...register("confirmar_duplicado")}
          />
          Salvar mesmo assim (CNPJ já cadastrado em outro fornecedor)
        </label>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          render={<Link href="/fornecedores" />}
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
