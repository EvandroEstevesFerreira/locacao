"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PAPEIS,
  PAPEL_INFO,
  criarUsuarioSchema,
  type CriarUsuarioInput,
} from "@/lib/permissoes";
import { MODULOS } from "@/lib/modulos";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { criarUsuario } from "./actions";

export function UsuarioNovoForm({
  obras,
}: {
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CriarUsuarioInput>({
    resolver: zodResolver(criarUsuarioSchema),
    defaultValues: {
      nome: "",
      email: "",
      papel: "operador",
      senha: "",
      obras: [],
      // Todos os módulos marcados por padrão, como antes.
      modulos: MODULOS.map((m) => m.chave),
    },
  });

  function onSubmit(values: CriarUsuarioInput) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await criarUsuario(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Usuário criado.", {
        description: "Um e-mail com os dados de acesso foi enviado.",
      });
      router.replace("/usuarios");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          aria-invalid={!!errors.nome}
          disabled={pendente}
          {...register("nome")}
        />
        {errors.nome ? (
          <p className="text-xs text-destructive">{errors.nome.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          aria-invalid={!!errors.email}
          disabled={pendente}
          {...register("email")}
        />
        {errors.email ? (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="papel">Perfil</Label>
        <NativeSelect id="papel" disabled={pendente} {...register("papel")}>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>
              {PAPEL_INFO[p].label} — {PAPEL_INFO[p].descricao}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="senha">Senha temporária</Label>
        <Input
          id="senha"
          type="text"
          placeholder="Ao menos 8 caracteres"
          aria-invalid={!!errors.senha}
          disabled={pendente}
          {...register("senha")}
        />
        {errors.senha ? (
          <p className="text-xs text-destructive">{errors.senha.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            O usuário entra com esta senha e é obrigado a trocá-la no primeiro
            acesso.
          </p>
        )}
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
                value={m.chave}
                disabled={pendente}
                className="size-4"
                {...register("modulos")}
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
          <p className="text-sm text-muted-foreground">Nenhuma obra cadastrada.</p>
        ) : (
          <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
            {obras.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value={o.id}
                  disabled={pendente}
                  className="size-4"
                  {...register("obras")}
                />
                <span>
                  <span className="font-medium">{o.codigo}</span> — {o.nome}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" render={<Link href="/usuarios" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Criando…" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
