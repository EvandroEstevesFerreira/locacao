"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarUsuario, type UsuarioFormState } from "./actions";
import { PAPEIS, PAPEL_INFO, type Papel } from "@/lib/permissoes";
import { MODULOS } from "@/lib/modulos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function UsuarioForm({
  usuario,
  obras,
  obrasDoUsuario,
  modulosDoUsuario,
}: {
  usuario: { id: string; nome: string; email: string; papel: Papel; ativo: boolean };
  obras: { id: string; codigo: string; nome: string }[];
  obrasDoUsuario: string[];
  /** null = acesso a todos os módulos (padrão retrocompatível). */
  modulosDoUsuario: string[] | null;
}) {
  // null → todos liberados por padrão (marca todas as caixas).
  const todosMarcados = modulosDoUsuario == null;
  const [state, formAction, isPending] = useActionState<
    UsuarioFormState,
    FormData
  >(salvarUsuario, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={usuario.id} />

      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={usuario.nome} required maxLength={120} />
        <p className="text-xs text-muted-foreground">{usuario.email}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="papel">Perfil</Label>
        <select
          id="papel"
          name="papel"
          defaultValue={usuario.papel}
          className={selectClasses}
        >
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {PAPEL_INFO[p].label} — {PAPEL_INFO[p].descricao}
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
        <Label htmlFor="nova_senha">Redefinir senha (opcional)</Label>
        <Input
          id="nova_senha"
          name="nova_senha"
          type="text"
          minLength={8}
          placeholder="Deixe em branco para manter a senha atual"
        />
      </div>

      <div className="space-y-2">
        <Label>Acesso por módulo</Label>
        <p className="text-xs text-muted-foreground">
          Marque os módulos que este usuário pode acessar. Se nenhum for marcado,
          ele terá acesso a todos. O Master sempre acessa tudo.
        </p>
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
          {MODULOS.map((m) => (
            <label key={m.chave} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="modulos"
                value={m.chave}
                defaultChecked={todosMarcados || (modulosDoUsuario?.includes(m.chave) ?? false)}
                className="size-4"
              />
              <span className="font-medium">{m.label}</span>
            </label>
          ))}
        </div>
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
