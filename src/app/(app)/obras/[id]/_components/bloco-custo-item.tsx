import { formatarBRL } from "@/lib/locacao";
import { resumirPorItem, type EntradaItemCusto } from "@/lib/custo-item";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/**
 * Orçado contra realizado, item por item — a conta de cada equipamento.
 *
 * É o fecho do que a diretoria pediu: o orçamento por item (subprojeto B)
 * confrontado com o rateio dos lançamentos (subprojeto C). Sem os dois, este
 * bloco não teria o que comparar.
 */
export function BlocoCustoItem({ entradas }: { entradas: EntradaItemCusto[] }) {
  const linhas = resumirPorItem(entradas);
  const semOrcamento = linhas.filter((l) => l.orcado === null).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Custo por item</CardTitle>
        <CardDescription>
          Orçado contra o que já foi atribuído a cada item, do maior desvio para o
          menor.
          {semOrcamento > 0 ? (
            <>
              {" "}
              {semOrcamento}{" "}
              {semOrcamento === 1 ? "item aparece" : "itens aparecem"} sem orçamento
              próprio — não é o mesmo que estar dentro do orçamento.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nada a comparar ainda. O orçado vem do detalhamento do orçamento da
            obra; o realizado, do rateio dos lançamentos por item.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Orçado</th>
                  <th className="py-2 text-right font-medium">Realizado</th>
                  <th className="py-2 text-right font-medium">Desvio</th>
                  <th className="py-2 text-right font-medium">Consumido</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const estourou = l.desvio !== null && l.desvio > 0;
                  return (
                    <tr key={l.itemId} className="border-b last:border-0">
                      <td className="py-2">{l.descricao}</td>
                      <td className="py-2 text-right tabular-nums">
                        {l.orcado === null ? "—" : formatarBRL(l.orcado)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatarBRL(l.realizado)}
                      </td>
                      <td
                        className={
                          estourou
                            ? "py-2 text-right font-semibold tabular-nums text-destructive"
                            : "py-2 text-right tabular-nums"
                        }
                      >
                        {l.desvio === null
                          ? "—"
                          : `${l.desvio > 0 ? "+" : ""}${formatarBRL(l.desvio)}`}
                      </td>
                      <td
                        className={
                          estourou
                            ? "py-2 text-right tabular-nums text-destructive"
                            : "py-2 text-right tabular-nums"
                        }
                      >
                        {pct(l.consumido)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
