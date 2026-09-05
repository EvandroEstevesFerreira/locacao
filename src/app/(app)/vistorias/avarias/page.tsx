import Link from "next/link";
import { ShieldAlert, ChevronRight, FileText } from "lucide-react";

import { listarAvariasDaOrganizacao } from "@/lib/data/avarias";
import {
  STATUS_AVARIA_VALORES,
  STATUS_AVARIA_INFO,
  RESPONSABILIDADES,
  RESPONSABILIDADE_INFO,
  type StatusAvaria,
  type Responsabilidade,
} from "@/lib/avaria";
import { formatarBRL, formatarData } from "@/lib/locacao";
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

export const metadata = { title: "Avarias — Loca" };

/**
 * Avarias da organização.
 *
 * O que esta tela responde e nenhuma outra respondia: quais danos estão
 * ABERTOS e ainda A APURAR, e quanto eles somam. A avaria nascia dentro de uma
 * vistoria e só era encontrada por quem abrisse a vistoria certa — de modo que
 * um dano de dois mil reais podia ficar sem desfecho por meses sem aparecer em
 * lugar nenhum.
 *
 * Mora sob `/vistorias` de propósito: a avaria nasce numa vistoria e herda a
 * liberação do módulo Vistorias. Uma rota de primeiro nível exigiria um módulo
 * próprio, e separar a permissão da avaria da permissão da vistoria em que ela
 * vive só produziria telas meio visíveis.
 */
export default async function AvariasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { q, from, to, page } = parseListParams(sp, {
    sortCols: [],
    defaultSort: "data",
  });
  const status = sp.status ?? "";
  const responsabilidade = sp.responsabilidade ?? "";

  const { linhas, total } = await listarAvariasDaOrganizacao({
    status,
    responsabilidade,
    q,
    from,
    to,
  });

  const tem = linhas.length > 0;
  const filtrando = Boolean(q || status || responsabilidade);

  // Duas leituras que o gestor faz antes de qualquer outra: quanto está em
  // aberto, e quanto disso ninguém apurou ainda.
  const abertas = linhas.filter((a) => a.status === "aberta");
  const somaAbertas = abertas.reduce((s, a) => s + a.custoEstimado, 0);
  const aApurar = linhas.filter((a) => a.responsabilidade === "indefinida").length;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Avarias"
        descricao={`Danos constatados em equipamento, e a apuração de quem responde. · ${contagem(total, "avaria", "avarias")} no filtro${
          somaAbertas > 0
            ? ` · ${formatarBRL(somaAbertas)} em aberto nesta página`
            : ""
        }${aApurar > 0 ? ` · ${aApurar} sem responsabilidade definida` : ""}`}
      />

      {tem || filtrando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por registro ou descrição…"
              ariaLabel="Buscar avaria"
            />
            <SelectFilter
              param="status"
              label="Situação"
              placeholder="Todas as situações"
              opcoes={STATUS_AVARIA_VALORES.map((s) => ({
                value: s,
                label: STATUS_AVARIA_INFO[s].label,
              }))}
            />
            <SelectFilter
              param="responsabilidade"
              label="Responsabilidade"
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
                    <TableHead>Registro</TableHead>
                    <TableHead>Constatada em</TableHead>
                    <TableHead>Dano</TableHead>
                    <TableHead>Peça</TableHead>
                    <TableHead>Obra</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead>Responsabilidade</TableHead>
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
                        Nenhuma avaria no filtro atual.
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {linhas.map((a) => {
                    const info = STATUS_AVARIA_INFO[a.status as StatusAvaria];
                    const resp =
                      RESPONSABILIDADE_INFO[a.responsabilidade as Responsabilidade];
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium tabular-nums">
                          {formatarNumero(a.numeroRegistro)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatarData(a.data)}
                        </TableCell>
                        <TableCell className="max-w-[22ch] truncate" title={a.descricao}>
                          <span className="inline-flex items-center gap-1.5">
                            {a.descricao}
                            {/* Um laudo escrito é o que separa a avaria
                                registrada da avaria apurada. Sem esta marca,
                                as duas parecem iguais na lista. */}
                            {a.temLaudo ? (
                              <FileText
                                className="size-3 shrink-0 text-muted-foreground"
                                aria-label="Tem laudo escrito"
                              />
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          {a.unidadeIdentificador ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.obraRotulo ?? "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.custoEstimado > 0 ? formatarBRL(a.custoEstimado) : "—"}
                        </TableCell>
                        <TableCell>
                          {resp ? (
                            <Badge variant={resp.variant} title={resp.ajuda}>
                              {resp.label}
                            </Badge>
                          ) : (
                            a.responsabilidade
                          )}
                        </TableCell>
                        <TableCell>
                          {info ? (
                            <Badge variant={info.variant} title={info.ajuda}>
                              {info.label}
                            </Badge>
                          ) : (
                            a.status
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Abrir laudo"
                            render={<Link href={`/vistorias/avarias/${a.id}`} />}
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
          icon={<ShieldAlert className="size-6" />}
          titulo="Nenhuma avaria registrada"
          descricao="A avaria nasce numa vistoria, ou sozinha quando um item volta com ressalva na devolução. Daqui ela recebe o laudo — a apuração de quem responde pelo dano."
          acao={{ label: "Ver vistorias", href: "/vistorias" }}
        />
      )}
    </div>
  );
}
