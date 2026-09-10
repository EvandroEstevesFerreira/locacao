"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock } from "lucide-react";

import {
  montarLinhaDoTempo,
  descreverDetentor,
  DETENTOR_INFO,
  posseOculta,
  type Posse,
} from "@/lib/custodia";
import { formatarData } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";

/**
 * A linha do tempo da custódia: quem está, quem ficou, por quanto tempo.
 *
 * A posse aberta vem no topo porque a pergunta mais frequente é "onde está
 * AGORA".
 *
 * ┌─ POSSE DE TERMO CANCELADO FICA RECOLHIDA, e não escondida ───────────────┐
 * │ Este arquivo dizia o contrário: "documento anulado não some do histórico, │
 * │ e 'esteve com o Fulano' é diferente de 'houve um termo que não valeu'".   │
 * │ A intenção continua certa — o que mudou foi a escala.                    │
 * │                                                                          │
 * │ O mutirão de regularização emitiu 142 termos para 95 peças (um `useState`│
 * │ que não reinicializava entre rodadas, corrigido na 0.98.1), e os 48      │
 * │ duplicados foram cancelados. Na `14L4594` isso virou QUATRO linhas, três │
 * │ delas anuladas no mesmo dia, para uma posse que importa.                 │
 * │                                                                          │
 * │ Histórico que ninguém consegue ler protege menos que histórico curto. Por│
 * │ isso elas saem da primeira leitura e ficam a UM CLIQUE — não apagadas do │
 * │ banco, que é onde a auditoria as procura.                                │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function PecaLinhaDoTempo({
  posses,
  hoje,
}: {
  posses: Posse[];
  hoje: string;
}) {
  const [mostrarAnuladas, setMostrarAnuladas] = useState(false);
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

  const anuladas = linha.filter(posseOculta);
  const visiveis = mostrarAnuladas ? linha : linha.filter((p) => !posseOculta(p));

  return (
    <div className="space-y-2">
      {/* Uma peça cujo histórico inteiro seja de termos cancelados ficaria com
          a lista vazia e sem explicação. A posse ABERTA nunca é recolhida —
          ver `posseOculta`. */}
      {visiveis.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todo o histórico desta peça é de termos cancelados.
        </p>
      ) : (
        <ol className="divide-y">
          {visiveis.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
            >
              <span className="font-medium">{descreverDetentor(p)}</span>

              {p.aberta ? (
                <Badge variant={DETENTOR_INFO[p.tipo].variant}>Agora</Badge>
              ) : null}
              {p.anulada ? (
                <Badge variant="destructive">Termo cancelado</Badge>
              ) : null}

              <span className="text-sm tabular-nums text-muted-foreground">
                {formatarData(p.inicio)} —{" "}
                {p.fim ? formatarData(p.fim) : "em aberto"}
              </span>

              <span className="ml-auto flex items-center gap-1 text-sm tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" />
                {p.periodo}
              </span>

              {/* LINK, e não texto. Ele era só o número escrito, e quem
                  precisava do termo — para devolver, para reimprimir — tinha de
                  ir caçá-lo na lista de Termos com aquele número na cabeça. */}
              {p.termoNumero ? (
                <span className="w-full text-xs text-muted-foreground">
                  {p.termoId ? (
                    <Link
                      href={`/termos/${p.termoId}`}
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Termo {p.termoNumero}
                    </Link>
                  ) : (
                    <>Termo {p.termoNumero}</>
                  )}
                </span>
              ) : null}
              {p.observacoes ? (
                <span className="w-full text-xs text-muted-foreground">
                  {p.observacoes}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {anuladas.length > 0 ? (
        <button
          type="button"
          onClick={() => setMostrarAnuladas((v) => !v)}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {mostrarAnuladas
            ? "Ocultar as posses de termos cancelados"
            : anuladas.length === 1
              ? "Mostrar 1 posse de termo cancelado"
              : `Mostrar ${anuladas.length} posses de termos cancelados`}
        </button>
      ) : null}
    </div>
  );
}
