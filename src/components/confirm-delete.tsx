"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão de excluir que pede confirmação e submete um server action.
 * O `action` é passado do server component (referência de server action).
 */
export function ConfirmDelete({
  action,
  id,
  mensagem = "Excluir este registro? Esta ação não pode ser desfeita.",
  hidden,
}: {
  action: (formData: FormData) => void;
  id: string;
  mensagem?: string;
  hidden?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(mensagem)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {hidden
        ? Object.entries(hidden).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))
        : null}
      <Button
        type="submit"
        variant="ghost"
        size="icon-sm"
        aria-label="Excluir"
        className="text-muted-foreground hover:text-destructive"
      >
        <Trash2 />
      </Button>
    </form>
  );
}
