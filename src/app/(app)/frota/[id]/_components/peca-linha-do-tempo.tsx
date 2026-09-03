import { Clock } from "lucide-react";

import { montarLinhaDoTempo, descreverDetentor, DETENTOR_INFO, type Posse } from "@/lib/custodia";
import { formatarData } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";

/**
 * A linha do tempo da custódia: quem está, quem ficou, por quanto tempo.
 *
 * A posse aberta vem no topo porque a pergunta mais frequente é "onde está
 * AGORA". Período de termo cancelado fica à vista e marcado — documento
 * anulado não some do histórico, e "esteve com o Fulano" é diferente de
 * "houve um termo que não valeu".
 */
export function PecaLinhaDoTempo({ posses, hoje }: { posses: Posse[]; hoje: string }) {
  const linha = montarLinhaDoTempo(posses, hoje);

  if (linha.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem registro de posse. O histórico começa na primeira movimentação —
        peças cadastradas antes do livro não têm posse retroativa, e inventar
        uma seria registrar um fato que ninguém observou.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {linha.map((p) => (
        <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
          <span className="font-medium">{descreverDetentor(p)}</span>

          {p.aberta ? (
            <Badge variant={DETENTOR_INFO[p.tipo].variant}>Agora</Badge>
          ) : null}
          {p.anulada ? <Badge variant="destructive">Termo cancelado</Badge> : null}

          <span className="text-sm tabular-nums text-muted-foreground">
            {formatarData(p.inicio)} — {p.fim ? formatarData(p.fim) : "em aberto"}
          </span>

          <span className="ml-auto flex items-center gap-1 text-sm tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" />
            {p.periodo}
          </span>

          {p.termoNumero ? (
            <span className="w-full text-xs text-muted-foreground">
              Termo {p.termoNumero}
            </span>
          ) : null}
          {p.observacoes ? (
            <span className="w-full text-xs text-muted-foreground">{p.observacoes}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
