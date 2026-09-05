"use client";

// Os itens da devolução.
//
// Um componente cliente para a lista inteira, e não uma ilha por linha: o
// estado é um só — qual linha está sendo lançada. As demais são marcação
// estática.
//
// DUAS DIFERENÇAS DELIBERADAS EM RELAÇÃO À CONFERÊNCIA DE RECEBIMENTO:
//
// 1. Não existe "chegou algo fora do contrato". Só se devolve o que foi
//    locado — devolver item que não está no contrato não é divergência a
//    registrar, é erro de digitação a corrigir. O seletor lista apenas os itens
//    do contrato, e só os que ainda têm saldo.
//
// 2. O SALDO fica à vista, ao lado de cada item. É o número que decide se o
//    fechamento passa, e escondê-lo faria a pessoa montar o documento inteiro
//    para descobrir no fim que a quantidade não cabia.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  CONDICOES_DEVOLUCAO,
  CONDICAO_DEVOLUCAO_INFO,
  type CondicaoDevolucao,
} from "@/lib/devolucao";
import type { DevolucaoItemLinha, ItemComSaldo } from "@/lib/data/devolucoes";
import {
  salvarDevolucaoItem,
  excluirDevolucaoItem,
} from "../contratos/devolucao-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export function DevolucaoItens({
  devolucaoId,
  itens,
  disponiveis,
  podeEditar,
}: {
  devolucaoId: string;
  itens: DevolucaoItemLinha[];
  disponiveis: ItemComSaldo[];
  podeEditar: boolean;
}) {
  const [lancando, setLancando] = useState(false);

  // Um item já lançado não pode ser lançado de novo — a tabela tem
  // `unique (devolucao_id, item_locado_id)`. Filtrar aqui evita oferecer uma
  // opção que só produziria erro.
  const jaLancados = new Set(itens.map((i) => i.item_locado_id));
  const oferecidos = disponiveis.filter(
    (d) => !jaLancados.has(d.item_locado_id) && d.saldo > 0,
  );

  return (
    <div className="space-y-4">
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum item lançado ainda.
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
                  {i.quantidade} {i.controle === "peca" ? "peça" : "un."}
                  {i.observacoes ? ` · ${i.observacoes}` : ""}
                </p>
              </div>
              <Badge
                variant={CONDICAO_DEVOLUCAO_INFO[i.condicao as CondicaoDevolucao]?.variant}
              >
                {CONDICAO_DEVOLUCAO_INFO[i.condicao as CondicaoDevolucao]?.label ??
                  i.condicao}
              </Badge>
              {podeEditar ? (
                <ConfirmDelete
                  action={excluirDevolucaoItem}
                  id={i.id}
                  hidden={{ devolucao_id: devolucaoId }}
                  mensagem="Remover este item da devolução?"
                />
              ) : null}
            </div>
          ))}
        </div>
      )}

      {podeEditar ? (
        oferecidos.length === 0 ? (
          // Distinguir os dois casos importa: "tudo já lançado" é sucesso e o
          // próximo passo é fechar; "nada em aberto" quer dizer que o contrato
          // já foi devolvido por inteiro em outro documento.
          <p className="text-sm text-muted-foreground">
            {itens.length > 0
              ? "Todos os itens com saldo em aberto já estão nesta devolução."
              : "Este contrato não tem item com saldo em aberto para devolver."}
          </p>
        ) : lancando ? (
          <div className="rounded-lg border border-dashed p-3">
            <ItemForm
              devolucaoId={devolucaoId}
              oferecidos={oferecidos}
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
  devolucaoId,
  oferecidos,
  aoConcluir,
}: {
  devolucaoId: string;
  oferecidos: ItemComSaldo[];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const [escolha, setEscolha] = useState<string>(
    oferecidos[0]?.item_locado_id ?? "",
  );
  const [condicao, setCondicao] = useState<CondicaoDevolucao>("ok");

  const item = useMemo(
    () => oferecidos.find((o) => o.item_locado_id === escolha),
    [oferecidos, escolha],
  );

  const exigeObservacao = condicao !== "ok";

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarDevolucaoItem({
        devolucao_id: devolucaoId,
        item_locado_id: escolha,
        // A peça vem do PRÓPRIO item do contrato, não de um seletor: na
        // devolução não há o que escolher. O que voltou é a peça que saiu, e
        // oferecer uma lista permitiria devolver ao contrato A a betoneira que
        // saiu no contrato B.
        unidade_id: item?.unidade_id ?? null,
        quantidade: String(fd.get("quantidade") ?? ""),
        condicao,
        observacoes: String(fd.get("observacoes") ?? ""),
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
        <Label htmlFor="escolha">Item devolvido</Label>
        <NativeSelect
          id="escolha"
          value={escolha}
          onChange={(e) => setEscolha(e.target.value)}
          disabled={pendente}
        >
          {oferecidos.map((o) => (
            <option key={o.item_locado_id} value={o.item_locado_id}>
              {o.descricao}
              {o.unidade_identificador ? ` (${o.unidade_identificador})` : ""} —{" "}
              {o.saldo} em aberto
            </option>
          ))}
        </NativeSelect>
        {item ? (
          <p className="text-xs text-muted-foreground">
            Contratado {item.contratado} · já devolvido {item.devolvido} ·{" "}
            <strong>{item.saldo} em aberto</strong>.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quantidade">Quantidade devolvida</Label>
        <Input
          id="quantidade"
          name="quantidade"
          type="number"
          step="0.01"
          min="0.01"
          // `max` é ORIENTAÇÃO, não garantia: o saldo pode mudar entre montar o
          // rascunho e fechar, e é o fechamento que confere de verdade. Um
          // `max` sozinho daria a falsa impressão de que passou.
          max={item?.saldo}
          required
          inputMode="decimal"
          defaultValue={item?.saldo ?? ""}
          disabled={pendente}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="condicao">Condição</Label>
        <NativeSelect
          id="condicao"
          value={condicao}
          onChange={(e) => setCondicao(e.target.value as CondicaoDevolucao)}
          disabled={pendente}
        >
          {CONDICOES_DEVOLUCAO.map((c) => (
            <option key={c} value={c}>
              {CONDICAO_DEVOLUCAO_INFO[c].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {CONDICAO_DEVOLUCAO_INFO[condicao].ajuda}
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
              ? "É sobre este texto que a cobrança de reposição vai ser discutida."
              : "Opcional."
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendente || !escolha}>
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
