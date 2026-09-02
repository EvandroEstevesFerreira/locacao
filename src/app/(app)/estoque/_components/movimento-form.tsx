"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  movimentoSchema,
  TIPOS_MOVIMENTO,
  TIPO_MOVIMENTO_INFO,
  type MovimentoInput,
  type MovimentoDados,
  type TipoMovimento,
} from "@/lib/estoque";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { lancarMovimento } from "../actions";

export function MovimentoForm({
  itens,
  obras,
}: {
  itens: { id: string; descricao: string; unidade: string | null }[];
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<MovimentoInput, unknown, MovimentoDados>({
    resolver: zodResolver(movimentoSchema),
    defaultValues: {
      item_id: "",
      obra_id: "",
      tipo: "entrada",
      quantidade: "",
      // `hojeISOSaoPaulo` roda no cliente aqui, onde o fuso já é o do usuário —
      // mas usar o mesmo helper mantém uma definição só de "hoje" no projeto.
      data: hojeISOSaoPaulo(),
      documento: "",
      observacoes: "",
    },
  });

  const tipo = useWatch({ control, name: "tipo" }) as TipoMovimento;

  function onSubmit(valores: MovimentoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await lancarMovimento(valores);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Movimento lançado.");
      // Limpa só o que muda de lançamento para lançamento: quem dá entrada de
      // nota lança vários itens seguidos, e refazer data e local a cada linha é
      // o atrito que faz a pessoa desistir de usar o estoque.
      reset((antes) => ({ ...antes, item_id: "", quantidade: "", observacoes: "" }));
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="item_id">Item</Label>
          <NativeSelect
            id="item_id"
            aria-invalid={!!errors.item_id}
            disabled={pendente}
            {...register("item_id")}
          >
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
          <Label htmlFor="tipo">Tipo</Label>
          <NativeSelect id="tipo" disabled={pendente} {...register("tipo")}>
            {TIPOS_MOVIMENTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_MOVIMENTO_INFO[t].label}
              </option>
            ))}
          </NativeSelect>
          {/* A ajuda muda com o tipo: "ajuste negativo" não se explica sozinho,
              e o almoxarife não deveria precisar adivinhar quando usá-lo. */}
          <p className="text-xs text-muted-foreground">
            {TIPO_MOVIMENTO_INFO[tipo]?.ajuda}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="quantidade">Quantidade</Label>
          <Input
            id="quantidade"
            inputMode="decimal"
            placeholder="0"
            aria-invalid={!!errors.quantidade}
            disabled={pendente}
            {...register("quantidade")}
          />
          {errors.quantidade ? (
            <p className="text-xs text-destructive">{errors.quantidade.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obra_id">Local</Label>
          <NativeSelect id="obra_id" disabled={pendente} {...register("obra_id")}>
            {/* Vazio não é ausência de dado: é o almoxarifado central. Mesma
                convenção da peça em Frota. */}
            <option value="">Almoxarifado central</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data">Data</Label>
          <Input
            id="data"
            type="date"
            aria-invalid={!!errors.data}
            disabled={pendente}
            {...register("data")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="documento">
            Documento{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="documento"
            maxLength={80}
            placeholder="NF, requisição…"
            disabled={pendente}
            {...register("documento")}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacoes">
            Observações{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input
            id="observacoes"
            maxLength={300}
            disabled={pendente}
            {...register("observacoes")}
          />
        </div>
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Lançando…" : "Lançar movimento"}
        </Button>
      </div>
    </form>
  );
}
