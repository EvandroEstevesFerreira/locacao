"use client";

// As duas saídas de um recebimento já fechado.
//
// REENVIAR existe porque o fechamento é irreversível e o envio não: se o Resend
// cair, o registro fica fechado com o fornecedor sem saber. Sem este botão, a
// única saída seria mandar o romaneio por fora do sistema — perdendo o registro
// de que o fornecedor foi avisado.
//
// REABRIR é o escape estreito. Só master, exige motivo, e NÃO desfaz o número
// nem o aviso: o que se ganha é poder corrigir os itens.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, LockOpen, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  reenviarAvisoRecebimento,
  reabrirRecebimento,
} from "../contratos/recebimento-actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function RecebimentoFechado({
  recebimentoId,
  numero,
  avisoEnviadoEm,
  emailFornecedor,
  podeOperar,
  podeReabrir,
}: {
  recebimentoId: string;
  numero: string | null;
  avisoEnviadoEm: string | null;
  emailFornecedor: string | null;
  podeOperar: boolean;
  /** Só master. Reabrir desfaz algo que já saiu da empresa. */
  podeReabrir: boolean;
}) {
  const router = useRouter();
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function reenviar() {
    startTransition(async () => {
      const r = await reenviarAvisoRecebimento({ id: recebimentoId });
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
      const r = await reabrirRecebimento({ id: recebimentoId, motivo });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.warning(r.aviso ?? "Recebimento reaberto.", { duration: 8000 });
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
            Reabrir {numero ?? "este recebimento"}
          </p>
          <ul className="ml-6 list-disc space-y-1 text-xs text-muted-foreground">
            <li>
              O número <strong>{numero}</strong> é mantido — ele já pode estar num
              romaneio impresso.
            </li>
            <li>
              O aviso ao fornecedor <strong>não é desfeito</strong>: o e-mail já
              saiu.
            </li>
            <li>
              A data de retirada nos itens do contrato <strong>fica</strong> — o
              equipamento chegou, e isso é um fato.
            </li>
            <li>O que se ganha é poder corrigir os itens e o cabeçalho.</li>
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
            <Button type="submit" size="sm" disabled={pendente || motivo.trim().length < 10}>
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
