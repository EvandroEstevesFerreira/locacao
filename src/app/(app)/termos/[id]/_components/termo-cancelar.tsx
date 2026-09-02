"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Loader2 } from "lucide-react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelarTermo } from "../../actions";

/**
 * Cancelamento de termo emitido.
 *
 * Não usa o `ConfirmDialog` genérico porque o motivo é OBRIGATÓRIO: um termo
 * assinado que aparece anulado sem explicação não serve de defesa nenhuma seis
 * meses depois. Cancelar não apaga — o documento continua no histórico, com o
 * motivo registrado.
 */
export function TermoCancelar({ termoId }: { termoId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function alternar(proximo: boolean) {
    if (pendente) return;
    setAberto(proximo);
    if (!proximo) setErro(null);
  }

  function cancelar() {
    setErro(null);
    if (!motivo.trim()) return setErro("Informe o motivo do cancelamento.");

    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", termoId);
      fd.set("motivo", motivo.trim());
      const r = await cancelarTermo(fd);
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={alternar}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" className="text-destructive">
            <Ban className="size-4" />
            Cancelar termo
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar este termo?</DialogTitle>
          <DialogDescription>
            O documento não é apagado: fica anulado, com o motivo no histórico. As
            peças voltam para disponível na frota.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo_cancelamento">Motivo</Label>
          <Textarea
            id="motivo_cancelamento"
            rows={3}
            maxLength={300}
            value={motivo}
            disabled={pendente}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: emitido para o funcionário errado."
          />
        </div>

        <FormError>{erro}</FormError>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pendente}
            onClick={() => alternar(false)}
          >
            Voltar
          </Button>
          <Button type="button" variant="destructive" disabled={pendente} onClick={cancelar}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
            {pendente ? "Cancelando…" : "Cancelar termo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
