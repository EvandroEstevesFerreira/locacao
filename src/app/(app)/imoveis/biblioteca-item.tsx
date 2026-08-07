"use client";

import { useActionState, useEffect, useState } from "react";
import { FileText, Download, Pencil, X } from "lucide-react";
import {
  atualizarDocumentoBiblioteca,
  excluirDocumentoBiblioteca,
  type ImovelFormState,
} from "./actions";
import {
  CATEGORIAS_BIBLIOTECA,
  CATEGORIA_BIBLIOTECA_INFO,
} from "@/lib/biblioteca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDelete } from "@/components/confirm-delete";
import { NativeSelect } from "@/components/ui/native-select";


export function BibliotecaItem({
  doc,
  downloadUrl,
  dataLabel,
  podeEditar,
}: {
  doc: { id: string; categoria: string; titulo: string; descricao: string | null; path: string };
  downloadUrl?: string;
  dataLabel: string;
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(
    atualizarDocumentoBiblioteca,
    {},
  );

  useEffect(() => {
    // Fecha o formulário ao concluir o salvamento com sucesso.
    if (state.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditando(false);
    }
  }, [state.ok]);

  if (editando) {
    return (
      <form
        action={formAction}
        className="grid gap-2 border-b py-3 last:border-0 sm:grid-cols-[1fr_1fr_auto]"
      >
        <input type="hidden" name="id" value={doc.id} />
        <div className="space-y-1">
          <Label htmlFor={`t-${doc.id}`}>Título</Label>
          <Input id={`t-${doc.id}`} name="titulo" defaultValue={doc.titulo} required maxLength={160} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`d-${doc.id}`}>Descrição</Label>
          <Input id={`d-${doc.id}`} name="descricao" defaultValue={doc.descricao ?? ""} maxLength={200} />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`c-${doc.id}`}>Categoria</Label>
          <NativeSelect id={`c-${doc.id}`} name="categoria" defaultValue={doc.categoria}>
            {CATEGORIAS_BIBLIOTECA.map((c) => (
              <option key={c} value={c}>{CATEGORIA_BIBLIOTECA_INFO[c].label}</option>
            ))}
          </NativeSelect>
        </div>
        {state.error ? (
          <p className="text-sm text-destructive sm:col-span-3">{state.error}</p>
        ) : null}
        <div className="flex items-center gap-2 sm:col-span-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditando(false)}>
            <X className="size-4" /> Cancelar
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0">
      <div className="flex min-w-0 items-start gap-2">
        <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium">{doc.titulo}</p>
          {doc.descricao ? (
            <p className="text-sm text-muted-foreground">{doc.descricao}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">{dataLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {downloadUrl ? (
          <Button
            variant="secondary"
            size="sm"
            render={<a href={downloadUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <Download className="size-4" /> Baixar
          </Button>
        ) : null}
        {podeEditar ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Editar"
              onClick={() => setEditando(true)}
            >
              <Pencil />
            </Button>
            <ConfirmDelete
              action={excluirDocumentoBiblioteca}
              id={doc.id}
              hidden={{ path: doc.path }}
              mensagem="Remover este documento da biblioteca?"
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
