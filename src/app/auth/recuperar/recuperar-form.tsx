"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  // Devolve só o conteúdo: o cartão e o título são da AuthShell.
  if (enviado) {
    return (
      <div className="space-y-4 text-sm">
        <p>
          Se houver uma conta para <strong>{email}</strong>, enviamos um link
          para redefinir a senha. Verifique sua caixa de entrada (e o spam).
        </p>
        <Button variant="outline" className="w-full" render={<Link href="/login" />}>
          Voltar ao login
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
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
  );
}
