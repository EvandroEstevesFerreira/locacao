"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarItem, type ItemFormState } from "./actions";
import { TIPO_ITEM, UNIDADES, type TipoItem } from "@/lib/itens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Item = {
  id: string;
  tipo: TipoItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
};

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ItemForm({ item }: { item?: Item }) {
  const [state, formAction, isPending] = useActionState<ItemFormState, FormData>(
    salvarItem,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}

      <div className="space-y-2">
        <Label htmlFor="tipo">Tipo *</Label>
        <select
          id="tipo"
          name="tipo"
          defaultValue={item?.tipo ?? "equipamento"}
          className={selectClasses}
        >
          {(Object.keys(TIPO_ITEM) as TipoItem[]).map((t) => (
            <option key={t} value={t}>
              {TIPO_ITEM[t].label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Equipamentos são controlados por unidade; materiais retornáveis por
          quantidade; consumíveis não retornam.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição *</Label>
        <Input
          id="descricao"
          name="descricao"
          required
          maxLength={200}
          defaultValue={item?.descricao ?? ""}
          placeholder="Ex.: Betoneira 400L / Escora metálica 3m"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="unidade">Unidade de medida</Label>
        <Input
          id="unidade"
          name="unidade"
          list="unidades"
          maxLength={10}
          defaultValue={item?.unidade ?? ""}
          placeholder="un, m, kg…"
          className="max-w-40"
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
          name="ativo"
          defaultChecked={item?.ativo ?? true}
          className="size-4"
        />
        Item ativo
      </label>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/itens" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
