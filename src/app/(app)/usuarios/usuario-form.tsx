"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  PAPEIS,
  PAPEL_INFO,
  editarUsuarioSchema,
  type EditarUsuarioDados,
  type EditarUsuarioInput,
  type Papel,
} from "@/lib/permissoes";
import { MODULOS, GRUPOS_MODULO, type ModuloKey } from "@/lib/modulos";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarUsuario } from "./actions";

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
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // null → todos liberados por padrão (marca todas as caixas).
  const modulosIniciais =
    modulosDoUsuario == null ? MODULOS.map((m) => m.chave) : modulosDoUsuario;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
    // Três parâmetros: `nova_senha` transforma "" em null, então a entrada e a
    // saída do schema divergem.
  } = useForm<EditarUsuarioInput, unknown, EditarUsuarioDados>({
    resolver: zodResolver(editarUsuarioSchema),
    defaultValues: {
      id: usuario.id,
      nome: usuario.nome,
      papel: usuario.papel,
      ativo: usuario.ativo,
      obras: obrasDoUsuario,
      modulos: modulosIniciais,
      nova_senha: "",
    },
  });

  // O que está marcado agora, para o botão do grupo saber se marca ou desmarca.
  const marcados = useWatch({ control, name: "modulos" }) ?? [];

  function onSubmit(values: EditarUsuarioDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarUsuario(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Usuário atualizado.");
      if (r.aviso) toast.warning(r.aviso, { duration: 10000 });
      router.replace("/usuarios");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-5">
      <input type="hidden" {...register("id")} />

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
        ) : (
          <p className="text-xs text-muted-foreground">{usuario.email}</p>
        )}
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

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          disabled={pendente}
          className="size-4"
          {...register("ativo")}
        />
        Usuário ativo
      </label>

      <div className="space-y-1.5">
        <Label htmlFor="nova_senha">
          Redefinir senha{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="nova_senha"
          type="text"
          placeholder="Deixe em branco para manter a senha atual"
          aria-invalid={!!errors.nova_senha}
          disabled={pendente}
          {...register("nova_senha")}
        />
        {errors.nova_senha ? (
          <p className="text-xs text-destructive">{errors.nova_senha.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            A senha definida aqui é temporária: o usuário troca no próximo acesso.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Acesso por módulo</Label>
        <p className="text-xs text-muted-foreground">
          Marque os módulos que este usuário pode acessar. Se nenhum for marcado,
          ele terá acesso a todos. O Master sempre acessa tudo.
        </p>
        <div className="space-y-3 rounded-md border p-3">
          {GRUPOS_MODULO.map((grupo) => {
            const doGrupo = MODULOS.filter((m) => m.grupo === grupo);
            const chaves = doGrupo.map((m) => m.chave);
            const todosMarcados = chaves.every((c) => marcados.includes(c));
            return (
              <div key={grupo}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {grupo}
                  </span>
                  {/* O grupo é um ATALHO DE QUEM MARCA, não um vínculo entre os
                      módulos. Cada um continua gravado e auditável sozinho. */}
                  <button
                    type="button"
                    disabled={pendente}
                    onClick={() =>
                      setValue(
                        "modulos",
                        todosMarcados
                          ? marcados.filter((c) => !chaves.includes(c as ModuloKey))
                          : [...new Set([...marcados, ...chaves])],
                        { shouldDirty: true },
                      )
                    }
                    className="text-xs text-primary underline underline-offset-4"
                  >
                    {todosMarcados ? "Desmarcar grupo" : "Marcar grupo"}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {doGrupo.map((m) => (
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
            );
          })}
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
          {pendente ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
