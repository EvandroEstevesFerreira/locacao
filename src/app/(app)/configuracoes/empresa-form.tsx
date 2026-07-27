"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarEmpresa, type ConfigFormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type EmpresaDados = {
  nome?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  inscricao_estadual?: string | null;
  inscricao_municipal?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  site?: string | null;
  representante_nome?: string | null;
  representante_cargo?: string | null;
  representante_cpf?: string | null;
  responsaveis?: string | null;
  observacoes?: string | null;
};

function Campo({
  name,
  label,
  defaultValue,
  type = "text",
  placeholder,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} />
    </div>
  );
}

export function EmpresaForm({ empresa }: { empresa: EmpresaDados }) {
  const [state, formAction, isPending] = useActionState<ConfigFormState, FormData>(
    salvarEmpresa,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo name="nome" label="Nome (curto) *" defaultValue={empresa.nome} placeholder="Sistenge" />
          <Campo name="razao_social" label="Razão social" defaultValue={empresa.razao_social} />
          <Campo name="nome_fantasia" label="Nome fantasia" defaultValue={empresa.nome_fantasia} />
          <Campo name="cnpj" label="CNPJ" defaultValue={empresa.cnpj} placeholder="00.000.000/0000-00" />
          <Campo name="inscricao_estadual" label="Inscrição estadual" defaultValue={empresa.inscricao_estadual} />
          <Campo name="inscricao_municipal" label="Inscrição municipal" defaultValue={empresa.inscricao_municipal} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo name="endereco" label="Logradouro" defaultValue={empresa.endereco} className="sm:col-span-2" />
          <Campo name="cidade" label="Cidade" defaultValue={empresa.cidade} />
          <Campo name="uf" label="UF" defaultValue={empresa.uf} />
          <Campo name="cep" label="CEP" defaultValue={empresa.cep} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Contatos</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo name="telefone" label="Telefone" defaultValue={empresa.telefone} />
          <Campo name="email" label="E-mail" type="email" defaultValue={empresa.email} />
          <Campo name="site" label="Site" defaultValue={empresa.site} />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Representante legal (assinatura dos contratos)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo name="representante_nome" label="Nome" defaultValue={empresa.representante_nome} />
          <Campo name="representante_cargo" label="Cargo" defaultValue={empresa.representante_cargo} />
          <Campo name="representante_cpf" label="CPF" defaultValue={empresa.representante_cpf} />
        </div>
      </fieldset>

      <div className="space-y-2 border-t pt-4">
        <Label htmlFor="responsaveis">Responsáveis / demais contatos</Label>
        <Textarea id="responsaveis" name="responsaveis" rows={2} defaultValue={empresa.responsaveis ?? ""} placeholder="Ex.: Financeiro — Fulano (fulano@sistenge.com); RH — Ciclano" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={2} defaultValue={empresa.observacoes ?? ""} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary">Dados da empresa salvos.</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar dados da empresa"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/configuracoes" />}>
          Voltar
        </Button>
      </div>
    </form>
  );
}
