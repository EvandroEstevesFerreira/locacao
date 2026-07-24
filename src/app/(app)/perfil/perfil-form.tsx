"use client";

import { useActionState } from "react";
import { atualizarMeuPerfil, type PerfilFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PerfilForm({ nome }: { nome: string }) {
  const [state, formAction, isPending] = useActionState<
    PerfilFormState,
    FormData
  >(atualizarMeuPerfil, {});

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome</Label>
        <Input id="nome" name="nome" defaultValue={nome} required maxLength={120} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="nova_senha">Alterar senha (opcional)</Label>
        <Input
          id="nova_senha"
          name="nova_senha"
          type="password"
          minLength={8}
          placeholder="Deixe em branco para manter a senha atual"
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">Ao menos 8 caracteres.</p>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-primary">Perfil atualizado.</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
