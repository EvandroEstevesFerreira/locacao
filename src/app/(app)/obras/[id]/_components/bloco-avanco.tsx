import { hojeISOSaoPaulo, formatarData } from "@/lib/locacao";
import {
  percentualPrazo,
  desvio,
  previsaoTermino,
  type PeriodoObra,
  type PontoAvanco,
} from "@/lib/avanco";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Um número do painel, com o rótulo em cima. */
function Numero({
  label,
  valor,
  detalhe,
  destaque,
}: {
  label: string;
  valor: string;
  detalhe?: string;
  destaque?: "atraso" | "adiantada";
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          destaque === "atraso"
            ? "text-lg font-semibold text-destructive"
            : "text-lg font-semibold"
        }
      >
        {valor}
      </p>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

function pct(v: number | null): string {
  return v === null ? "—" : `${v.toFixed(0)}%`;
}

/**
 * O bloco que cruza prazo com avanço — o par que a diretoria pediu.
 *
 * Nenhum dos dois números decide nada sozinho: "31% de obra" só vira
 * diagnóstico quando comparado com "55% de prazo". O desvio é o que se lê.
 */
export function BlocoAvanco({
  obra,
  historico,
}: {
  obra: PeriodoObra & { data_fim_prevista: string | null };
  historico: PontoAvanco[];
}) {
  // `hojeISOSaoPaulo`, nunca `new Date()`: comparação com coluna `date`, e o
  // Vercel roda em UTC — das 21h à meia-noite em Brasília a conta sai um dia
  // adiantada (o bug da 0.22.0).
  const hojeISO = hojeISOSaoPaulo();

  const atual = historico[0] ?? null;
  const fisico = atual?.percentual ?? null;
  const prazo = percentualPrazo(obra, hojeISO);
  const pontos = desvio(prazo, fisico);
  const previsao = previsaoTermino(historico, hojeISO);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avanço da obra</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {historico.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum avanço lançado ainda. O lançamento é semanal, na tela de Avanço
            das obras.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Numero
                label="Avanço físico"
                valor={pct(fisico)}
                detalhe={atual ? `semana de ${formatarData(atual.semana)}` : undefined}
              />
              <Numero
                label="Prazo decorrido"
                valor={pct(prazo)}
                detalhe={prazo === null ? "período não informado" : undefined}
              />
              <Numero
                label="Desvio"
                valor={pontos === null ? "—" : `${Math.abs(pontos).toFixed(0)} pts`}
                detalhe={
                  pontos === null
                    ? undefined
                    : pontos > 0
                      ? "de atraso"
                      : pontos < 0
                        ? "adiantada"
                        : "no prazo"
                }
                destaque={
                  pontos === null ? undefined : pontos > 0 ? "atraso" : "adiantada"
                }
              />
              <Numero
                label="Previsão de término"
                valor={previsao ? formatarData(previsao) : "—"}
                detalhe={
                  // Sem ritmo, não se inventa data: obra parada dividiria por
                  // zero e uma projeção absurda destrói a confiança no painel.
                  previsao
                    ? obra.data_fim_prevista
                      ? `previsto: ${formatarData(obra.data_fim_prevista)}`
                      : undefined
                    : "ritmo insuficiente para projetar"
                }
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Últimas semanas
              </p>
              <div className="divide-y rounded-md border text-sm">
                {historico.map((p) => (
                  <div key={p.semana} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">
                      {formatarData(p.semana)}
                    </span>
                    <span className="font-medium">{p.percentual}%</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
