"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  orcamentoSchema,
  type OrcamentoInput,
  type OrcamentoDados,
} from "@/lib/orcamento";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { salvarOrcamento } from "../orcamento-actions";

export type ItemCatalogoOpcao = { id: string; descricao: string };

export type OrcamentoAtual = {
  versao: number;
  valor_total: number;
  observacoes: string | null;
  itens: { item_id: string; quantidade: number | null; valor_previsto: number }[];
};

export function OrcamentoForm({
  obraId,
  atual,
  catalogo,
}: {
  obraId: string;
  /** O vigente, quando existe. Sua presença muda o rótulo do botão. */
  atual?: OrcamentoAtual;
  catalogo: ItemCatalogoOpcao[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    // Três parâmetros porque o schema TRANSFORMA: dinheiro entra como string e
    // sai como número, e os opcionais viram null.
  } = useForm<OrcamentoInput, unknown, OrcamentoDados>({
    resolver: zodResolver(orcamentoSchema),
    defaultValues: {
      obra_id: obraId,
      valor_total: atual ? String(atual.valor_total) : "",
      observacoes: atual?.observacoes ?? "",
      itens:
        atual?.itens.map((i) => ({
          item_id: i.item_id,
          quantidade: i.quantidade === null ? "" : String(i.quantidade),
          valor_previsto: String(i.valor_previsto),
        })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "itens" });

  function onSubmit(valores: OrcamentoDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarOrcamento(valores);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(
        atual
          ? `Orçamento salvo como versão ${atual.versao + 1}.`
          : "Orçamento cadastrado.",
      );
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="valor_total">Orçamento de locação (R$)</Label>
          <Input
            id="valor_total"
            inputMode="decimal"
            placeholder="400000,00"
            aria-invalid={!!errors.valor_total}
            disabled={pendente}
            {...register("valor_total")}
          />
          {errors.valor_total ? (
            <p className="text-xs text-destructive">{errors.valor_total.message}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="observacoes">
            Observações{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Textarea
            id="observacoes"
            rows={2}
            placeholder="Base de cálculo, premissas, quem aprovou…"
            disabled={pendente}
            {...register("observacoes")}
          />
        </div>
      </div>

      {/* Detalhamento OPCIONAL. A soma pode divergir do total, e a tela mostra a
          diferença — forçar igualdade obrigaria a detalhar tudo ou nada, e o
          resultado prático seria não detalhar. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>
            Detalhamento por item{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendente || catalogo.length === 0}
            onClick={() => append({ item_id: "", quantidade: "", valor_previsto: "" })}
          >
            <Plus className="size-4" />
            Acrescentar item
          </Button>
        </div>

        {catalogo.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum item no catálogo para detalhar.
          </p>
        ) : null}

        {fields.map((campo, i) => (
          <div
            key={campo.id}
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]"
          >
            <div>
              <NativeSelect
                aria-label={`Item ${i + 1}`}
                aria-invalid={!!errors.itens?.[i]?.item_id}
                disabled={pendente}
                {...register(`itens.${i}.item_id`)}
              >
                <option value="">Selecione o item…</option>
                {catalogo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.descricao}
                  </option>
                ))}
              </NativeSelect>
              {errors.itens?.[i]?.item_id ? (
                <p className="text-xs text-destructive">
                  {errors.itens[i]?.item_id?.message}
                </p>
              ) : null}
            </div>

            <Input
              inputMode="decimal"
              placeholder="Qtd."
              aria-label={`Quantidade do item ${i + 1}`}
              disabled={pendente}
              {...register(`itens.${i}.quantidade`)}
            />

            <Input
              inputMode="decimal"
              placeholder="R$ previsto"
              aria-label={`Valor previsto do item ${i + 1}`}
              disabled={pendente}
              {...register(`itens.${i}.valor_previsto`)}
            />

            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Remover item ${i + 1}`}
              disabled={pendente}
              onClick={() => remove(i)}
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end">
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {/* O rótulo diz "nova versão" quando já existe vigente: a pessoa
              precisa saber que está criando revisão, não editando. */}
          {pendente
            ? "Salvando…"
            : atual
              ? "Salvar como nova versão"
              : "Salvar orçamento"}
        </Button>
      </div>
    </form>
  );
}
