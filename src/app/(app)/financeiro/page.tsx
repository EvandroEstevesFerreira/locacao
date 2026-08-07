import Link from "next/link";
import {
  Plus,
  Pencil,
  Undo2,
  Coins,
  RefreshCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { formatarBRL, formatarData, hojeISOSaoPaulo} from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, parseListParams } from "@/lib/lista";
import { alternarPago, excluirLancamento } from "./actions";
import { KpiCard } from "@/components/shared/kpi-card";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  listarLancamentos,
  obterTotaisFinanceiro,
} from "@/lib/data/financeiro";

export const metadata = { title: "Financeiro — Loca" };


export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeGerenciarFinanceiro(perfil?.papel);
  const sp = await searchParams;
  const { status, obra } = sp;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["vencimento", "valor", "status", "competencia", "descricao"],
    defaultSort: "vencimento",
  });

  const [{ itens: lancamentos, total }, totais, obras] = await Promise.all([
    listarLancamentos({ q, sort, ascending, from, to, status, obraId: obra }),
    // Os totais somam TODOS os lançamentos do filtro, não só os da página — por
    // isso é consulta separada, e por isso o recorte de filtro é compartilhado
    // com a listagem dentro de `lib/data/financeiro.ts`. Antes as duas condições
    // estavam escritas duas vezes aqui, e um filtro novo esquecido num dos lados
    // fazia os indicadores discordarem da tabela em silêncio.
    obterTotaisFinanceiro({ q, status, obraId: obra }),
    listarObrasParaFiltro(),
  ]);

  const hojeStr = hojeISOSaoPaulo();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a pagar das locações, por obra e vencimento."
        acoes={
          <>
            <Button
              variant="secondary"
              render={<Link href="/financeiro/fluxo" />}
            >
              Fluxo de caixa
            </Button>
            {podeEditar ? (
              <>
                <Button variant="secondary" render={<Link href="/financeiro/recorrentes" />}>
                  <RefreshCw className="size-4" />
                  Gerar recorrentes
                </Button>
                <Button render={<Link href="/financeiro/novo" />}>
                  <Plus className="size-4" />
                  Novo lançamento
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={<Clock />}
          label="A pagar (pendente)"
          value={formatarBRL(totais.pendente)}
          variant="warning"
        />
        <KpiCard
          icon={<AlertTriangle />}
          label="Vencido"
          value={formatarBRL(totais.vencido)}
          variant="danger"
        />
        <KpiCard
          icon={<CheckCircle2 />}
          label="Pago"
          value={formatarBRL(totais.pago)}
          variant="success"
        />
      </div>

      <ListFilters>
        <ListSearch placeholder="Buscar por descrição…" ariaLabel="Buscar lançamento" />
        <SelectFilter
          param="obra"
          label="Obra"
          placeholder="Todas as obras"
          opcoes={obras.map((o) => ({ value: o.id, label: `${o.codigo} — ${o.nome}` }))}
        />
        <SelectFilter
          param="status"
          label="Status"
          placeholder="Todos"
          opcoes={[
            { value: "pendente", label: "Pendente" },
            { value: "pago", label: "Pago" },
          ]}
        />
      </ListFilters>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="descricao" label="Descrição" /></TableHead>
                <TableHead>Obra</TableHead>
                <TableHead><SortHeader column="competencia" label="Competência" /></TableHead>
                <TableHead><SortHeader column="vencimento" label="Vencimento" /></TableHead>
                <TableHead className="text-right"><SortHeader column="valor" label="Valor" /></TableHead>
                <TableHead><SortHeader column="status" label="Status" /></TableHead>
                {podeEditar ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                lancamentos.map((l) => {
                  const vencido = l.status === "pendente" && l.vencimento < hojeStr;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.descricao}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.obraCodigo ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.competencia.slice(0, 7).split("-").reverse().join("/")}
                      </TableCell>
                      <TableCell className={vencido ? "font-medium text-destructive" : ""}>
                        {formatarData(l.vencimento)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatarBRL(Number(l.valor))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.status === "pago" ? "secondary" : vencido ? "destructive" : "default"}>
                          {l.status === "pago" ? "Pago" : vencido ? "Vencido" : "Pendente"}
                        </Badge>
                      </TableCell>
                      {podeEditar ? (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {l.status === "pago" ? (
                              <form action={alternarPago}>
                                <input type="hidden" name="id" value={l.id} />
                                <input type="hidden" name="novo_status" value="pendente" />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Reabrir"
                                >
                                  <Undo2 />
                                </Button>
                              </form>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Dar baixa"
                                render={<Link href={`/financeiro/${l.id}/baixa`} />}
                              >
                                <Coins />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Editar"
                              render={<Link href={`/financeiro/${l.id}`} />}
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDelete action={excluirLancamento} id={l.id} />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}

