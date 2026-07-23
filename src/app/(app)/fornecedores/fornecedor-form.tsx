"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { salvarFornecedor, type FornecedorFormState } from "./actions";
import { formatarCnpj } from "@/lib/cnpj";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Fornecedor = {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  observacoes: string | null;
  ativo: boolean;
};

export function FornecedorForm({ fornecedor }: { fornecedor?: Fornecedor }) {
  const [state, formAction, isPending] = useActionState<
    FornecedorFormState,
    FormData
  >(salvarFornecedor, {});
  const [cnpj, setCnpj] = useState(fornecedor?.cnpj ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {fornecedor ? <input type="hidden" name="id" value={fornecedor.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome *</Label>
          <Input
            id="nome"
            name="nome"
            required
            maxLength={200}
            defaultValue={fornecedor?.nome ?? ""}
            placeholder="Ex.: Locadora Alfa"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input
            id="cnpj"
            name="cnpj"
            inputMode="text"
            autoCapitalize="characters"
            maxLength={18}
            value={cnpj}
            onChange={(e) => setCnpj(formatarCnpj(e.target.value))}
            placeholder="12.ABC.345/01DE-35"
          />
          <p className="text-xs text-muted-foreground">
            Aceita o CNPJ alfanumérico (letras e números).
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="contato_nome">Contato</Label>
          <Input
            id="contato_nome"
            name="contato_nome"
            maxLength={200}
            defaultValue={fornecedor?.contato_nome ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato_telefone">Telefone</Label>
          <Input
            id="contato_telefone"
            name="contato_telefone"
            maxLength={40}
            defaultValue={fornecedor?.contato_telefone ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contato_email">E-mail</Label>
          <Input
            id="contato_email"
            name="contato_email"
            type="email"
            maxLength={200}
            defaultValue={fornecedor?.contato_email ?? ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          maxLength={1000}
          rows={3}
          defaultValue={fornecedor?.observacoes ?? ""}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="ativo"
          defaultChecked={fornecedor?.ativo ?? true}
          className="size-4"
        />
        Fornecedor ativo
      </label>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          render={<Link href="/fornecedores" />}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
