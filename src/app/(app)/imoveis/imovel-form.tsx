"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_IMOVEL,
  TIPO_IMOVEL_INFO,
  STATUS_IMOVEL_INFO,
  imovelSchema,
  type ImovelDados,
  type ImovelInput,
  type StatusImovel,
} from "@/lib/imoveis";
import { FormError } from "@/components/shared/form-error";
import { aoInvalidar } from "@/lib/validacao-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { salvarImovel } from "./actions";


/**
 * Imóvel já gravado, como vem do banco. Nome distinto do `ImovelDados` de
 * src/lib/imoveis.ts, que é a SAÍDA do schema.
 */
export type ImovelExistente = {
  id?: string;
  tipo?: string;
  apelido?: string;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  capacidade_pessoas?: number | null;
  area_m2?: number | null;
  obra_id?: string | null;
  status?: string;
  proprietario_nome?: string | null;
  proprietario_telefone?: string | null;
  proprietario_email?: string | null;
  imobiliaria_nome?: string | null;
  imobiliaria_telefone?: string | null;
  imobiliaria_email?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  titular_conta?: string | null;
  pix_chave?: string | null;
  observacoes?: string | null;
};

export function ImovelForm({
  imovel,
  obras,
}: {
  imovel?: ImovelExistente;
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const router = useRouter();
  const [erroServidor, setErroServidor] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ImovelInput, unknown, ImovelDados>({
    resolver: zodResolver(imovelSchema),
    defaultValues: {
      id: imovel?.id,
      tipo: (imovel?.tipo as ImovelInput["tipo"]) ?? "outro",
      apelido: imovel?.apelido ?? "",
      endereco: imovel?.endereco ?? "",
      cidade: imovel?.cidade ?? "",
      uf: imovel?.uf ?? "",
      capacidade_pessoas:
        imovel?.capacidade_pessoas == null ? "" : String(imovel.capacidade_pessoas),
      area_m2: imovel?.area_m2 == null ? "" : String(imovel.area_m2),
      obra_id: imovel?.obra_id ?? "",
      status: (imovel?.status as ImovelInput["status"]) ?? "ativo",
      proprietario_nome: imovel?.proprietario_nome ?? "",
      proprietario_telefone: imovel?.proprietario_telefone ?? "",
      proprietario_email: imovel?.proprietario_email ?? "",
      imobiliaria_nome: imovel?.imobiliaria_nome ?? "",
      imobiliaria_telefone: imovel?.imobiliaria_telefone ?? "",
      imobiliaria_email: imovel?.imobiliaria_email ?? "",
      banco: imovel?.banco ?? "",
      agencia: imovel?.agencia ?? "",
      conta: imovel?.conta ?? "",
      tipo_conta: imovel?.tipo_conta ?? "",
      titular_conta: imovel?.titular_conta ?? "",
      pix_chave: imovel?.pix_chave ?? "",
      observacoes: imovel?.observacoes ?? "",
    },
  });

  function onSubmit(values: ImovelDados) {
    setErroServidor(null);
    startTransition(async () => {
      const r = await salvarImovel(values);
      if (!r.ok) {
        setErroServidor(r.erro);
        return;
      }
      toast.success(imovel?.id ? "Imóvel atualizado." : "Imóvel cadastrado.");
      router.replace(r.id ? `/imoveis/${r.id}` : "/imoveis");
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, aoInvalidar(setErroServidor))} className="space-y-6">
      <input type="hidden" {...register("id")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="apelido">Identificação (apelido)</Label>
          <Input id="apelido" aria-invalid={!!errors.apelido} disabled={pendente} {...register("apelido")} placeholder="Ex.: Kitnet Centro 01" />
          {errors.apelido ? (
            <p className="text-xs text-destructive">{errors.apelido.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <NativeSelect id="tipo" {...register("tipo")}>
            {TIPOS_IMOVEL.map((t) => (
              <option key={t} value={t}>{TIPO_IMOVEL_INFO[t]}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" {...register("endereco")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" {...register("cidade")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uf">UF</Label>
          <Input id="uf" aria-invalid={!!errors.uf} disabled={pendente} {...register("uf")} maxLength={2} />
          {errors.uf ? (
            <p className="text-xs text-destructive">{errors.uf.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacidade_pessoas">Capacidade (pessoas)</Label>
          <Input id="capacidade_pessoas" aria-invalid={!!errors.capacidade_pessoas} disabled={pendente} {...register("capacidade_pessoas")} type="number" min={0} />
          {errors.capacidade_pessoas ? (
            <p className="text-xs text-destructive">{errors.capacidade_pessoas.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="area_m2">Área (m²)</Label>
          <Input id="area_m2" aria-invalid={!!errors.area_m2} disabled={pendente} {...register("area_m2")} type="number" step="0.01" min={0} />
          {errors.area_m2 ? (
            <p className="text-xs text-destructive">{errors.area_m2.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="obra_id">Obra / centro de custo</Label>
          <NativeSelect id="obra_id" {...register("obra_id")}>
            <option value="">— Nenhuma —</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <NativeSelect id="status" {...register("status")}>
            {(Object.keys(STATUS_IMOVEL_INFO) as StatusImovel[]).map((s) => (
              <option key={s} value={s}>{STATUS_IMOVEL_INFO[s].label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Proprietário</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="proprietario_nome">Nome</Label>
            <Input id="proprietario_nome" {...register("proprietario_nome")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proprietario_telefone">Telefone</Label>
            <Input id="proprietario_telefone" {...register("proprietario_telefone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proprietario_email">E-mail</Label>
            <Input id="proprietario_email" aria-invalid={!!errors.proprietario_email} disabled={pendente} {...register("proprietario_email")} type="email" />
            {errors.proprietario_email ? (
              <p className="text-xs text-destructive">{errors.proprietario_email.message}</p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Imobiliária</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_nome">Nome</Label>
            <Input id="imobiliaria_nome" {...register("imobiliaria_nome")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_telefone">Telefone</Label>
            <Input id="imobiliaria_telefone" {...register("imobiliaria_telefone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_email">E-mail</Label>
            <Input id="imobiliaria_email" aria-invalid={!!errors.imobiliaria_email} disabled={pendente} {...register("imobiliaria_email")} type="email" />
            {errors.imobiliaria_email ? (
              <p className="text-xs text-destructive">{errors.imobiliaria_email.message}</p>
            ) : null}
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Dados bancários (pagamento ao proprietário)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Input id="banco" {...register("banco")} placeholder="Ex.: Itaú, Bradesco" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agencia">Agência</Label>
            <Input id="agencia" {...register("agencia")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conta">Conta</Label>
            <Input id="conta" {...register("conta")} placeholder="Nº com dígito" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipo_conta">Tipo de conta</Label>
            <NativeSelect id="tipo_conta" {...register("tipo_conta")}>
              <option value="">— Não informado —</option>
              <option value="corrente">Corrente</option>
              <option value="poupanca">Poupança</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="titular_conta">Titular da conta</Label>
            <Input id="titular_conta" {...register("titular_conta")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pix_chave">Chave PIX</Label>
            <Input id="pix_chave" {...register("pix_chave")} placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" {...register("observacoes")} rows={3} />
      </div>

      <FormError>{erroServidor}</FormError>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" render={<Link href="/imoveis" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pendente}>
          {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
          {pendente ? "Salvando…" : "Salvar imóvel"}
        </Button>
      </div>
    </form>
  );
}
