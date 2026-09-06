"use client";

// As frentes de serviço da obra.
//
// O cadastro é POR OBRA e feito aqui, dentro da obra, e não numa tela de
// Configurações: "Fundação" na obra A e "Fundação" na obra B são frentes
// diferentes, com equipe, prazo e custo próprios. Uma lista global obrigaria a
// inventar nomes únicos ("Fundação — Unimed Maceió") e o seletor de cada obra
// ofereceria as frentes de todas as outras.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, X, Layers } from "lucide-react";
import { toast } from "sonner";
import type { FrenteLinha } from "@/lib/data/frentes";
import { salvarFrente, excluirFrente } from "../../frente-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function BlocoFrentes({
  obraId,
  frentes,
  podeEditar,
}: {
  obraId: string;
  frentes: FrenteLinha[];
  podeEditar: boolean;
}) {
  const [criando, setCriando] = useState(false);
  const alocados = frentes.reduce((s, f) => s + f.itens, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Frentes de serviço</CardTitle>
        <CardDescription>
          {frentes.length === 0 ? (
            <>
              Sem frentes, o custo do equipamento morre na obra: sabe-se que a
              obra gastou, não em quê. Com elas, ele desce ao serviço.
            </>
          ) : (
            <>
              {frentes.length} {frentes.length === 1 ? "frente" : "frentes"}
              {alocados > 0
                ? ` · ${alocados} ${alocados === 1 ? "item alocado" : "itens alocados"}`
                : " · nenhum item alocado ainda"}
              .
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {frentes.length > 0 ? (
          <div className="divide-y rounded-md border">
            {frentes.map((f) => (
              <LinhaFrente
                key={f.id}
                obraId={obraId}
                frente={f}
                podeEditar={podeEditar}
              />
            ))}
          </div>
        ) : null}

        {podeEditar ? (
          criando ? (
            <div className="rounded-md border border-dashed p-3">
              <FrenteForm obraId={obraId} aoConcluir={() => setCriando(false)} />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setCriando(true)}>
              {frentes.length === 0 ? (
                <Layers className="size-3.5" aria-hidden />
              ) : (
                <Plus className="size-3.5" aria-hidden />
              )}
              Nova frente
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function LinhaFrente({
  obraId,
  frente,
  podeEditar,
}: {
  obraId: string;
  frente: FrenteLinha;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1 font-medium">
          {frente.nome}
          {!frente.ativo ? (
            <Badge variant="outline" className="ml-2">
              Encerrada
            </Badge>
          ) : null}
          {frente.itens > 0 ? (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {frente.itens} {frente.itens === 1 ? "item" : "itens"}
            </span>
          ) : null}
        </span>

        {podeEditar ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar frente"
              onClick={() => setEditando((v) => !v)}
            >
              <Pencil className="size-3.5" />
            </Button>
            {/* Frente com item alocado não se exclui — a action recusa e manda
                desativar. Excluir não quebraria nada (a FK é `set null`), mas os
                itens perderiam a alocação em silêncio e o relatório por frente
                encolheria sem explicação. */}
            <ConfirmDelete
              action={excluirFrente}
              id={frente.id}
              hidden={{ obra_id: obraId }}
              mensagem={`Excluir a frente “${frente.nome}”?`}
            />
          </>
        ) : null}
      </div>

      {editando ? (
        <div className="border-t bg-muted/30 p-3">
          <FrenteForm
            obraId={obraId}
            frente={frente}
            aoConcluir={() => setEditando(false)}
          />
        </div>
      ) : null}
    </div>
  );
}

function FrenteForm({
  obraId,
  frente,
  aoConcluir,
}: {
  obraId: string;
  frente?: FrenteLinha;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarFrente({
        id: frente?.id,
        obra_id: obraId,
        nome: String(fd.get("nome") ?? ""),
        ativo: fd.get("ativo") === "on",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(frente ? "Frente salva." : "Frente criada.");
      aoConcluir();
      router.refresh();
    });
  }

  const chave = frente?.id ?? "nova";

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor={`frente-${chave}`}>Nome da frente</Label>
        <Input
          id={`frente-${chave}`}
          name="nome"
          required
          maxLength={60}
          disabled={pendente}
          defaultValue={frente?.nome ?? ""}
          placeholder="Ex.: Fundação, Estrutura, Acabamento"
        />
      </div>

      <label className="flex items-center gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          className="size-4"
          disabled={pendente}
          defaultChecked={frente?.ativo ?? true}
        />
        Em andamento
      </label>

      <Button type="submit" size="sm" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar"}
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
        <X className="size-3.5" aria-hidden />
        Cancelar
      </Button>
      {erro ? <p className="w-full text-sm text-destructive">{erro}</p> : null}
    </form>
  );
}
