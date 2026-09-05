"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  NATUREZAS_ITEM,
  NATUREZA_ITEM,
  UNIDADES,
  controleDaNatureza,
  itemSchema,
  type ItemDados,
  type ItemInput,
  type NaturezaItem,
} from "@/lib/itens";
import { CONTROLE_INFO } from "@/lib/recebimento";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarItem } from "./actions";

type Item = {
  id: string;
  natureza: NaturezaItem;
  tipo_id: string | null;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
};

export type TipoOpcao = {
  id: string;
  nome: string;
  categoria: string;
  naturezaPadrao: NaturezaItem;
};

export function ItemForm({
  item,
  tipos = [],
  unidades = [],
}: {
  item?: Item;
  /** Cadastrados em Configurações › Catálogo. */
  tipos?: TipoOpcao[];
  /** Cadastradas em Configurações › Unidades. */
  unidades?: { simbolo: string; nome: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ItemInput, unknown, ItemDados>({
    resolver: zodResolver(itemSchema),
    defaultValues: {
      id: item?.id,
      natureza: item?.natureza ?? "equipamento",
      tipo_id: item?.tipo_id ?? "",
      descricao: item?.descricao ?? "",
      unidade: item?.unidade ?? "",
      ativo: item?.ativo ?? true,
    },
  });

  const natureza = (useWatch({ control, name: "natureza" }) ??
    "equipamento") as NaturezaItem;
  // O controle não é mais escolhido: ele VEM da natureza (migration 0069). A
  // tela mostra o que vai acontecer em vez de perguntar duas vezes a mesma
  // coisa — que era o defeito, porque os dois campos podiam se contradizer.
  const controle = controleDaNatureza(natureza);

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
      const novoEquipamento = !item && values.natureza === "equipamento" && r.id;
      router.replace(novoEquipamento ? `/itens/${r.id}` : "/itens");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      <input type="hidden" {...register("id")} />

      {/* TIPO é a FAMÍLIA — NOTEBOOK, ANDAIME —, e vem de uma lista. Digitar
          a família dentro da descrição foi o que produziu "Notebook Dell
          Latitude 3490" e "Notebook Dell Latitute 3490" como dois cadastros
          diferentes, com seis máquinas divididas entre eles. */}
      <div className="space-y-1.5">
        <Label htmlFor="tipo_id">
          Tipo{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <NativeSelect id="tipo_id" disabled={pendente} {...register("tipo_id")}>
          <option value="">Sem tipo definido</option>
          {tipos.map((tp) => (
            <option key={tp.id} value={tp.id}>
              {tp.categoria} › {tp.nome}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {tipos.length === 0 ? (
            <>
              Nenhum tipo cadastrado ainda. Cadastre em{" "}
              <Link href="/configuracoes" className="underline">
                Configurações › Catálogo
              </Link>
              .
            </>
          ) : (
            <>
              A família do item. A descrição fica só com o modelo — “Dell
              Latitude 3490”, e não “Notebook Dell Latitude 3490”.
            </>
          )}
        </p>
      </div>

      {/* NATUREZA é como o item se comporta. Chamava-se "Tipo" nesta tela, e o
          nome mudou porque Tipo passou a ser a família, acima. */}
      <div className="space-y-1.5">
        <Label htmlFor="natureza">Natureza</Label>
        <NativeSelect id="natureza" disabled={pendente} {...register("natureza")}>
          {NATUREZAS_ITEM.map((n) => (
            <option key={n} value={n}>
              {NATUREZA_ITEM[n].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {NATUREZA_ITEM[natureza].descricao}
        </p>
        {/* Antes existia um dropdown "Controle no recebimento" ao lado deste, e
            os dois podiam se contradizer — o padrão de fábrica era
            "Equipamento" (controlado por unidade) com "Por quantidade". Agora o
            controle é consequência, e a tela DIZ a consequência em vez de
            perguntar de novo. */}
        <p className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          No recebimento, será conferido{" "}
          <strong>{CONTROLE_INFO[controle].label.toLowerCase()}</strong>.{" "}
          {CONTROLE_INFO[controle].ajuda}
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
        {/* Lista fechada, e não campo livre. Campo livre de unidade sempre
            vira "un", "UN", "unid" e "unidade" convivendo na mesma tabela — e
            aí nenhum relatório soma direito. */}
        <NativeSelect
          id="unidade"
          className="max-w-56"
          disabled={pendente}
          {...register("unidade")}
        >
          <option value="">—</option>
          {(unidades.length > 0
            ? unidades
            : UNIDADES.map((u) => ({ simbolo: u, nome: u }))
          ).map((u) => (
            <option key={u.simbolo} value={u.simbolo}>
              {u.simbolo === u.nome ? u.simbolo : `${u.simbolo} — ${u.nome}`}
            </option>
          ))}
        </NativeSelect>
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
