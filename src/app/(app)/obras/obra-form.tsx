"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarObra, type ObraFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Obra = {
  id: string;
  codigo: string;
  nome: string;
  endereco: string | null;
  responsavel: string | null;
  centro_custo: string | null;
  status: "ativa" | "pausada" | "encerrada";
};

const selectClasses =
  "flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ObraForm({ obra }: { obra?: Obra }) {
  const [state, formAction, isPending] = useActionState<ObraFormState, FormData>(
    salvarObra,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {obra ? <input type="hidden" name="id" value={obra.id} /> : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="codigo">Código *</Label>
          <Input
            id="codigo"
            name="codigo"
            required
            maxLength={50}
            defaultValue={obra?.codigo ?? ""}
            placeholder="Ex.: OB-001"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={obra?.status ?? "ativa"}
            className={selectClasses}
          >
            <option value="ativa">Ativa</option>
            <option value="pausada">Pausada</option>
            <option value="encerrada">Encerrada</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="nome">Nome *</Label>
        <Input
          id="nome"
          name="nome"
          required
          maxLength={200}
          defaultValue={obra?.nome ?? ""}
          placeholder="Ex.: Edifício Aurora"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endereco">Endereço</Label>
        <Input
          id="endereco"
          name="endereco"
          maxLength={300}
          defaultValue={obra?.endereco ?? ""}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="responsavel">Responsável</Label>
          <Input
            id="responsavel"
            name="responsavel"
            maxLength={200}
            defaultValue={obra?.responsavel ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="centro_custo">Centro de custo</Label>
          <Input
            id="centro_custo"
            name="centro_custo"
            maxLength={100}
            defaultValue={obra?.centro_custo ?? ""}
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/obras" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
