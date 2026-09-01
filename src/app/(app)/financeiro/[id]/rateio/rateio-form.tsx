"use client";

import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { formatarBRL } from "@/lib/locacao";
import {
  ratearProporcional,
  naoAtribuido,
  type ItemParaRateio,
  type ParcelaItem,
} from "@/lib/custo-item";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarRateio } from "../../rateio-actions";

type Form = { valores: string[] };

export function RateioForm({
  lancamentoId,
  valorLancamento,
  itens,
  parcelas,
}: {
  lancamentoId: string;
  valorLancamento: number;
  itens: ItemParaRateio[];
  parcelas: ParcelaItem[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const gravado = new Map(parcelas.map((p) => [p.item_locado_id, p.valor]));

  const { register, handleSubmit, control, setValue } = useForm<Form>({
    defaultValues: {
      valores: itens.map((i) => {
        const v = gravado.get(i.item_locado_id);
        return v === undefined ? "" : String(v);
      }),
    },
  });

  const valores = useWatch({ control, name: "valores" });

  const parcelasAtuais: ParcelaItem[] = itens.map((i, idx) => ({
    item_locado_id: i.item_locado_id,
    valor: Number((valores?.[idx] ?? "").toString().replace(",", ".")) || 0,
  }));
  const resto = naoAtribuido(valorLancamento, parcelasAtuais);

  /**
   * Preenche com o rateio proporcional ao custo mensal contratado.
   *
   * É SÓ pré-preenchimento: o que vai para o banco é o que estiver nos campos
   * depois de a pessoa conferir. Rateio automático invisível produziria um
   * número que ninguém explica quando o diretor perguntar.
   */
  function sugerir() {
    const sugestao = ratearProporcional(valorLancamento, itens);
    sugestao.forEach((s, idx) => {
      setValue(`valores.${idx}`, String(s.valor), { shouldDirty: true });
    });
  }

  function onSubmit(v: Form) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarRateio({
        lancamento_id: lancamentoId,
        parcelas: itens.map((i, idx) => ({
          item_locado_id: i.item_locado_id,
          valor: v.valores[idx] ?? "",
        })),
      });
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Rateio salvo.");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Valor do lançamento: <strong>{formatarBRL(valorLancamento)}</strong>
        </p>
        <Button type="button" variant="outline" size="sm" disabled={pendente} onClick={sugerir}>
          <Wand2 className="size-4" />
          Ratear proporcionalmente
        </Button>
      </div>

      <div className="divide-y rounded-md border">
        {itens.map((i, idx) => (
          <div
            key={i.item_locado_id}
            className="grid items-center gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_8rem]"
          >
            <p className="truncate text-sm font-medium">{i.descricao}</p>
            <p className="text-xs text-muted-foreground">
              contratado: {formatarBRL(i.custoMensal)}/mês
            </p>
            <Input
              inputMode="decimal"
              placeholder="R$"
              aria-label={`Valor atribuído a ${i.descricao}`}
              disabled={pendente}
              {...register(`valores.${idx}`)}
            />
          </div>
        ))}
      </div>

      {/* O que falta atribuir. Não é erro: atribuição parcial é permitida, e
          mostrar o resto é o que impede a pessoa de achar que fechou. */}
      <p
        className={
          resto === 0
            ? "text-sm text-muted-foreground"
            : "text-sm font-medium text-destructive"
        }
      >
        {resto === 0
          ? "Rateio fecha com o valor do lançamento."
          : resto > 0
            ? `Faltam ${formatarBRL(resto)} sem atribuição a item.`
            : `${formatarBRL(Math.abs(resto))} atribuídos acima do valor do lançamento.`}
      </p>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar rateio"}
        </Button>
      </div>
    </form>
  );
}
