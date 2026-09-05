import Link from "next/link";
import { PackageOpen, ChevronRight, MailWarning } from "lucide-react";

import { listarDevolucoesDaOrganizacao } from "@/lib/data/devolucoes";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  STATUS_DEVOLUCAO,
  STATUS_DEVOLUCAO_INFO,
  type StatusDevolucao,
} from "@/lib/devolucao";
import { formatarData } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Devoluções — Loca" };

/**
 * Lista de devoluções da organização.
 *
 * O que esta tela responde e nenhuma outra responde: quais devoluções ficaram
 * em RASCUNHO. Rascunho é conferência que ninguém fechou — não gerou número,
 * não baixou saldo e não avisou o fornecedor. E enquanto o saldo não baixa, o
 * contrato segue cobrando diária de equipamento que já está no pátio do
 * fornecedor.
 *
 * A coluna de aviso existe pelo mesmo motivo: devolução fechada sem aviso
 * enviado é o fornecedor sem saber que o equipamento voltou.
 */
export default async function DevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { q, from, to, page } = parseListParams(sp, {
    sortCols: [],
    defaultSort: "devolvido_em",
  });
  const obra = sp.obra ?? "";
  const status = sp.status ?? "";

  const [{ linhas, total }, obras] = await Promise.all([
    listarDevolucoesDaOrganizacao({ obra, status, q, from, to }),
    listarObrasParaFiltro(),
  ]);

  const tem = linhas.length > 0;
  const filtrando = Boolean(q || obra || status);
  const rascunhos = linhas.filter((d) => d.status === "rascunho").length;
  const semAviso = linhas.filter(
    (d) => d.status === "fechado" && !d.avisoEnviadoEm,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Devoluções"
        descricao={`Conferência do que volta ao fornecedor. · ${contagem(total, "devolução", "devoluções")} no filtro${
          rascunhos > 0 ? ` · ${rascunhos} em rascunho nesta página` : ""
        }${semAviso > 0 ? ` · ${semAviso} sem aviso enviado` : ""}`}
      />

      {tem || filtrando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por registro, nota ou responsável…"
              ariaLabel="Buscar devolução"
            />
            <SelectFilter
              param="obra"
              label="Obra"
              placeholder="Todas as obras"
              opcoes={obras.map((o) => ({
                value: o.id,
                label: `${o.codigo} — ${o.nome}`,
              }))}
            />
            <SelectFilter
              param="status"
              label="Situação"
              placeholder="Rascunho e fechada"
              opcoes={STATUS_DEVOLUCAO.map((s) => ({
                value: s,
                label: STATUS_DEVOLUCAO_INFO[s].label,
              }))}
            />
          </ListFilters>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registro</TableHead>
                    <TableHead>Devolvido em</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Entregue por</TableHead>
                    <TableHead className="text-right">Itens</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-12 text-right">Abrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tem ? (
                    // Linha com colSpan, e não EmptyState: preserva o cabeçalho
                    // e mostra sobre o que se está filtrando.
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhuma devolução no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {linhas.map((d) => {
                    const info = STATUS_DEVOLUCAO_INFO[d.status as StatusDevolucao];
                    const pendenteDeAviso =
                      d.status === "fechado" && !d.avisoEnviadoEm;
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {d.numeroRegistro ? formatarNumero(d.numeroRegistro) : "—"}
                          {d.contratoNumero ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              contrato {d.contratoNumero}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatarData(d.devolvidoEm)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.obraRotulo ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.fornecedorNome ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {d.responsavel ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {d.itens}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            {info ? (
                              <Badge variant={info.variant} title={info.ajuda}>
                                {info.label}
                              </Badge>
                            ) : (
                              d.status
                            )}
                            {/* Fechada sem aviso é o fornecedor sem saber que o
                                equipamento voltou. O ícone é o que traz a
                                pessoa até o botão de reenviar. */}
                            {pendenteDeAviso ? (
                              <MailWarning
                                className="size-3.5 text-muted-foreground"
                                aria-label="Fornecedor ainda não avisado"
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Abrir devolução"
                            render={<Link href={`/devolucoes/${d.id}`} />}
                          >
                            <ChevronRight />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      ) : (
        <EmptyState
          icon={<PackageOpen className="size-6" />}
          titulo="Nenhuma devolução registrada"
          descricao="A devolução é a conferência do que volta ao fornecedor: o que saiu da obra, em que condição e com qual ressalva. Ela nasce dentro do contrato de locação, na seção Devoluções."
          acao={{ label: "Ver contratos", href: "/contratos" }}
        />
      )}
    </div>
  );
}
