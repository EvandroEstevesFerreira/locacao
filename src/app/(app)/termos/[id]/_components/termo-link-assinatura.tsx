"use client";

// Assinatura à distância, do lado de quem opera.
//
// Só aparece em RASCUNHO: termo emitido já foi assinado, cancelado não vale.
//
// Os pré-requisitos são conferidos AQUI e de novo na action. Aqui para não
// oferecer um botão que só sabe falhar; lá porque a tela pode ser contornada.
// E são três porque o link precisa de três coisas para funcionar, cada uma
// falhando de um jeito diferente:
//
//   sem e-mail            não tem para onde ir
//   e-mail por conferir   o endereço foi DEDUZIDO do nome — pode ser de outra pessoa
//   sem CPF               não há com o que conferir quem assinou

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Send, Ban, Clock, CircleCheckBig } from "lucide-react";
import { toast } from "sonner";
import { enviarLinkDeAssinatura, revogarLinksDoTermo } from "../../actions";
import { Button } from "@/components/ui/button";
import { formatarDataHora } from "@/lib/locacao";

export function TermoLinkAssinatura({
  termoId,
  email,
  emailConfirmado,
  temCpf,
  temItens,
  link,
  jaAssinouADistancia,
}: {
  termoId: string;
  email: string | null;
  emailConfirmado: boolean;
  temCpf: boolean;
  temItens: boolean;
  link: { expira_em: string; usado_em: string | null } | null;
  jaAssinouADistancia: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const impedimento = !email
    ? "sem-email"
    : !emailConfirmado
      ? "email-por-conferir"
      : !temCpf
        ? "sem-cpf"
        : !temItens
          ? "sem-itens"
          : null;

  function acao(fn: () => Promise<{ ok: boolean; erro?: string; aviso?: string }>) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setErro(r.erro ?? "Falhou.");
        toast.error(r.erro ?? "Falhou.", { duration: 9000 });
        return;
      }
      setErro(null);
      toast.success(r.aviso ?? "Pronto.");
      router.refresh();
    });
  }

  if (jaAssinouADistancia) {
    return (
      <div className="flex flex-wrap items-start gap-2 text-sm">
        <CircleCheckBig className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-muted-foreground">
          <strong className="text-foreground">O funcionário já assinou à distância.</strong>{" "}
          Falta emitir o termo abaixo — a assinatura dele não será pedida de novo.
        </p>
      </div>
    );
  }

  const vivo = link && !link.usado_em && new Date(link.expira_em) > new Date();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Quando o funcionário não está na sua frente, mande um link: ele confirma
        o CPF e assina pelo celular. Você emite o termo depois, aqui.
      </p>

      {vivo ? (
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          Link enviado, válido até {formatarDataHora(link.expira_em)}.
        </p>
      ) : null}

      {impedimento ? (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {impedimento === "sem-email" ? (
            <>
              O funcionário não tem e-mail cadastrado — o link não tem para onde
              ir.{" "}
              <Link href="/termos/funcionarios" className="underline">
                Cadastre em Funcionários
              </Link>
              .
            </>
          ) : impedimento === "email-por-conferir" ? (
            <>
              <strong>{email}</strong> foi deduzido do nome e ainda não foi
              conferido. Mandar um link de assinatura para um endereço adivinhado
              é o pior caso possível.{" "}
              <Link href="/termos/funcionarios" className="underline">
                Confirme em Funcionários
              </Link>
              .
            </>
          ) : impedimento === "sem-cpf" ? (
            <>
              O funcionário está <strong>sem CPF</strong> no cadastro. É o CPF que
              confirma, à distância, que foi a pessoa certa quem assinou — sem
              ele o link nunca destrava.{" "}
              <Link href="/termos/funcionarios" className="underline">
                Cadastre em Funcionários
              </Link>
              .
            </>
          ) : (
            <>Um termo sem itens não tem o que assinar. Acrescente os itens primeiro.</>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pendente}
            onClick={() => acao(() => enviarLinkDeAssinatura({ id: termoId }))}
          >
            <Send className="size-3.5" aria-hidden />
            {pendente ? "Enviando…" : vivo ? "Enviar outro link" : "Enviar link para assinar"}
          </Button>

          {vivo ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={pendente}
              onClick={() => acao(() => revogarLinksDoTermo({ id: termoId }))}
            >
              <Ban className="size-3.5" aria-hidden />
              Revogar
            </Button>
          ) : null}
        </div>
      )}

      {/* O token não é recuperável: o banco guarda só o hash dele. Dizer isso
          evita a pergunta "qual era mesmo o link?" e a busca por ele. */}
      {vivo ? (
        <p className="text-xs text-muted-foreground">
          O endereço do link não pode ser recuperado — ele só existe no e-mail
          que saiu. Se a pessoa perdeu, envie outro.
        </p>
      ) : null}

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}
