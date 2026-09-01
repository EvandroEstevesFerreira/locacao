"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trocarSenhaSchema, type TrocarSenhaInput } from "@/lib/permissoes";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trocarSenha } from "./actions";

export function TrocarSenhaForm() {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrocarSenhaInput>({
    resolver: zodResolver(trocarSenhaSchema),
    defaultValues: { senha: "", confirmar: "" },
  });

  function onSubmit(values: TrocarSenhaInput) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await trocarSenha(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Senha alterada.");
      // A navegação é do cliente: a action não pode redirecionar e devolver
      // ActionResult ao mesmo tempo.
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="senha">Nova senha</Label>
        <Input
          id="senha"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.senha}
          disabled={pendente}
          {...register("senha")}
        />
        {errors.senha ? (
          <p className="text-xs text-destructive">{errors.senha.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirmar">Confirmar nova senha</Label>
        <Input
          id="confirmar"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.confirmar}
          disabled={pendente}
          {...register("confirmar")}
        />
        {errors.confirmar ? (
          <p className="text-xs text-destructive">{errors.confirmar.message}</p>
        ) : null}
      </div>

      <FormError>{erroServidor}</FormError>

      <Button type="submit" disabled={pendente} className="w-full">
        {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
        {pendente ? "Salvando…" : "Definir nova senha"}
      </Button>
    </form>
  );
}
