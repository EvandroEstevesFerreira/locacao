"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SistengeLogo } from "@/components/sistenge-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export function RecuperarForm() {
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [enviado, setEnviado] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/nova-senha`,
      });
      if (error) {
        toast.error("Não foi possível enviar o e-mail", {
          description: "Tente novamente em instantes.",
        });
        return;
      }
      // Não revelamos se o e-mail existe ou não (segurança).
      setEnviado(true);
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-3 text-center">
        <SistengeLogo className="mx-auto h-9 w-auto" />
        <CardDescription>Recuperar acesso</CardDescription>
      </CardHeader>
      <CardContent>
        {enviado ? (
          <div className="space-y-4 text-sm">
            <p>
              Se houver uma conta para <strong>{email}</strong>, enviamos um
              link para redefinir a senha. Verifique sua caixa de entrada (e o
              spam).
            </p>
            <Button variant="outline" className="w-full" render={<Link href="/login" />}>
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe seu e-mail e enviaremos um link para você criar uma nova
              senha.
            </p>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@sistenge.com"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "Enviando…" : "Enviar link de redefinição"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              render={<Link href="/login" />}
            >
              Voltar ao login
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
