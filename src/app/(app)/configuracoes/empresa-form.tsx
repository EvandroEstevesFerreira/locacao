"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useForm,
  type FieldError,
  type UseFormRegisterReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  empresaSchema,
  type EmpresaDados,
  type EmpresaInput,
} from "@/lib/config";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { salvarEmpresa } from "./actions";

/**
 * Empresa como vem do banco. Nome distinto do `EmpresaDados` de
 * src/lib/config.ts, que é a saída do schema.
 */
export type EmpresaExistente = {
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

/**
 * Campo de formulário desta tela — são 16, então vale o helper. Recebe o
 * retorno de `register()` em vez de um `name` cru: é assim que o RHF liga o
 * campo, e passar só o nome deixaria o input desconectado.
 */
function Campo({
  id,
  label,
  registro,
  erro,
  type = "text",
  placeholder,
  className,
  desabilitado,
}: {
  id: string;
  label: string;
  registro: UseFormRegisterReturn;
  erro?: FieldError;
  type?: string;
  placeholder?: string;
  className?: string;
  desabilitado?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        aria-invalid={!!erro}
        disabled={desabilitado}
        {...registro}
      />
      {erro ? <p className="text-xs text-destructive">{erro.message}</p> : null}
    </div>
  );
}

export function EmpresaForm({ empresa }: { empresa: EmpresaExistente }) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmpresaInput, unknown, EmpresaDados>({
    resolver: zodResolver(empresaSchema),
    defaultValues: {
      nome: empresa.nome ?? "",
      razao_social: empresa.razao_social ?? "",
      nome_fantasia: empresa.nome_fantasia ?? "",
      cnpj: empresa.cnpj ?? "",
      inscricao_estadual: empresa.inscricao_estadual ?? "",
      inscricao_municipal: empresa.inscricao_municipal ?? "",
      endereco: empresa.endereco ?? "",
      cidade: empresa.cidade ?? "",
      uf: empresa.uf ?? "",
      cep: empresa.cep ?? "",
      telefone: empresa.telefone ?? "",
      email: empresa.email ?? "",
      site: empresa.site ?? "",
      representante_nome: empresa.representante_nome ?? "",
      representante_cargo: empresa.representante_cargo ?? "",
      representante_cpf: empresa.representante_cpf ?? "",
      responsaveis: empresa.responsaveis ?? "",
      observacoes: empresa.observacoes ?? "",
    },
  });

  function onSubmit(values: EmpresaDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarEmpresa(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success("Dados da empresa salvos.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="text-sm font-medium">Identificação</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="nome"
            label="Nome (curto)"
            placeholder="Sistenge"
            registro={register("nome")}
            erro={errors.nome}
            desabilitado={pendente}
          />
          <Campo
            id="razao_social"
            label="Razão social"
            registro={register("razao_social")}
            desabilitado={pendente}
          />
          <Campo
            id="nome_fantasia"
            label="Nome fantasia"
            registro={register("nome_fantasia")}
            desabilitado={pendente}
          />
          {/* O CNPJ passa pelo `cnpjValido` de src/lib/cnpj.ts, que implementa o
              formato alfanumérico de 2026 — antes esta tela não validava nada. */}
          <Campo
            id="cnpj"
            label="CNPJ"
            placeholder="12.ABC.345/01DE-35"
            registro={register("cnpj")}
            erro={errors.cnpj}
            desabilitado={pendente}
          />
          <Campo
            id="inscricao_estadual"
            label="Inscrição estadual"
            registro={register("inscricao_estadual")}
            desabilitado={pendente}
          />
          <Campo
            id="inscricao_municipal"
            label="Inscrição municipal"
            registro={register("inscricao_municipal")}
            desabilitado={pendente}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Endereço</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            id="endereco"
            label="Logradouro"
            className="sm:col-span-2"
            registro={register("endereco")}
            desabilitado={pendente}
          />
          <Campo
            id="cidade"
            label="Cidade"
            registro={register("cidade")}
            desabilitado={pendente}
          />
          <Campo
            id="uf"
            label="UF"
            registro={register("uf")}
            erro={errors.uf}
            desabilitado={pendente}
          />
          <Campo
            id="cep"
            label="CEP"
            placeholder="00000-000"
            registro={register("cep")}
            erro={errors.cep}
            desabilitado={pendente}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Contatos</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="telefone"
            label="Telefone"
            registro={register("telefone")}
            desabilitado={pendente}
          />
          <Campo
            id="email"
            label="E-mail"
            type="email"
            registro={register("email")}
            erro={errors.email}
            desabilitado={pendente}
          />
          <Campo
            id="site"
            label="Site"
            registro={register("site")}
            desabilitado={pendente}
          />
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">
          Representante legal (assinatura dos contratos)
        </legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            id="representante_nome"
            label="Nome"
            registro={register("representante_nome")}
            desabilitado={pendente}
          />
          <Campo
            id="representante_cargo"
            label="Cargo"
            registro={register("representante_cargo")}
            desabilitado={pendente}
          />
          <Campo
            id="representante_cpf"
            label="CPF"
            registro={register("representante_cpf")}
            desabilitado={pendente}
          />
        </div>
      </fieldset>

      <div className="space-y-1.5 border-t pt-4">
        <Label htmlFor="responsaveis">Responsáveis / demais contatos</Label>
        <Textarea
          id="responsaveis"
          rows={2}
          placeholder="Ex.: Financeiro — Fulano (fulano@sistenge.com); RH — Ciclano"
          disabled={pendente}
          {...register("responsaveis")}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          rows={2}
          disabled={pendente}
          {...register("observacoes")}
        />
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          render={<Link href="/configuracoes" />}
        >
          Voltar
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar dados da empresa"}
        </Button>
      </div>
    </form>
  );
}
