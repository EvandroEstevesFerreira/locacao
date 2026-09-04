import Link from "next/link";
import { ClipboardList, ChevronRight } from "lucide-react";

import { listarRecebimentosDaOrganizacao } from "@/lib/data/recebimentos";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  STATUS_RECEBIMENTO,
  STATUS_RECEBIMENTO_INFO,
  type StatusRecebimento,
} from "@/lib/recebimento";
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

export const metadata = { title: "Recebimentos — Loca" };

/**
 * Lista de recebimentos da organização.
 *
 * Esta rota estava no `MODULOS` e no menu desde a 0.39.0 apontando para o
 * VAZIO: a pasta existia só com `[id]`, então quem tinha o módulo liberado
 * clicava em "Recebimentos" e caía num 404. A conferência era alcançável
 * apenas de dentro do contrato.
 *
 * O que esta tela responde e nenhuma outra respondia: quais recebimentos
 * ficaram em rascunho. Rascunho é conferência que ninguém fechou — não gerou
 * número, não avisou o fornecedor e não carimbou a retirada nos itens do
 * contrato. Sem uma lista, ele só é encontrado por quem abre o contrato certo
 * por acaso.
 */
export default async function RecebimentosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { q, from, to, page } = parseListParams(sp, {
    sortCols: [],
    defaultSort: "recebido_em",
  });
  const obra = sp.obra ?? "";
  const status = sp.status ?? "";

  const [{ linhas, total }, obras] = await Promise.all([
    listarRecebimentosDaOrganizacao({ obra, status, q, from, to }),
    listarObrasParaFiltro(),
  ]);

  const tem = linhas.length > 0;
  const filtrando = Boolean(q || obra || status);
  const rascunhos = linhas.filter((r) => r.status === "rascunho").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Recebimentos"
        descricao={`Conferência do que chega do fornecedor. · ${contagem(total, "recebimento", "recebimentos")} no filtro${
          rascunhos > 0
            ? ` · ${rascunhos} em rascunho nesta página`
            : ""
        }`}
      />

      {tem || filtrando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por registro, nota ou conferente…"
              ariaLabel="Buscar recebimento"
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
              placeholder="Rascunho e fechado"
              opcoes={STATUS_RECEBIMENTO.map((s) => ({
                value: s,
                label: STATUS_RECEBIMENTO_INFO[s].label,
              }))}
            />
          </ListFilters>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registro</TableHead>
                    <TableHead>Recebido em</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Conferente</TableHead>
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
                        Nenhum recebimento no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {linhas.map((r) => {
                    const info =
                      STATUS_RECEBIMENTO_INFO[r.status as StatusRecebimento];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">
                          {r.numeroRegistro
                            ? formatarNumero(r.numeroRegistro)
                            : "—"}
                          {r.contratoNumero ? (
                            <span className="ml-2 text-xs text-muted-foreground">
                              contrato {r.contratoNumero}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatarData(r.recebidoEm)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.obraRotulo ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.fornecedorNome ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.conferente ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.itens}
                        </TableCell>
                        <TableCell>
                          {info ? (
                            <Badge variant={info.variant} title={info.ajuda}>
                              {info.label}
                            </Badge>
                          ) : (
                            r.status
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Abrir recebimento"
                            render={<Link href={`/recebimentos/${r.id}`} />}
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
          icon={<ClipboardList className="size-6" />}
          titulo="Nenhum recebimento registrado"
          descricao="O recebimento é a conferência do que o fornecedor entregou: o que chegou, em que condição e com qual nota. Ele nasce dentro do contrato de locação, na seção Recebimentos."
          acao={{ label: "Ver contratos", href: "/contratos" }}
        />
      )}
    </div>
  );
}
