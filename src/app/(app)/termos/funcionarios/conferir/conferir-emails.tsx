"use client";

// A conferência dos endereços deduzidos.
//
// NÃO EXISTE "MARCAR TODOS", e é a decisão central desta tela. A regra que ela
// serve — endereço deduzido não recebe termo enquanto ninguém conferir — existe
// para que alguém OLHE cada endereço. Um botão que marca 97 de uma vez
// transformaria a regra em formalidade, e o primeiro endereço errado mandaria um
// documento assinável para fora da empresa.
//
// Por isso a linha põe o NOME e o ENDEREÇO lado a lado, na mesma altura: o olho
// confere "Elaine Silva → elaine.silva@sistenge.com" num movimento, e marcar
// vira o gesto de quem leu.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmarEmails } from "../../actions";
import { Button } from "@/components/ui/button";

export type LinhaConferencia = {
  id: string;
  nome: string;
  cargo: string | null;
  email: string;
};

export function ConferirEmails({ linhas }: { linhas: LinhaConferencia[] }) {
  const router = useRouter();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function alternar(id: string) {
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarEmails([...marcados]);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      if (r.aviso) toast.warning(r.aviso, { duration: 10_000 });
      else
        toast.success(
          marcados.size === 1
            ? "1 endereço confirmado."
            : `${marcados.size} endereços confirmados.`,
        );
      setMarcados(new Set());
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="divide-y rounded-md border">
        {linhas.map((l) => {
          const on = marcados.has(l.id);
          return (
            <label
              key={l.id}
              className={`flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm ${
                on ? "bg-muted/60" : "hover:bg-muted/30"
              }`}
            >
              <input
                type="checkbox"
                className="size-4 shrink-0"
                checked={on}
                disabled={pendente}
                onChange={() => alternar(l.id)}
                aria-label={`Confirmar o endereço de ${l.nome}`}
              />
              <span className="min-w-48 flex-1 font-medium">
                {l.nome}
                {l.cargo ? (
                  <span className="block text-xs font-normal text-muted-foreground">
                    {l.cargo}
                  </span>
                ) : null}
              </span>
              {/* Mono e à mesma altura do nome: é a comparação que a pessoa
                  precisa fazer, e o alinhamento é o que a torna um movimento
                  do olho em vez de duas leituras. */}
              <span className="font-mono text-xs text-muted-foreground">
                {l.email}
              </span>
            </label>
          );
        })}
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      {/* A barra fica grudada embaixo: com 97 linhas, um botão no fim da página
          obrigaria a rolar de volta depois de marcar as primeiras. */}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-md border bg-background/95 p-3 shadow-sm backdrop-blur">
        <span className="text-sm text-muted-foreground">
          {marcados.size === 0
            ? "Marque os endereços que você conferiu."
            : `${marcados.size} ${
                marcados.size === 1 ? "marcado" : "marcados"
              } de ${linhas.length}.`}
        </span>
        <Button
          onClick={salvar}
          disabled={pendente || marcados.size === 0}
          className="ml-auto"
        >
          <MailCheck className="size-4" aria-hidden />
          {pendente ? "Confirmando…" : "Confirmar os marcados"}
        </Button>
      </div>
    </div>
  );
}
