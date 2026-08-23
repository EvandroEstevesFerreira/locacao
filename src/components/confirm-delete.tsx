"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

/**
 * Botão de excluir que pede confirmação e chama um server action.
 * O `action` é passado do server component (referência de server action).
 *
 * Os props são exatamente os de antes, de propósito: os 18 call sites em 9
 * arquivos não mudam. O que mudou é o miolo — era `window.confirm()`, sem
 * estilo, sem tema e bloqueante, e o motivo de uma recusa aparecia num toast
 * longe do botão clicado. Agora é o ConfirmDialog do sistema, e o erro do
 * servidor aparece dentro do próprio diálogo, que fica aberto.
 */
export function ConfirmDelete({
  action,
  id,
  mensagem = "Excluir este registro? Esta ação não pode ser desfeita.",
  hidden,
  rotulo,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  id: string;
  mensagem?: string;
  hidden?: Record<string, string>;
  /** Quando informado, mostra um botão com texto em vez do ícone de lixeira. */
  rotulo?: string;
}) {
  return (
    <ConfirmDialog
      destrutivo
      titulo="Excluir registro?"
      descricao={mensagem}
      confirmarLabel="Excluir"
      trigger={
        <Button
          type="button"
          variant={rotulo ? "outline" : "ghost"}
          size={rotulo ? "default" : "icon-sm"}
          aria-label={rotulo ? undefined : "Excluir"}
          className={
            rotulo
              ? "text-destructive"
              : "text-muted-foreground hover:text-destructive"
          }
        >
          <Trash2 />
          {rotulo}
        </Button>
      }
      onConfirm={async () => {
        const formData = new FormData();
        formData.set("id", id);
        for (const [chave, valor] of Object.entries(hidden ?? {})) {
          formData.set(chave, valor);
        }
        const resultado = await action(formData);
        // string devolvida = erro inline; o diálogo permanece aberto.
        if (resultado?.error) return resultado.error;
      }}
    />
  );
}
