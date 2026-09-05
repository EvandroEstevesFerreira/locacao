"use client";

// As duas saídas de uma devolução já fechada.
//
// REENVIAR existe porque o fechamento é irreversível e o envio não: se o Resend
// cair, o registro fica fechado com o fornecedor sem saber. Sem este botão, a
// única saída seria mandar o termo por fora do sistema — perdendo o registro de
// que o fornecedor foi avisado.
//
// REABRIR é mais forte aqui do que no recebimento, e por isso o texto é
// diferente: a devolução MOVEU SALDO, então reabrir DESFAZ as movimentações e
// devolve os itens ao contrato. E, ao fechar de novo, sai um número NOVO.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, LockOpen, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  reenviarAvisoDevolucao,
  reabrirDevolucao,
} from "../contratos/devolucao-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DevolucaoFechada({
  devolucaoId,
  numero,
  avisoEnviadoEm,
  emailFornecedor,
  totalItens,
  podeOperar,
  podeReabrir,
}: {
  devolucaoId: string;
  numero: string | null;
  avisoEnviadoEm: string | null;
  emailFornecedor: string | null;
  totalItens: number;
  podeOperar: boolean;
  /** Só master. Reabrir desfaz saldo e algo que já saiu da empresa. */
  podeReabrir: boolean;
}) {
  const router = useRouter();
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function reenviar() {
    startTransition(async () => {
      const r = await reenviarAvisoDevolucao({ id: devolucaoId });
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro);
        return;
      }
      setErro(null);
      toast.success(r.aviso ?? "Aviso reenviado.");
      router.refresh();
    });
  }

  function reabrir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    startTransition(async () => {
      const r = await reabrirDevolucao({ id: devolucaoId, motivo });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.warning(r.aviso ?? "Devolução reaberta.", { duration: 10000 });
      setReabrindo(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {podeOperar ? (
          <Button variant="outline" size="sm" disabled={pendente} onClick={reenviar}>
            <Send className="size-3.5" aria-hidden />
            {pendente
              ? "Enviando…"
              : avisoEnviadoEm
                ? "Reenviar aviso"
                : "Enviar aviso ao fornecedor"}
          </Button>
        ) : null}

        {podeReabrir && !reabrindo ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pendente}
            onClick={() => setReabrindo(true)}
          >
            <LockOpen className="size-3.5" aria-hidden />
            Reabrir
          </Button>
        ) : null}
      </div>

      {/* Sem e-mail cadastrado, o botão de reenviar existiria só para falhar.
          Dizer isso aqui evita a tentativa e aponta o conserto. */}
      {podeOperar && !emailFornecedor ? (
        <p className="text-xs text-muted-foreground">
          O fornecedor não tem e-mail cadastrado — o aviso não tem para onde ir.
          Cadastre em Fornecedores e reenvie.
        </p>
      ) : null}

      {reabrindo ? (
        <form onSubmit={reabrir} className="space-y-3 rounded-lg border border-dashed p-4">
          <p className="flex items-start gap-2 text-sm font-medium">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            Reabrir {numero ?? "esta devolução"}
          </p>
          <ul className="ml-6 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              Os {totalItens} {totalItens === 1 ? "item volta" : "itens voltam"} ao
              saldo do contrato e <strong>recomeçam a acumular custo</strong> de
              locação. É o que impede que a próxima devolução seja recusada por
              saldo insuficiente.
            </li>
            <li>
              O número <strong>{numero}</strong> é mantido no histórico, mas ao
              fechar de novo <strong>sai um número NOVO</strong> — o documento
              mudou, então é outro documento.
            </li>
            <li>
              O aviso ao fornecedor <strong>não é desfeito</strong>: o e-mail já
              saiu, e o termo antigo continua na caixa dele.
            </li>
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo da reabertura</Label>
            <Textarea
              id="motivo"
              rows={2}
              maxLength={500}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={pendente}
              placeholder="Fica registrado nas observações e na auditoria."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={pendente || motivo.trim().length < 10}
            >
              {pendente ? "Reabrindo…" : "Confirmar reabertura"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => setReabrindo(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}
