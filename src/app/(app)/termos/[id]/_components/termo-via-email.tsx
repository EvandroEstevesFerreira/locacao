"use client";

// A via do funcionário: o PDF do termo assinado, na caixa de quem assinou.
//
// REENVIAR existe porque a EMISSÃO é irreversível e o envio não. Se o Resend
// cair, o termo fica emitido com o funcionário sem a própria via, e sem este
// botão a única saída seria mandar o PDF por fora do sistema — perdendo o
// registro de que a pessoa recebeu.
//
// Os três estados são deliberadamente diferentes na tela, porque exigem coisas
// diferentes de quem opera:
//
//   enviada       nada a fazer; o reenvio continua disponível
//   sem endereço  cadastre o e-mail — o botão existiria só para falhar
//   por conferir  o endereço foi DEDUZIDO do nome e ninguém olhou. É o caso que
//                 mais importa: a importação do inventário deduziu 97 de uma
//                 vez, e enviar sem conferir é entregar o termo de uma pessoa
//                 na caixa de outra.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, MailWarning, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { reenviarTermo } from "../../actions";
import { Button } from "@/components/ui/button";
import { formatarDataHora } from "@/lib/locacao";

export function TermoViaEmail({
  termoId,
  email,
  emailConfirmado,
  enviadoEm,
  podeOperar,
}: {
  termoId: string;
  email: string | null;
  emailConfirmado: boolean;
  enviadoEm: string | null;
  podeOperar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const podeEnviar = Boolean(email) && emailConfirmado;

  function enviar() {
    startTransition(async () => {
      const r = await reenviarTermo({ id: termoId });
      if (!r.ok) {
        setErro(r.erro);
        toast.error(r.erro, { duration: 9000 });
        return;
      }
      setErro(null);
      toast.success(r.aviso ?? "Via enviada ao funcionário.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {enviadoEm ? (
          <>
            <MailCheck className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              Via enviada para <strong className="text-foreground">{email}</strong> em{" "}
              {formatarDataHora(enviadoEm)}.
            </span>
          </>
        ) : (
          <>
            <MailWarning className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              O funcionário ainda não recebeu a própria via por e-mail.
            </span>
          </>
        )}
      </div>

      {podeOperar ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pendente || !podeEnviar}
            onClick={enviar}
          >
            <Send className="size-3.5" aria-hidden />
            {pendente ? "Enviando…" : enviadoEm ? "Reenviar via" : "Enviar via ao funcionário"}
          </Button>

          {/* Sem endereço o botão existiria só para falhar; com endereço não
              conferido ele existiria para falhar de um jeito pior. Os dois
              casos apontam o conserto em vez de deixar tentar. */}
          {!email ? (
            <span className="text-xs text-muted-foreground">
              Sem e-mail cadastrado — a via não tem para onde ir.{" "}
              <Link href="/termos/funcionarios" className="underline">
                Cadastre em Funcionários
              </Link>
              .
            </span>
          ) : !emailConfirmado ? (
            <span className="text-xs text-muted-foreground">
              <strong>{email}</strong> foi deduzido do nome e ainda não foi
              conferido. Enquanto estiver assim, nada é enviado.{" "}
              <Link href="/termos/funcionarios" className="underline">
                Confirme em Funcionários
              </Link>
              .
            </span>
          ) : null}
        </div>
      ) : null}

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}
