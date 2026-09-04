"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

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
import { estornarMovimento } from "../actions";

/**
 * Estorno de um movimento lançado por engano.
 *
 * A tela já dizia que o lançamento não se edita nem se apaga e que "correção é
 * estorno" — mas não havia botão nenhum, e `estornarMovimento` era inalcançável
 * pela interface. O almoxarife que digitasse 100 no lugar de 10 não tinha
 * caminho: ou deixava o saldo errado, ou lançava um ajuste, que corrige o saldo
 * e não explica o erro.
 *
 * Não usa o `ConfirmDialog` genérico porque o motivo é OBRIGATÓRIO. Um razão
 * com duas linhas contrárias e nenhuma explicação é pior do que um saldo
 * errado: o saldo errado pelo menos alguém questiona.
 */
export function MovimentoEstornar({
  movimentoId,
  descricao,
}: {
  movimentoId: string;
  descricao: string;
}) {
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

  function estornar() {
    setErro(null);
    if (!motivo.trim()) return setErro("Informe o motivo do estorno.");

    iniciar(async () => {
      const r = await estornarMovimento({
        movimento_id: movimentoId,
        motivo: motivo.trim(),
      });
      if (!r.ok) return setErro(r.erro);
      setAberto(false);
      setMotivo("");
      toast.success("Estorno lançado. As duas linhas ficam no razão.");
      router.refresh();
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={alternar}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Estornar movimento de ${descricao}`}
            className="text-muted-foreground hover:text-destructive"
          >
            <Undo2 />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Estornar este movimento?</DialogTitle>
          <DialogDescription>
            O lançamento não é apagado. O sistema grava um movimento contrário
            apontando para ele, e as duas linhas ficam visíveis no razão — é a
            diferença entre um saldo que fecha e um saldo que fecha e se explica.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="motivo_estorno">Motivo</Label>
          <Textarea
            id="motivo_estorno"
            rows={3}
            maxLength={300}
            value={motivo}
            disabled={pendente}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: quantidade digitada errada, eram 10 e não 100."
          />
          <p className="text-xs text-muted-foreground">
            O estorno é lançado com a data de hoje, não com a do movimento
            original: ele aconteceu agora, e datá-lo no passado reescreveria um
            saldo que já foi lido.
          </p>
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
          <Button
            type="button"
            variant="destructive"
            disabled={pendente}
            onClick={estornar}
          >
            {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
            {pendente ? "Estornando…" : "Estornar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
