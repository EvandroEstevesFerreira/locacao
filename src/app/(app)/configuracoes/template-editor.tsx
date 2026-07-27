"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { salvarTemplate, restaurarTemplate, type TemplateFormState } from "./templates-actions";
import { type DocumentoInfo } from "@/lib/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TemplateEditor({
  doc,
  titulo,
  corpo,
  personalizado,
}: {
  doc: DocumentoInfo;
  titulo: string;
  corpo: string;
  /** true = existe template salvo; false = está mostrando o padrão do sistema. */
  personalizado: boolean;
}) {
  const [state, formAction, isPending] = useActionState<TemplateFormState, FormData>(
    salvarTemplate,
    {},
  );
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  const inserirVariavel = (chave: string) => {
    const el = corpoRef.current;
    const token = `{{${chave}}}`;
    if (!el) return;
    const ini = el.selectionStart ?? el.value.length;
    const fim = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, ini) + token + el.value.slice(fim);
    const pos = ini + token.length;
    el.focus();
    el.setSelectionRange(pos, pos);
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="tipo" value={doc.tipo} />

      <div className="space-y-2">
        <Label htmlFor="titulo">Título do documento</Label>
        <Input id="titulo" name="titulo" defaultValue={titulo} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="corpo">Corpo (parágrafos separados por linha em branco)</Label>
        <Textarea id="corpo" name="corpo" ref={corpoRef} defaultValue={corpo} rows={16} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Use variáveis no formato <code>{"{{chave}}"}</code>. Elas são
          substituídas pelos dados reais ao gerar o PDF.
        </p>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Variáveis disponíveis (clique para inserir)</p>
        <div className="flex flex-wrap gap-2">
          {doc.variaveis.map((v) => (
            <button
              key={v.chave}
              type="button"
              onClick={() => inserirVariavel(v.chave)}
              title={v.descricao}
              className="rounded border border-input bg-muted/50 px-2 py-1 font-mono text-xs hover:bg-muted"
            >
              {`{{${v.chave}}}`}
            </button>
          ))}
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary">Template salvo.</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar template"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/configuracoes/templates" />}>
          Voltar
        </Button>
        {personalizado ? (
          <Button
            type="submit"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            formAction={restaurarTemplate}
          >
            Restaurar padrão
          </Button>
        ) : null}
      </div>
    </form>
  );
}
