"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

export function NovaSenhaForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pronto, setPronto] = useState<boolean | null>(null); // null = verificando
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");

  // Verifica se o link de recuperação estabeleceu uma sessão válida.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setPronto(Boolean(data.session));
    });
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("Senha muito curta", {
        description: "Use pelo menos 8 caracteres.",
      });
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        toast.error("Não foi possível alterar a senha", {
          description: "O link pode ter expirado. Solicite um novo.",
        });
        return;
      }
      toast.success("Senha atualizada", {
        description: "Você já está conectado.",
      });
      router.refresh();
      router.replace("/");
    });
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="space-y-3 text-center">
        <SistengeLogo className="mx-auto h-9 w-auto" />
        <CardDescription>Definir nova senha</CardDescription>
      </CardHeader>
      <CardContent>
        {pronto === false ? (
          <div className="space-y-4 text-sm">
            <p>
              Este link é inválido ou expirou. Solicite um novo link de
              redefinição.
            </p>
            <Button
              variant="outline"
              className="w-full"
              render={<Link href="/auth/recuperar" />}
            >
              Solicitar novo link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input
                id="senha"
                type="password"
                autoComplete="new-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Pelo menos 8 caracteres"
                disabled={pronto === null}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                autoComplete="new-password"
                required
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                disabled={pronto === null}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isPending || pronto === null}
            >
              {pronto === null
                ? "Validando link…"
                : isPending
                  ? "Salvando…"
                  : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
