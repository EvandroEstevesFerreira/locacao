"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_ITEM,
  TIPO_ITEM,
  UNIDADES,
  itemSchema,
  type ItemDados,
  type ItemInput,
  type TipoItem,
} from "@/lib/itens";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarItem } from "./actions";

type Item = {
  id: string;
  tipo: TipoItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
};

export function ItemForm({ item }: { item?: Item }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ItemInput, unknown, ItemDados>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      id: item?.id,
      tipo: item?.tipo ?? "equipamento",
      descricao: item?.descricao ?? "",
      unidade: item?.unidade ?? "",
      ativo: item?.ativo ?? true,
    },
  });

  function onSubmit(values: ItemDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarItem(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(item ? "Item atualizado." : "Item cadastrado.");
      // Equipamento novo vai para a edição, onde se cadastram as unidades. O
      // destino é decidido aqui porque a action devolve o id — antes era um
      // `redirect()` condicional dentro dela.
      const novoEquipamento = !item && values.tipo === "equipamento" && r.id;
      router.replace(novoEquipamento ? `/itens/${r.id}` : "/itens");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      <input type="hidden" {...register("id")} />

      <div className="space-y-1.5">
        <Label htmlFor="tipo">Tipo</Label>
        <NativeSelect id="tipo" disabled={pendente} {...register("tipo")}>
          {TIPOS_ITEM.map((t) => (
            <option key={t} value={t}>
              {TIPO_ITEM[t].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          Equipamentos são controlados por unidade; materiais retornáveis por
          quantidade; consumíveis não retornam.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="descricao">Descrição</Label>
        <Input
          id="descricao"
          placeholder="Ex.: Betoneira 400L / Escora metálica 3m"
          aria-invalid={!!errors.descricao}
          disabled={pendente}
          {...register("descricao")}
        />
        {errors.descricao ? (
          <p className="text-xs text-destructive">{errors.descricao.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="unidade">
          Unidade de medida{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="unidade"
          list="unidades"
          placeholder="un, m, kg…"
          className="max-w-40"
          disabled={pendente}
          {...register("unidade")}
        />
        <datalist id="unidades">
          {UNIDADES.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={pendente}
          className="size-4"
          {...register("ativo")}
        />
        Item ativo
      </label>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" render={<Link href="/itens" />}>
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
