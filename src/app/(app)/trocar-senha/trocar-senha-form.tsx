"use client";

import { useActionState } from "react";
import { trocarSenha, type TrocarSenhaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState<TrocarSenhaState, FormData>(trocarSenha, {});
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="senha">Nova senha</Label>
        <Input id="senha" name="senha" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmar">Confirmar nova senha</Label>
        <Input id="confirmar" name="confirmar" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Definir nova senha"}
      </Button>
    </form>
  );
}
