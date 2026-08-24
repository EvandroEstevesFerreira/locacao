"use client";

// Os itens da conferência.
//
// Um componente cliente para a lista inteira, e não uma ilha por linha: o
// estado é um só — qual linha está sendo lançada. As demais são marcação
// estática.
//
// O CAMPO QUE APARECE DEPENDE DO ITEM. Item com `controle = 'peca'` mostra o
// seletor de patrimônio e exige a peça; item por quantidade mostra o número.
// Sem essa troca, o conferente de uma betoneira digitaria "1" e o sistema não
// saberia QUAL betoneira chegou — que é a razão de o patrimônio existir.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  CONDICOES,
  CONDICAO_INFO,
  type Condicao,
} from "@/lib/recebimento";
import type {
  RecebimentoItemLinha,
  ItemContratado,
  UnidadeDisponivel,
} from "@/lib/data/recebimentos";
import {
  salvarRecebimentoItem,
  excluirRecebimentoItem,
} from "../contratos/recebimento-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function RecebimentoItens({
  recebimentoId,
  itens,
  contratados,
  unidades,
  podeEditar,
}: {
  recebimentoId: string;
  itens: RecebimentoItemLinha[];
  contratados: ItemContratado[];
  unidades: UnidadeDisponivel[];
  podeEditar: boolean;
}) {
  const [lancando, setLancando] = useState(false);

  return (
    <div className="space-y-4">
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum item conferido ainda.
        </p>
      ) : (
        <div className="divide-y">
          {itens.map((i) => (
            <div key={i.id} className="flex flex-wrap items-start gap-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {i.item_descricao}
                  {i.unidade_identificador ? (
                    <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                      {i.unidade_identificador}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {i.quantidade}{" "}
                  {i.controle === "peca" ? "peça" : "un."}
                  {i.item_locado_id === null ? " · fora do contrato" : ""}
                  {i.observacoes ? ` · ${i.observacoes}` : ""}
                </p>
              </div>
              <Badge variant={CONDICAO_INFO[i.condicao as Condicao]?.variant}>
                {CONDICAO_INFO[i.condicao as Condicao]?.label ?? i.condicao}
              </Badge>
              {podeEditar ? (
                <ConfirmDelete
                  action={excluirRecebimentoItem}
                  id={i.id}
                  hidden={{ recebimento_id: recebimentoId }}
                  mensagem="Remover este item da conferência?"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {podeEditar ? (
        lancando ? (
          <div className="rounded-lg border border-dashed p-3">
            <ItemForm
              recebimentoId={recebimentoId}
              contratados={contratados}
              unidades={unidades}
              aoConcluir={() => setLancando(false)}
            />
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setLancando(true)}>
            <Plus className="size-3.5" aria-hidden />
            Lançar item
          </Button>
        )
      ) : null}
    </div>
  );
}

function ItemForm({
  recebimentoId,
  contratados,
  unidades,
  aoConcluir,
}: {
  recebimentoId: string;
  contratados: ItemContratado[];
  unidades: UnidadeDisponivel[];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // `""` = divergência: chegou algo fora do contrato. É a razão de
  // `item_locado_id` ser nulável no banco.
  const [escolha, setEscolha] = useState<string>(
    contratados[0]?.item_locado_id ?? "",
  );
  const [itemAvulso, setItemAvulso] = useState<string>("");
  const [condicao, setCondicao] = useState<Condicao>("ok");

  const contratado = contratados.find((c) => c.item_locado_id === escolha);
  const itemId = contratado?.item_id ?? itemAvulso;
  const controle = contratado?.controle ?? itensPorId(contratados)[itemAvulso];

  const unidadesDoItem = useMemo(
    () => unidades.filter((u) => u.item_id === itemId),
    [unidades, itemId],
  );

  const exigePeca = controle === "peca";
  const exigeObservacao = condicao !== "ok";

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarRecebimentoItem({
        recebimento_id: recebimentoId,
        item_locado_id: escolha || null,
        item_id: itemId,
        unidade_id: String(fd.get("unidade_id") ?? "") || null,
        quantidade: String(fd.get("quantidade") ?? ""),
        condicao,
        observacoes: String(fd.get("observacoes") ?? ""),
        controle,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Item lançado.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="escolha">Item</Label>
        <NativeSelect
          id="escolha"
          value={escolha}
          onChange={(e) => setEscolha(e.target.value)}
          disabled={pendente}
        >
          {contratados.map((c) => (
            <option key={c.item_locado_id} value={c.item_locado_id}>
              {c.descricao} — {c.quantidade} previsto(s)
            </option>
          ))}
          <option value="">Chegou algo fora do contrato…</option>
        </NativeSelect>
      </div>

      {/* Divergência: o item não está no contrato, então precisa ser escolhido
          do catálogo. O conferente não deveria ter de mentir para salvar. */}
      {!contratado ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="item_avulso">Qual item chegou</Label>
          <NativeSelect
            id="item_avulso"
            value={itemAvulso}
            onChange={(e) => setItemAvulso(e.target.value)}
            disabled={pendente}
          >
            <option value="">Selecione…</option>
            {catalogoUnico(contratados).map((c) => (
              <option key={c.item_id} value={c.item_id}>
                {c.descricao}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {exigePeca ? (
        <div className="space-y-1.5">
          <Label htmlFor="unidade_id">Patrimônio recebido</Label>
          <NativeSelect id="unidade_id" name="unidade_id" disabled={pendente}>
            <option value="">Selecione a peça…</option>
            {unidadesDoItem.map((u) => (
              <option key={u.id} value={u.id}>
                {u.identificador}
              </option>
            ))}
          </NativeSelect>
          {unidadesDoItem.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma peça cadastrada para este item. Cadastre em Itens antes de
              conferir.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="quantidade">Quantidade recebida</Label>
        <Input
          id="quantidade"
          name="quantidade"
          type="number"
          step="0.01"
          min="0.01"
          required
          inputMode="decimal"
          defaultValue={exigePeca ? "1" : (contratado?.quantidade ?? "")}
          disabled={pendente}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="condicao">Condição</Label>
        <NativeSelect
          id="condicao"
          value={condicao}
          onChange={(e) => setCondicao(e.target.value as Condicao)}
          disabled={pendente}
        >
          {CONDICOES.map((c) => (
            <option key={c} value={c}>
              {CONDICAO_INFO[c].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {CONDICAO_INFO[condicao].ajuda}
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">
          {exigeObservacao ? "O que foi encontrado" : "Observações"}
        </Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          maxLength={1000}
          required={exigeObservacao}
          disabled={pendente}
          placeholder={
            exigeObservacao
              ? "Sem isto, o fornecedor recebe “1 item com avaria” e não sabe qual nem o quê."
              : "Opcional."
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Lançando…" : "Lançar item"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
          <X className="size-3.5" aria-hidden />
          Cancelar
        </Button>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      </div>
    </form>
  );
}

/** Mapa item_id → controle, para saber o campo do item avulso. */
function itensPorId(contratados: ItemContratado[]): Record<string, "peca" | "quantidade"> {
  const m: Record<string, "peca" | "quantidade"> = {};
  for (const c of contratados) m[c.item_id] = c.controle;
  return m;
}

/** Catálogo sem repetição — o mesmo item pode ter várias linhas no contrato. */
function catalogoUnico(contratados: ItemContratado[]): ItemContratado[] {
  const vistos = new Set<string>();
  return contratados.filter((c) => {
    if (vistos.has(c.item_id)) return false;
    vistos.add(c.item_id);
    return true;
  });
}
