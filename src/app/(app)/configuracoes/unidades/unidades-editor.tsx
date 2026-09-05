"use client";

// Cadastro de unidades de medida.
//
// Existe porque `item_catalogo.unidade` era campo livre com sugestões, e campo
// livre de unidade sempre vira "un", "UN", "unid" e "unidade" convivendo na
// mesma tabela — e aí nenhum relatório soma direito.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import type { UnidadeOpcao } from "@/lib/data/catalogo";
import { salvarUnidade, excluirUnidade } from "../catalogo/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function UnidadesEditor({
  unidades,
  podeEditar,
}: {
  unidades: UnidadeOpcao[];
  podeEditar: boolean;
}) {
  const [criando, setCriando] = useState(false);

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-lg border">
        {unidades.map((u) => (
          <LinhaUnidade key={u.id} unidade={u} podeEditar={podeEditar} />
        ))}
        {unidades.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma unidade cadastrada.
          </p>
        ) : null}
      </div>

      {podeEditar ? (
        criando ? (
          <div className="rounded-lg border border-dashed p-4">
            <UnidadeForm aoConcluir={() => setCriando(false)} />
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setCriando(true)}>
            <Plus className="size-3.5" aria-hidden />
            Nova unidade
          </Button>
        )
      ) : null}
    </div>
  );
}

function LinhaUnidade({
  unidade,
  podeEditar,
}: {
  unidade: UnidadeOpcao;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <span className="w-16 shrink-0 font-medium tabular-nums">
          {unidade.simbolo}
        </span>
        <span className="min-w-0 flex-1 text-muted-foreground">{unidade.nome}</span>
        {!unidade.ativo ? <Badge variant="outline">Inativa</Badge> : null}

        {podeEditar ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar unidade"
              onClick={() => setEditando((v) => !v)}
            >
              <Pencil className="size-3.5" />
            </Button>
            {/* O símbolo vai junto: a action precisa dele para contar quantos
                itens o usam. `item_catalogo.unidade` guarda o SÍMBOLO em texto,
                não uma FK — excluir não quebra o banco, mas deixa itens
                exibindo algo que já não existe na lista. */}
            <ConfirmDelete
              action={excluirUnidade}
              id={unidade.id}
              hidden={{ simbolo: unidade.simbolo }}
              mensagem={`Excluir a unidade “${unidade.simbolo}”?`}
            />
          </>
        ) : null}
      </div>

      {editando ? (
        <div className="border-t bg-muted/30 p-3">
          <UnidadeForm unidade={unidade} aoConcluir={() => setEditando(false)} />
        </div>
      ) : null}
    </div>
  );
}

function UnidadeForm({
  unidade,
  aoConcluir,
}: {
  unidade?: UnidadeOpcao;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarUnidade({
        id: unidade?.id,
        simbolo: String(fd.get("simbolo") ?? ""),
        nome: String(fd.get("nome") ?? ""),
        ordem: String(fd.get("ordem") ?? "0"),
        ativo: fd.get("ativo") === "on",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(unidade ? "Unidade salva." : "Unidade criada.");
      aoConcluir();
      router.refresh();
    });
  }

  const chave = unidade?.id ?? "nova";

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor={`sim-${chave}`}>Símbolo</Label>
        <Input
          id={`sim-${chave}`}
          name="simbolo"
          required
          maxLength={10}
          disabled={pendente}
          defaultValue={unidade?.simbolo ?? ""}
          placeholder="un"
        />
        {/* Sem caixa alta automática, de propósito: "m" e "M" querem dizer
            metro e mega, e "L" é litro enquanto "l" é ambíguo. Normalizar aqui
            destruiria a distinção que a unidade carrega. */}
        <p className="text-xs text-muted-foreground">
          Como aparece no cadastro. Maiúscula e minúscula importam.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`nome-${chave}`}>Nome por extenso</Label>
        <Input
          id={`nome-${chave}`}
          name="nome"
          required
          maxLength={40}
          disabled={pendente}
          defaultValue={unidade?.nome ?? ""}
          placeholder="unidade"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ordem-${chave}`}>Ordem</Label>
        <Input
          id={`ordem-${chave}`}
          name="ordem"
          type="number"
          min="0"
          max="999"
          step="10"
          inputMode="numeric"
          disabled={pendente}
          defaultValue={unidade?.ordem ?? 0}
        />
        <p className="text-xs text-muted-foreground">
          Menor vem primeiro no seletor.
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input
          type="checkbox"
          name="ativo"
          className="size-4"
          disabled={pendente}
          defaultChecked={unidade?.ativo ?? true}
        />
        Unidade ativa
        <span className="text-xs text-muted-foreground">
          — inativa some do cadastro de item, sem apagar o que já a usa.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar unidade"}
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
