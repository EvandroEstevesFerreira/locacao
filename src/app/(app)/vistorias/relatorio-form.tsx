"use client";

import { useActionState } from "react";
import { salvarRelatorioVistoria, type VistoriaFormState } from "./actions";
import { SignaturePad } from "./signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type RelatorioDefaults = {
  observacoes: string;
  empresaNome: string;
  empresaImg: string;
  empresaEm?: string;
  retiranteNome: string;
  retiranteImg: string;
  retiranteEm?: string;
};

export function RelatorioForm({
  vistoriaId,
  usuarioNome,
  defaults,
}: {
  vistoriaId: string;
  usuarioNome: string;
  defaults: RelatorioDefaults;
}) {
  const [state, formAction, isPending] = useActionState<
    VistoriaFormState,
    FormData
  >(salvarRelatorioVistoria, {});

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={vistoriaId} />

      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          defaultValue={defaults.observacoes}
          rows={3}
          placeholder="Estado dos itens, condições da retirada/devolução, ressalvas…"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Representante Sistenge</Label>
          <Input
            name="assinatura_empresa_nome"
            defaultValue={defaults.empresaNome || usuarioNome}
            placeholder="Nome do representante"
          />
          <SignaturePad
            name="assinatura_empresa_img"
            defaultValue={defaults.empresaImg}
            label="Assinatura (opcional)"
          />
          {defaults.empresaEm ? (
            <p className="text-xs text-muted-foreground">
              Assinado em {defaults.empresaEm}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Quem retira / recebe</Label>
          <Input
            name="assinatura_retirante_nome"
            defaultValue={defaults.retiranteNome}
            placeholder="Nome de quem retira/recebe"
          />
          <SignaturePad
            name="assinatura_retirante_img"
            defaultValue={defaults.retiranteImg}
            label="Assinatura (opcional)"
          />
          {defaults.retiranteEm ? (
            <p className="text-xs text-muted-foreground">
              Assinado em {defaults.retiranteEm}
            </p>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-primary">Relatório salvo.</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar relatório"}
      </Button>
    </form>
  );
}
