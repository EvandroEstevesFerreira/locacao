"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { excluirRascunho } from "../../actions";

/**
 * Exclusão de rascunho.
 *
 * Não usa o `ConfirmDelete` genérico porque aquele espera actions do formato
 * antigo (`{ error }`) e as do termo devolvem `ActionResult`. Aqui o erro do
 * servidor volta como string e o diálogo continua aberto — é o que mostra
 * "este termo já foi emitido, cancele em vez de excluir" no lugar certo.
 */
export function TermoExcluir({ termoId }: { termoId: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      destrutivo
      titulo="Excluir este rascunho?"
      descricao="O rascunho não gastou número e nenhuma peça saiu da frota por ele. A exclusão é definitiva."
      confirmarLabel="Excluir"
      trigger={
        <Button type="button" variant="outline" className="text-destructive">
          <Trash2 className="size-4" />
          Excluir rascunho
        </Button>
      }
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("id", termoId);
        const r = await excluirRascunho(fd);
        if (!r.ok) return r.erro;
        router.push("/termos");
      }}
    />
  );
}
