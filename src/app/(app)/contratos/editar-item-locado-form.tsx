"use client";

// Edição de um item já locado, em diálogo.
//
// POR QUE DIÁLOGO E NÃO FORMULÁRIO NA LINHA. A linha da tabela já carrega o
// formulário de "Devolver" (`min-w-[300px]`), e a tabela só passou a caber sem
// barra horizontal depois do alargamento da página na 0.90.3. Um segundo
// formulário embutido na linha reabriria exatamente a barra que acabou de ser
// fechada — e sete campos não caberiam numa célula de qualquer forma.
//
// Espelha `add-item-locado-form.tsx` de propósito: mesmos sete campos, mesma
// ordem, mesma estimativa de custo ao vivo. Quem cadastrou o item reconhece a
// tela ao corrigi-lo.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  dataDeISO,
  formatarBRL,
  itemLocadoEdicaoSchema,
  periodosEntre,
  podeTrocarItem,
  type Cadencia,
  type ItemLocadoEdicaoInput,
} from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { editarItemLocado } from "./actions";
import { agruparPorCategoria } from "./add-item-locado-form";

export type ItemParaEditar = {
  id: string;
  item_id: string;
  frente_id: string | null;
  quantidade: number;
  valor_unitario_periodo: number;
  data_retirada: string;
  data_devolucao_prevista: string | null;
  identificacao: string | null;
  /** Descrição, só para o título do diálogo. */
  descricao: string;
  /** quantidade − saldo. Piso da quantidade e trava da troca de equipamento. */
  jaDevolvido: number;
};

