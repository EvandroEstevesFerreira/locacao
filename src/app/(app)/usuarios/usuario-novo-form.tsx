"use client";

import { useActionState } from "react";
import Link from "next/link";
import { criarUsuario, type UsuarioFormState } from "./actions";
import { PAPEIS, PAPEL_INFO } from "@/lib/permissoes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UsuarioNovoForm({
  obras,
}: {
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const [state, formAction, isPending] = useActionState<
    UsuarioFormState,
    FormData
  >(criarUsuario, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" required maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="papel">Perfil</Label>
        <select
          id="papel"
          name="papel"
          defaultValue="operador"
          className={selectClasses}
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {PAPEL_INFO[p].label} — {PAPEL_INFO[p].descricao}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="senha">Senha temporária</Label>
        <Input
          id="senha"
          name="senha"
          type="text"
          required
          minLength={8}
          placeholder="Ao menos 8 caracteres"
        />
        <p className="text-xs text-muted-foreground">
          O usuário entra com esta senha e pode trocá-la depois.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Acesso por obra</Label>
        <p className="text-xs text-muted-foreground">
          Aplica-se a Gestor e Operador. Master e Administrador enxergam todas as
          obras.
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
          {isPending ? "Criando…" : "Criar usuário"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/usuarios" />}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
