"use client";

import { useActionState } from "react";
import Link from "next/link";
import { salvarImovel, type ImovelFormState } from "./actions";
import {
  TIPOS_IMOVEL,
  TIPO_IMOVEL_INFO,
  STATUS_IMOVEL_INFO,
  type StatusImovel,
} from "@/lib/imoveis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const selectClasses =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export type ImovelDados = {
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
  imovel?: ImovelDados;
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const [state, formAction, isPending] = useActionState<ImovelFormState, FormData>(
    salvarImovel,
    {},
  );

  return (
    <form action={formAction} className="space-y-6">
      {imovel?.id ? <input type="hidden" name="id" value={imovel.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="apelido">Identificação (apelido) *</Label>
          <Input id="apelido" name="apelido" required defaultValue={imovel?.apelido ?? ""} placeholder="Ex.: Kitnet Centro 01" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <select id="tipo" name="tipo" defaultValue={imovel?.tipo ?? "outro"} className={selectClasses}>
            {TIPOS_IMOVEL.map((t) => (
              <option key={t} value={t}>{TIPO_IMOVEL_INFO[t]}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="endereco">Endereço</Label>
          <Input id="endereco" name="endereco" defaultValue={imovel?.endereco ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" name="cidade" defaultValue={imovel?.cidade ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="uf">UF</Label>
          <Input id="uf" name="uf" maxLength={2} defaultValue={imovel?.uf ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacidade_pessoas">Capacidade (pessoas)</Label>
          <Input id="capacidade_pessoas" name="capacidade_pessoas" type="number" min={0} defaultValue={imovel?.capacidade_pessoas ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="area_m2">Área (m²)</Label>
          <Input id="area_m2" name="area_m2" type="number" step="0.01" min={0} defaultValue={imovel?.area_m2 ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="obra_id">Obra / centro de custo</Label>
          <select id="obra_id" name="obra_id" defaultValue={imovel?.obra_id ?? ""} className={selectClasses}>
            <option value="">— Nenhuma —</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>{o.codigo} — {o.nome}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select id="status" name="status" defaultValue={imovel?.status ?? "ativo"} className={selectClasses}>
            {(Object.keys(STATUS_IMOVEL_INFO) as StatusImovel[]).map((s) => (
              <option key={s} value={s}>{STATUS_IMOVEL_INFO[s].label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Proprietário</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="proprietario_nome">Nome</Label>
            <Input id="proprietario_nome" name="proprietario_nome" defaultValue={imovel?.proprietario_nome ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proprietario_telefone">Telefone</Label>
            <Input id="proprietario_telefone" name="proprietario_telefone" defaultValue={imovel?.proprietario_telefone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proprietario_email">E-mail</Label>
            <Input id="proprietario_email" name="proprietario_email" type="email" defaultValue={imovel?.proprietario_email ?? ""} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Imobiliária</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_nome">Nome</Label>
            <Input id="imobiliaria_nome" name="imobiliaria_nome" defaultValue={imovel?.imobiliaria_nome ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_telefone">Telefone</Label>
            <Input id="imobiliaria_telefone" name="imobiliaria_telefone" defaultValue={imovel?.imobiliaria_telefone ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imobiliaria_email">E-mail</Label>
            <Input id="imobiliaria_email" name="imobiliaria_email" type="email" defaultValue={imovel?.imobiliaria_email ?? ""} />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4 border-t pt-4">
        <legend className="text-sm font-medium">Dados bancários (pagamento ao proprietário)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Input id="banco" name="banco" defaultValue={imovel?.banco ?? ""} placeholder="Ex.: Itaú, Bradesco" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="agencia">Agência</Label>
            <Input id="agencia" name="agencia" defaultValue={imovel?.agencia ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="conta">Conta</Label>
            <Input id="conta" name="conta" defaultValue={imovel?.conta ?? ""} placeholder="Nº com dígito" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tipo_conta">Tipo de conta</Label>
            <select id="tipo_conta" name="tipo_conta" defaultValue={imovel?.tipo_conta ?? ""} className={selectClasses}>
              <option value="">— Não informado —</option>
              <option value="corrente">Corrente</option>
              <option value="poupanca">Poupança</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="titular_conta">Titular da conta</Label>
            <Input id="titular_conta" name="titular_conta" defaultValue={imovel?.titular_conta ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pix_chave">Chave PIX</Label>
            <Input id="pix_chave" name="pix_chave" defaultValue={imovel?.pix_chave ?? ""} placeholder="CPF/CNPJ, e-mail, telefone ou aleatória" />
          </div>
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea id="observacoes" name="observacoes" rows={3} defaultValue={imovel?.observacoes ?? ""} />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar imóvel"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/imoveis" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
