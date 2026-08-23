import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL } from "@/lib/locacao";
import { gerarFluxoCaixa } from "@/lib/fluxo";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SelectFilter } from "@/components/shared/select-filter";
import { ListFilters } from "@/components/shared/list-filters";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Fluxo de caixa — Loca" };

export default async function FluxoCaixaPage({
  searchParams,
}: {
  searchParams: Promise<{ obra?: string }>;
}) {
  const { obra } = await searchParams;
  const supabase = await createClient();

  const [fluxo, obrasData] = await Promise.all([
    gerarFluxoCaixa(supabase, { obra_id: obra }),
    listarObrasParaFiltro(),
  ]);

  const prox3 = fluxo.meses.slice(0, 3).reduce((s, m) => s + m.total, 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Fluxo de caixa"
        descricao="Projeção de desembolsos por mês: lançamentos + contratos de equipamento e imóveis."
      />

      <ListFilters>
        <SelectFilter
          param="obra"
          label="Obra"
          placeholder="Todas as obras"
          opcoes={obrasData.map((o) => ({ value: o.id, label: `${o.codigo} — ${o.nome}` }))}
        />
      </ListFilters>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Total previsto (horizonte)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatarBRL(fluxo.totalPrevisto)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Próximos 3 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatarBRL(prox3)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de barras por mês */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desembolso por mês</CardTitle>
          <CardDescription>
            Barras proporcionais ao total previsto de cada mês.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {fluxo.meses.map((m) => (
            <div key={m.chave}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="capitalize">{m.label}</span>
                <span className="font-medium">{formatarBRL(m.total)}</span>
              </div>
              <div className="h-3 border border-border bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${fluxo.maxTotal > 0 ? (m.total / fluxo.maxTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Tabela detalhada */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Pendente</TableHead>
                <TableHead className="text-right">Projetado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fluxo.meses.map((m) => (
                <TableRow key={m.chave}>
                  {/* O mês leva aos lançamentos que o compõem. A coluna
                      "Projetado" ao lado explica sozinha por que a soma da
                      lista pode ser menor que o total: projeção não tem linha. */}
                  <TableCell className="font-medium capitalize">
                    <Link
                      href={`/financeiro?mes=${m.chave}${obra ? `&obra=${obra}` : ""}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {m.label}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatarBRL(m.pago)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatarBRL(m.pendente)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatarBRL(m.projetado)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatarBRL(m.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatarBRL(m.acumulado)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        &ldquo;Projetado&rdquo; = custo mensal estimado dos contratos de
        equipamento ativos e da parcela mensal dos imóveis (aluguel + condomínio
        + IPTU + seguro fiança, quando mensal) em meses sem lançamento próprio.
        Onde há lançamento, ele prevalece.
      </p>
    </div>
  );
}