export function EditarItemLocadoForm({
  contratoId,
  item,
  itens,
  frentes = [],
  cadencia,
  prorata = false,
}: {
  contratoId: string;
  item: ItemParaEditar;
  itens: {
    id: string;
    descricao: string;
    unidade: string | null;
    categoria?: string;
  }[];
  frentes?: { id: string; nome: string }[];
  cadencia?: Cadencia;
  prorata?: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const trocaLiberada = podeTrocarItem(item.jaDevolvido);

  const valores: ItemLocadoEdicaoInput = {
    id: item.id,
    contrato_id: contratoId,
    item_id: item.item_id,
    quantidade: String(item.quantidade),
    valor_unitario_periodo: String(item.valor_unitario_periodo),
    data_retirada: item.data_retirada,
    data_devolucao_prevista: item.data_devolucao_prevista ?? "",
    identificacao: item.identificacao ?? "",
    frente_id: item.frente_id ?? "",
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ItemLocadoEdicaoInput>({
    resolver: zodResolver(itemLocadoEdicaoSchema),
    defaultValues: valores,
  });

  const [quantidade, valorUnit, retirada, devolucao] = useWatch({
    control,
    name: [
      "quantidade",
      "valor_unitario_periodo",
      "data_retirada",
      "data_devolucao_prevista",
    ],
  });

  const numero = (v: unknown) => Number(String(v ?? "").replace(",", ".")) || 0;
  let estimativa: { periodos: number; total: number } | null = null;
  if (cadencia && retirada && devolucao && devolucao >= retirada) {
    const periodos = periodosEntre(
      cadencia,
      dataDeISO(String(retirada)),
      dataDeISO(String(devolucao)),
      prorata,
    );
    estimativa = {
      periodos,
      total: periodos * numero(quantidade) * numero(valorUnit),
    };
  }

  // A retirada alimenta o cálculo de custo e é carimbada pelo fechamento do
  // recebimento. Mudá-la à mão é permitido — corrigir data digitada errada é
  // caso real, e hoje só se resolve excluindo a linha — mas não em silêncio.
  const retiradaMudou = String(retirada ?? "") !== item.data_retirada;

  function alternar(proximo: boolean) {
    if (pendente) return;
    setAberto(proximo);
    if (proximo) reset(valores);
    setErroServidor(null);
  }

  function onSubmit(values: ItemLocadoEdicaoInput) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await editarItemLocado(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Item atualizado.");
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={alternar}>
      <DialogTrigger
        render={<Button variant="ghost" size="icon" aria-label="Editar item" />}
      >
        <Pencil className="size-3.5" aria-hidden />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar item locado</DialogTitle>
          <DialogDescription>{item.descricao}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))}
          className="space-y-3"
        >
          <input type="hidden" {...register("id")} />
          <input type="hidden" {...register("contrato_id")} />

          <div className="grid gap-1">
            <Label htmlFor="edit_item_id">Item</Label>
            <NativeSelect
              id="edit_item_id"
              disabled={pendente || !trocaLiberada}
              {...register("item_id")}
            >
              <option value="">Selecione o item…</option>
              {/* Agrupado por categoria, como no formulário de adicionar. */}
              {agruparPorCategoria(itens).map(([categoria, doGrupo]) => (
                <optgroup key={categoria} label={categoria}>
                  {doGrupo.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.descricao}
                      {i.unidade ? ` (${i.unidade})` : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
            {errors.item_id ? (
              <p className="text-xs text-destructive">{errors.item_id.message}</p>
            ) : null}
            {!trocaLiberada ? (
              <p className="text-xs text-muted-foreground">
                Este item já teve {item.jaDevolvido} devolvido, com fotos e
                movimentação do equipamento atual — por isso o equipamento não se
                troca aqui. Os outros campos seguem editáveis.
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="edit_quantidade">Quantidade</Label>
              <Input
                id="edit_quantidade"
                type="number"
                step="0.01"
                min={item.jaDevolvido > 0 ? item.jaDevolvido : 0.01}
                disabled={pendente}
                aria-invalid={!!errors.quantidade}
                {...register("quantidade")}
              />
              {errors.quantidade ? (
                <p className="text-xs text-destructive">
                  {errors.quantidade.message}
                </p>
              ) : null}
              {item.jaDevolvido > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Mínimo {item.jaDevolvido} — já devolvido.
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="edit_valor">Valor unit. / período</Label>
              <Input
                id="edit_valor"
                type="number"
                step="0.01"
                min="0"
                disabled={pendente}
                aria-invalid={!!errors.valor_unitario_periodo}
                {...register("valor_unitario_periodo")}
              />
              {errors.valor_unitario_periodo ? (
                <p className="text-xs text-destructive">
                  {errors.valor_unitario_periodo.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="edit_retirada">Retirada</Label>
              <Input
                id="edit_retirada"
                type="date"
                disabled={pendente}
                aria-invalid={!!errors.data_retirada}
                {...register("data_retirada")}
              />
              {errors.data_retirada ? (
                <p className="text-xs text-destructive">
                  {errors.data_retirada.message}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="edit_prevista">
                Devolução prevista{" "}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="edit_prevista"
                type="date"
                disabled={pendente}
                aria-invalid={!!errors.data_devolucao_prevista}
                {...register("data_devolucao_prevista")}
              />
              {errors.data_devolucao_prevista ? (
                <p className="text-xs text-destructive">
                  {errors.data_devolucao_prevista.message}
                </p>
              ) : null}
            </div>
          </div>

          {frentes.length > 0 ? (
            <div className="grid gap-1">
              <Label htmlFor="edit_frente">
                Frente de serviço{" "}
                <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <NativeSelect
                id="edit_frente"
                disabled={pendente}
                {...register("frente_id")}
              >
                <option value="">Sem frente — o custo fica na obra</option>
                {frentes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}

          <div className="grid gap-1">
            <Label htmlFor="edit_identificacao">
              Nº de série / registro / tag{" "}
              <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="edit_identificacao"
              placeholder="Identificação do equipamento"
              disabled={pendente}
              {...register("identificacao")}
            />
          </div>

          {retiradaMudou ? (
            <p className="flex items-start gap-2 rounded-md border border-dashed p-2 text-xs">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Mudar a retirada <strong>refaz o custo estimado</strong> deste
                item desde o início — a contagem de períodos parte dela. Se o
                equipamento entrou por um recebimento fechado, a data de lá é a
                que vale como fato físico.
              </span>
            </p>
          ) : null}

          {estimativa ? (
            <p className="text-xs text-muted-foreground">
              Custo estimado até a devolução prevista: {estimativa.periodos}{" "}
              {estimativa.periodos === 1 ? "período" : "períodos"} ·{" "}
              <strong>{formatarBRL(estimativa.total)}</strong>
            </p>
          ) : null}

          <FormError>{erroServidor}</FormError>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={pendente}>
              {pendente ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  Salvando…
                </>
              ) : (
                "Salvar alterações"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => alternar(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
