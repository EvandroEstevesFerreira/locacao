"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { salvarFuncionario } from "../actions";
import type { FuncionarioLinha } from "@/lib/data/termo";

export function FuncionarioForm({
  funcionario,
  obras,
}: {
  funcionario?: FuncionarioLinha;
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const [estado, acao, pendente] = useActionState(salvarFuncionario, null);

  useEffect(() => {
    if (estado?.ok) toast.success("Funcionário salvo.");
    if (estado && !estado.ok) toast.error(estado.erro);
  }, [estado]);

  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2">
      {funcionario ? <input type="hidden" name="id" value={funcionario.id} /> : null}
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Nome</span>
        <Input name="nome" defaultValue={funcionario?.nome} required maxLength={200} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">CPF</span>
        <Input name="cpf" defaultValue={funcionario?.cpf ?? ""} maxLength={20} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Cargo</span>
        <Input name="cargo" defaultValue={funcionario?.cargo ?? ""} maxLength={100} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Matrícula</span>
        <Input name="matricula" defaultValue={funcionario?.matricula ?? ""} maxLength={40} />
      </label>
      <label className="grid gap-1">
        <span className="text-xs text-muted-foreground">Telefone</span>
        <Input name="telefone" defaultValue={funcionario?.telefone ?? ""} maxLength={40} />
      </label>
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">Obra de lotação</span>
        <select
          name="obra_id"
          defaultValue={funcionario?.obra_id ?? ""}
          className="h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none"
        >
          <option value="">Sem obra definida</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} — {o.nome}
            </option>
          ))}
        </select>
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar funcionário"}
        </Button>
      </div>
    </form>
  );
}
