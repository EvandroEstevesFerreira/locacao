"use client";

// ConfirmDialog — confirmação de ações destrutivas dentro do sistema.
//
// Substitui o window.confirm() que o confirm-delete.tsx usava: sem estilo, sem
// tema, bloqueante, e o motivo de uma recusa aparecia num toast fora de
// contexto — longe do botão que o usuário acabou de clicar.
//
// `onConfirm` pode devolver:
//   - void        → fecha o diálogo
//   - string      → mostra como erro inline e MANTÉM o diálogo aberto
//
// Erros de controle de fluxo do Next (redirect/notFound, que se identificam
// pelo `digest` "NEXT_...") são re-lançados: engoli-los transformaria uma
// navegação bem-sucedida num erro falso na tela.

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** Erros que o Next usa para redirect()/notFound() não são falhas nossas. */
function ehControleDeFluxoDoNext(e: unknown): boolean {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export function ConfirmDialog({
  trigger,
  titulo,
  descricao,
  confirmarLabel = "Confirmar",
  cancelarLabel = "Cancelar",
  destrutivo = false,
  onConfirm,
}: {
  /** Elemento que abre o diálogo. ReactElement, não ReactNode: o
   *  `render` do Base UI clona o elemento para injetar os handlers. */
  trigger: React.ReactElement;
  titulo: string;
  descricao?: React.ReactNode;
  confirmarLabel?: string;
  cancelarLabel?: string;
  destrutivo?: boolean;
  onConfirm: () => Promise<string | void> | string | void;
}) {
  const [aberto, setAberto] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(proximo: boolean) {
    if (pendente) return;
    setAberto(proximo);
    if (!proximo) setErro(null);
  }

  async function confirmar() {
    setErro(null);
    setPendente(true);
    try {
      const r = await onConfirm();
      if (typeof r === "string") {
        setErro(r);
        return;
      }
      setAberto(false);
    } catch (e) {
      if (ehControleDeFluxoDoNext(e)) throw e;
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setPendente(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={alternar}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descricao ? <DialogDescription>{descricao}</DialogDescription> : null}
        </DialogHeader>

        {erro ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{erro}</span>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => alternar(false)}
            disabled={pendente}
          >
            {cancelarLabel}
          </Button>
          <Button
            type="button"
            variant={destrutivo ? "destructive" : "default"}
            onClick={confirmar}
            disabled={pendente}
          >
            {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmarLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
