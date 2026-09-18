import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatarBRL } from "@/lib/locacao";
import type { ServicoDetalhe } from "@/lib/data/servicos";

/**
 * O rateio do contrato entre os centros de custo — e o que ninguém paga.
 *
 * A linha das ociosas é o ponto desta tela inteira. Ela aparece separada e sem
 * dono porque distribuir o custo das licenças que ninguém usa entre os
 * departamentos as faria desaparecer: cada um pagaria um pouco a mais sem
 * saber por quê, e ninguém jamais cancelaria assinatura nenhuma.
 */
export function BlocoRateio({ servico }: { servico: ServicoDetalhe }) {
  const { rateio } = servico;
  const temOciosas = rateio.ociosas.quantidade > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rateio por centro de custo</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro de custo</TableHead>
              <TableHead className="text-right">Pessoas</TableHead>
              <TableHead className="text-right">Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rateio.porCentroCusto.length === 0 && !temOciosas ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Nenhuma licença atribuída ainda.
                </TableCell>
              </TableRow>
            ) : null}

            {rateio.porCentroCusto.map((f) => {
              const nome = servico.atribuicoes.find(
                (a) => a.centro_custo_id === f.centroCustoId,
              )?.centro_custo_nome;
              return (
                <TableRow key={f.centroCustoId ?? "sem-centro"}>
                  <TableCell>
                    {/* Pessoa sem lotação vira uma fatia própria em vez de
                        sumir: sumir faria a soma não fechar com o total. */}
                    {nome ?? (
                      <span className="text-muted-foreground">
                        Sem centro de custo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.pessoas}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatarBRL(f.centavos / 100)}
                  </TableCell>
                </TableRow>
              );
            })}

            {temOciosas ? (
              <TableRow className="bg-destructive/5">
                <TableCell className="font-medium text-destructive">
                  Ociosas — ninguém está usando
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-destructive">
                  {rateio.ociosas.quantidade}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-destructive">
                  {formatarBRL(rateio.ociosas.centavos / 100)}
                </TableCell>
              </TableRow>
            ) : null}

            <TableRow>
              <TableCell className="font-medium">Total do contrato</TableCell>
              <TableCell className="text-right tabular-nums">
                {servico.quantidade}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {/* A soma das partes bate com o total ao centavo — há teste
                    rodando 200 combinações quaisquer cobrando isso. */}
                {formatarBRL(rateio.totalCentavos / 100)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
