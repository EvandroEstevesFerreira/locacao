import Link from "next/link";
import { Wrench, ChevronRight, Plus, CalendarClock } from "lucide-react";

import { listarReparosDaOrganizacao } from "@/lib/data/reparos";
import {
  STATUS_REPARO,
  STATUS_REPARO_INFO,
  RESPONSABILIDADES,
  RESPONSABILIDADE_INFO,
  type StatusReparo,
} from "@/lib/reparo";
import { formatarBRL, formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
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

export const metadata = { title: "Ordens de reparo — Loca" };

/**
 * Ordens de reparo de equipamento.
 *
 * O que esta tela responde e nenhuma outra respondia: quais peças estão FORA e
 * há quanto tempo. Antes dela, equipamento que ia para conserto sumia — a peça
 * ficava marcada como "manutenção", um estado sem prazo, sem custo e sem quem
 * está com ela.
 *
 * Mora sob `/frota` porque o assunto é a PEÇA, e porque um reparo pode existir
 * sem avaria nenhuma: manutenção preventiva é revisão de rotina, não dano.
 */
export default async function ReparosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { q, from, to, page } = parseListParams(sp, {
    sortCols: [],
    defaultSort: "aberto_em",
  });
  const status = sp.status ?? "";
  const responsabilidade = sp.responsabilidade ?? "";

  const [{ linhas, total }, perfil] = await Promise.all([
    listarReparosDaOrganizacao({ status, responsabilidade, q, from, to }),
    getCurrentPerfil(),
  ]);

  const tem = linhas.length > 0;
  const filtrando = Boolean(q || status || responsabilidade);
  const podeAbrir = podeOperar(perfil?.papel);

  // "Hoje" de Brasília: o Vercel roda em UTC e das 21h à meia-noite o atraso
  // seria calculado contra o dia seguinte, marcando como atrasada uma ordem que
  // vence hoje.
  const hoje = hojeISOSaoPaulo();
  const fora = linhas.filter((r) => r.status === "em_execucao");
  const atrasadas = fora.filter(
    (r) => r.previsto_para !== null && r.previsto_para < hoje,
  ).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Ordens de reparo"
        descricao={`Equipamento em conserto: onde está, desde quando e quanto custa. · ${contagem(total, "ordem", "ordens")} no filtro${
          fora.length > 0 ? ` · ${fora.length} fora da obra nesta página` : ""
        }${atrasadas > 0 ? ` · ${atrasadas} com prazo vencido` : ""}`}
        acoes={
          podeAbrir ? (
            <Button render={<Link href="/frota/reparos/nova" />}>
              <Plus className="size-4" aria-hidden />
              Abrir ordem
            </Button>
          ) : undefined
        }
      />

      {tem || filtrando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por ordem, serviço ou oficina…"
              ariaLabel="Buscar ordem de reparo"
            />
            <SelectFilter
              param="status"
              label="Situação"
              placeholder="Todas as situações"
              opcoes={STATUS_REPARO.map((s) => ({
                value: s,
                label: STATUS_REPARO_INFO[s].label,
              }))}
            />
            <SelectFilter
              param="responsabilidade"
              label="Quem paga"
              placeholder="Todas"
              opcoes={RESPONSABILIDADES.map((r) => ({
                value: r,
                label: RESPONSABILIDADE_INFO[r].label,
              }))}
            />
          </ListFilters>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Peça</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Oficina</TableHead>
                    <TableHead>Saída</TableHead>
                    <TableHead>Retorno</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="w-12 text-right">Abrir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tem ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-10 text-center text-muted-foreground"
                      >
                        Nenhuma ordem no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {linhas.map((r) => {
                    const info = STATUS_REPARO_INFO[r.status as StatusReparo];
                    const atrasada =
                      r.status === "em_execucao" &&
                      r.previsto_para !== null &&
                      r.previsto_para < hoje;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium tabular-nums">
                          {formatarNumero(r.numero_registro)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.unidadeIdentificador ?? "—"}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {r.itemDescricao ?? ""}
                          </span>
                        </TableCell>
                        <TableCell
                          className="max-w-[24ch] truncate"
                          title={r.descricao}
                        >
                          {r.descricao}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.executor ?? "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.enviado_em ? formatarData(r.enviado_em) : "—"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {r.concluido_em ? (
                            formatarData(r.concluido_em)
                          ) : r.previsto_para ? (
                            <span
                              className={
                                atrasada
                                  ? "inline-flex items-center gap-1 font-medium"
                                  : "text-muted-foreground"
                              }
                            >
                              {/* Prazo vencido com a peça ainda fora é o que
                                  esta tela existe para mostrar. */}
                              {atrasada ? (
                                <CalendarClock className="size-3" aria-hidden />
                              ) : null}
                              {formatarData(r.previsto_para)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.valor > 0 ? formatarBRL(r.valor) : "—"}
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
                            aria-label="Abrir ordem"
                            render={<Link href={`/frota/reparos/${r.id}`} />}
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
          icon={<Wrench className="size-6" />}
          titulo="Nenhuma ordem de reparo"
          descricao="A ordem de reparo autoriza a peça a sair da obra e responde onde ela está, desde quando e quanto vai custar. Ela pode nascer de uma avaria ou de uma revisão de rotina."
          acao={
            podeAbrir
              ? { label: "Abrir ordem", href: "/frota/reparos/nova" }
              : { label: "Ver frota", href: "/frota" }
          }
        />
      )}
    </div>
  );
}
