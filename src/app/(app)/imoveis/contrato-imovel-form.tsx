"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_CAUCAO,
  STATUS_CAUCAO_INFO,
  contratoImovelSchema,
  type ContratoImovelDados,
  type ContratoImovelInput,
  type StatusCaucao,
} from "@/lib/imoveis";
import { formatarBRL } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarContratoImovel } from "./actions";

/**
 * Contrato já gravado, como vem do banco. Nome distinto do
 * `ContratoImovelDados` de src/lib/imoveis.ts, que é a SAÍDA do schema — os dois
 * são parecidos mas não iguais (aqui os números podem ser null).
 */
export type ContratoImovelExistente = {
  id?: string;
  data_inicio?: string | null;
  data_fim?: string | null;
  valor_aluguel?: number | null;
  valor_condominio?: number | null;
  valor_iptu?: number | null;
  seguro_fianca?: number | null;
  seguro_fianca_mensal?: boolean;
  dia_vencimento?: number | null;
  indice_reajuste?: string | null;
  data_reajuste?: string | null;
  caucao_valor?: number | null;
  caucao_status?: string | null;
  vigente?: boolean;
  observacoes?: string | null;
};

const paraCampo = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : String(v);

export function ContratoImovelForm({
  imovelId,
  contrato,
  onDoneLabel = "Salvar contrato",
}: {
  imovelId: string;
  contrato?: ContratoImovelExistente;
  onDoneLabel?: string;
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ContratoImovelInput, unknown, ContratoImovelDados>({
    resolver: zodResolver(contratoImovelSchema),
    defaultValues: {
      id: contrato?.id,
      imovel_id: imovelId,
      data_inicio: contrato?.data_inicio ?? "",
      data_fim: contrato?.data_fim ?? "",
      valor_aluguel: paraCampo(contrato?.valor_aluguel),
      valor_condominio: paraCampo(contrato?.valor_condominio),
      valor_iptu: paraCampo(contrato?.valor_iptu),
      seguro_fianca: paraCampo(contrato?.seguro_fianca),
      seguro_fianca_mensal: contrato?.seguro_fianca_mensal ?? true,
      dia_vencimento: paraCampo(contrato?.dia_vencimento),
      indice_reajuste: contrato?.indice_reajuste ?? "",
      data_reajuste: contrato?.data_reajuste ?? "",
      caucao_valor: paraCampo(contrato?.caucao_valor),
      caucao_status: contrato?.caucao_status ?? "",
      vigente: contrato?.vigente ?? true,
      observacoes: contrato?.observacoes ?? "",
    },
  });

  // `useWatch` e não `watch()`: o React Compiler não memoiza a função de `watch`
  // e por causa dela pula a otimização do componente inteiro.
  const [aluguel, condominio, iptu, seguro, seguroMensal] = useWatch({
    control,
    name: [
      "valor_aluguel",
      "valor_condominio",
      "valor_iptu",
      "seguro_fianca",
      "seguro_fianca_mensal",
    ],
  });

  const numero = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0;
  const totalMensal =
    numero(aluguel) +
    numero(condominio) +
    numero(iptu) +
    (seguroMensal ? numero(seguro) : 0);

  function onSubmit(values: ContratoImovelDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarContratoImovel(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(contrato?.id ? "Contrato atualizado." : "Contrato cadastrado.");
      // `router.refresh()` é essencial: a action fazia `redirect()` para a MESMA
      // URL só para provocar o re-render. Sem ele, o contrato salvo não
      // apareceria na tela.
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input type="hidden" {...register("imovel_id")} />
      <input type="hidden" {...register("id")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="data_inicio">Início</Label>
          <Input
            id="data_inicio"
            type="date"
            disabled={pendente}
            {...register("data_inicio")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_fim">Fim</Label>
          <Input
            id="data_fim"
            type="date"
            aria-invalid={!!errors.data_fim}
            disabled={pendente}
            {...register("data_fim")}
          />
          {errors.data_fim ? (
            <p className="text-xs text-destructive">{errors.data_fim.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_aluguel">Aluguel (R$)</Label>
          <Input
            id="valor_aluguel"
            type="number"
            step="0.01"
            min="0"
            aria-invalid={!!errors.valor_aluguel}
            disabled={pendente}
            {...register("valor_aluguel")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_condominio">Condomínio (R$)</Label>
          <Input
            id="valor_condominio"
            type="number"
            step="0.01"
            min="0"
            disabled={pendente}
            {...register("valor_condominio")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_iptu">IPTU (R$)</Label>
          <Input
            id="valor_iptu"
            type="number"
            step="0.01"
            min="0"
            disabled={pendente}
            {...register("valor_iptu")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="seguro_fianca">Seguro-fiança (R$)</Label>
          <Input
            id="seguro_fianca"
            type="number"
            step="0.01"
            min="0"
            disabled={pendente}
            {...register("seguro_fianca")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dia_vencimento">Dia de vencimento</Label>
          <Input
            id="dia_vencimento"
            type="number"
            min="1"
            max="31"
            aria-invalid={!!errors.dia_vencimento}
            disabled={pendente}
            {...register("dia_vencimento")}
          />
          {/* Antes aceitava 45: o `num()` da action só checava se era número. */}
          {errors.dia_vencimento ? (
            <p className="text-xs text-destructive">
              {errors.dia_vencimento.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="indice_reajuste">Índice de reajuste</Label>
          <Input
            id="indice_reajuste"
            placeholder="IGP-M / IPCA"
            disabled={pendente}
            {...register("indice_reajuste")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="data_reajuste">Próximo reajuste</Label>
          <Input
            id="data_reajuste"
            type="date"
            disabled={pendente}
            {...register("data_reajuste")}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          disabled={pendente}
          {...register("seguro_fianca_mensal")}
        />
        Somar o seguro-fiança na parcela mensal
      </label>

      {/* Total calculado ao vivo. Antes essa soma só aparecia DEPOIS de salvar,
          no card de detalhe do imóvel. */}
      <div className="flex items-center justify-between rounded-md bg-muted/50 px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Total mensal (aluguel + condomínio + IPTU
          {seguroMensal ? " + seguro-fiança" : ""})
        </span>
        <span className="text-base font-semibold tabular-nums">
          {formatarBRL(totalMensal)}
        </span>
      </div>

      <fieldset className="grid gap-4 border-t pt-4 sm:grid-cols-2">
        <legend className="text-sm font-medium">Caução</legend>
        <div className="space-y-1.5">
          <Label htmlFor="caucao_valor">Valor da caução (R$)</Label>
          <Input
            id="caucao_valor"
            type="number"
            step="0.01"
            min="0"
            disabled={pendente}
            {...register("caucao_valor")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="caucao_status">Situação da caução</Label>
          <NativeSelect
            id="caucao_status"
            disabled={pendente}
            {...register("caucao_status")}
          >
            <option value="">— Não aplicável —</option>
            {STATUS_CAUCAO.map((s) => (
              <option key={s} value={s}>
                {STATUS_CAUCAO_INFO[s as StatusCaucao]}
              </option>
            ))}
          </NativeSelect>
          {/* Regra cruzada: caução com valor precisa de situação, senão o
              dinheiro fica sem rastro de devolvida/retida no encerramento. */}
          {errors.caucao_status ? (
            <p className="text-xs text-destructive">
              {errors.caucao_status.message}
            </p>
          ) : null}
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          id="observacoes"
          rows={2}
          disabled={pendente}
          {...register("observacoes")}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4"
          disabled={pendente}
          {...register("vigente")}
        />
        Este é o contrato vigente (os demais deste imóvel deixam de ser vigentes)
      </label>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente}>
        {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
        {pendente ? "Salvando…" : onDoneLabel}
      </Button>
    </form>
  );
}
