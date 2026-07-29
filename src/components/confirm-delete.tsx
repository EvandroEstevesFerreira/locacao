"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * Botão de excluir que pede confirmação e chama um server action.
 * O `action` é passado do server component (referência de server action).
 * Se a exclusão for recusada, mostra o motivo num toast — antes o erro voltava
 * do servidor e era descartado, dando a impressão de que nada acontecia.
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
  const [pendente, iniciar] = useTransition();

  function excluir() {
    if (!window.confirm(mensagem)) return;
    const formData = new FormData();
    formData.set("id", id);
    for (const [chave, valor] of Object.entries(hidden ?? {})) {
      formData.set(chave, valor);
    }
    iniciar(async () => {
      const resultado = await action(formData);
      if (resultado?.error) toast.error(resultado.error);
    });
  }

  return (
    <Button
      type="button"
      variant={rotulo ? "outline" : "ghost"}
      size={rotulo ? "default" : "icon-sm"}
      aria-label={rotulo ? undefined : "Excluir"}
      disabled={pendente}
      onClick={excluir}
      className={
        rotulo ? "text-destructive" : "text-muted-foreground hover:text-destructive"
      }
    >
      <Trash2 />
      {rotulo}
    </Button>
  );
}
