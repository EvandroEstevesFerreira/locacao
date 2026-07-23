"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarUsuario, type UsuarioFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Papel =
  | "admin"
  | "gestor"
  | "financeiro"
  | "operacional"
  | "visualizador";

const PAPEIS: { valor: Papel; label: string }[] = [
  { valor: "admin", label: "Administrador — acesso total" },
  { valor: "gestor", label: "Gestor — obras que administra" },
  { valor: "financeiro", label: "Financeiro — financeiro e relatórios" },
  { valor: "operacional", label: "Operacional — movimentação e vistoria" },
  { valor: "visualizador", label: "Visualizador — somente leitura" },
];

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UsuarioForm({
  usuario,
  obras,
  obrasDoUsuario,
}: {
  usuario: { id: string; papel: Papel; ativo: boolean };
  obras: { id: string; codigo: string; nome: string }[];
  obrasDoUsuario: string[];
}) {
  const [state, formAction, isPending] = useActionState<
    UsuarioFormState,
    FormData
  >(salvarUsuario, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={usuario.id} />

      <div className="space-y-2">
        <Label htmlFor="papel">Papel</Label>
        <select
          id="papel"
          name="papel"
          defaultValue={usuario.papel}
          className={selectClasses}
        >
          {PAPEIS.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={usuario.ativo}
          className="size-4"
        />
        Usuário ativo
      </label>

      <div className="space-y-2">
        <Label>Acesso por obra</Label>
        <p className="text-xs text-muted-foreground">
          Aplica-se a gestores e operacionais. Administradores e financeiro
          enxergam todas as obras.
        </p>
        {obras.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma obra cadastrada.
          </p>
        ) : (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            {obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="obras"
                  value={o.id}
                  defaultChecked={obrasDoUsuario.includes(o.id)}
                  className="size-4"
                />
                <span>
                  <span className="font-medium">{o.codigo}</span> — {o.nome}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/usuarios" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
