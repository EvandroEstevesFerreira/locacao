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
import { aoInvalidar } from "@/lib/validacao-form";
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
  obrasComContrato = [],
}: {
  fornecedor?: Fornecedor;
  obras?: { id: string; codigo: string; nome: string }[];
  obrasDoFornecedor?: string[];
  /** Derivadas dos contratos. Somente leitura — o contrato é a fonte. */
  obrasComContrato?: { id: string; codigo: string; nome: string }[];
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
  // O aviso do e-mail reage enquanto se digita, e some assim que o campo tem
  // algo. Mostrar o alerta depois de preenchido treinaria a pessoa a ignorá-lo.
  const semEmail = (useWatch({ control, name: "contato_email" }) ?? "").trim() === "";

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
      // "Deu certo, com ressalva": o cadastro foi salvo e algo acessório
      // falhou — quase sempre o vínculo com obras.
      if (r.aviso) toast.warning(r.aviso, { duration: 10000 });
      router.replace("/fornecedores");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
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

      {/* O E-MAIL VEM PRIMEIRO E SOZINHO, e não como terceiro de uma fileira de
          três. Ele não é "mais um dado de contato": é por ele que saem o
          romaneio de recebimento e o termo de devolução. Sem ele o documento é
          gerado, o registro fecha, e o fornecedor nunca fica sabendo — em
          silêncio. Quando este levantamento foi feito, 36 dos 37 fornecedores
          estavam sem e-mail, e nada na tela dizia isso. */}
      <div className="space-y-1.5">
        <Label htmlFor="contato_email">E-mail</Label>
        <Input
          id="contato_email"
          type="email"
          placeholder="para onde vão o romaneio e o termo de devolução"
          aria-invalid={!!errors.contato_email}
          disabled={pendente}
          {...register("contato_email")}
        />
        {errors.contato_email ? (
          <p className="text-xs text-destructive">{errors.contato_email.message}</p>
        ) : semEmail ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-strong">
            <strong>Sem e-mail, este fornecedor não recebe nada.</strong> Ao
            fechar um recebimento ou uma devolução, o documento é gerado e o
            aviso não sai — e ele segue cobrando o que já voltou.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Recebe o romaneio de recebimento e o termo de devolução, em PDF.
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contato_nome">
            Contato{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="contato_nome" disabled={pendente} {...register("contato_nome")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contato_telefone">
            Telefone{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="contato_telefone"
            disabled={pendente}
            {...register("contato_telefone")}
          />
        </div>
      </div>

      {/* AS OBRAS COM CONTRATO APARECEM SOZINHAS — o sistema já sabe onde o
          fornecedor atua, e manter uma segunda lista à mão é como as duas
          divergem. O que sobrou aqui é o vínculo MANUAL, para o fornecedor que
          atende obra sem contrato cadastrado no Loca.

          Ele saiu do corpo do formulário e virou seção recolhida por dois
          motivos: a parede de caixas crescia em linha reta com o número de
          obras (com trinta, era um muro), e o vínculo é usado por poucos — no
          levantamento, 8 vínculos entre 37 fornecedores. */}
      <details className="rounded-md border">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
          Mais campos
          {obrasComContrato.length > 0 ? (
            <span className="ml-2 font-normal text-muted-foreground">
              · atende {obrasComContrato.length}{" "}
              {obrasComContrato.length === 1 ? "obra" : "obras"} por contrato
            </span>
          ) : null}
        </summary>

        <div className="space-y-5 border-t p-4">
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

          {obrasComContrato.length > 0 ? (
            <div className="space-y-1.5">
              <Label>Obras com contrato</Label>
              <p className="text-xs text-muted-foreground">
                Vêm dos contratos e não se editam aqui. Para vincular a uma obra
                nova, crie o contrato.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {obrasComContrato.map((o) => (
                  <span
                    key={o.id}
                    className="rounded-md border px-2 py-0.5 text-xs"
                  >
                    <span className="tabular-nums">{o.codigo}</span> — {o.nome}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Obras atendidas sem contrato</Label>
            <p className="text-xs text-muted-foreground">
              Só para quem atende uma obra que ainda não tem contrato no Loca.
              Serve para organizar e filtrar — não impede usá-lo em outras obras.
            </p>
            {obras.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>
            ) : (
              <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2">
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
        </div>
      </details>

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
        <label className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-strong">
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
