import Link from "next/link";
import { HardHat, Plus, Pencil } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
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
import { ListSearch } from "@/components/shared/list-search";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { listarObras } from "@/lib/data/obras";
import {
  TIPO_CENTRO_CUSTO,
  TIPO_CENTRO_CUSTO_INFO,
  ordenarComHierarquia,
  type TipoCentroCusto,
} from "@/lib/centro-custo";
import { ListFilters } from "@/components/shared/list-filters";
import { SelectFilter } from "@/components/shared/select-filter";
import { excluirObra } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";
import { STATUS_OBRA_INFO, type StatusObra } from "@/lib/obra";

export const metadata = { title: "Centros de custo — Loca" };

export default async function ObrasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const sp = await searchParams;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["codigo", "nome", "responsavel", "status"],
    defaultSort: "codigo",
  });

  // O filtro de tipo é validado contra a lista: querystring é entrada do
  // usuário, e um `?tipo=x` qualquer viraria `.eq("tipo","x")` — consulta
  // recusada pelo PostgREST, lista vazia, e nada na tela explicando.
  const tipoFiltro = (TIPO_CENTRO_CUSTO as readonly string[]).includes(sp.tipo ?? "")
    ? (sp.tipo as TipoCentroCusto)
    : undefined;

  const { itens, total } = await listarObras({ q, sort, ascending, from, to }, tipoFiltro);
  // A indentação é REGRA, não CSS — por isso vem de função pura e testada.
  // Um setor cujo pai caiu noutra página (ou que a RLS escondeu) aparece na
  // raiz, e não some.
  const obras = ordenarComHierarquia(itens);
  const temObras = obras.length > 0;
  const buscando = q.length > 0 || !!tipoFiltro;

  return (
    <div className="pagina-lista space-y-6">
      <PageHeader
        titulo="Centros de custo"
        descricao={`Obras e departamentos da organização. · ${contagem(total, "centro de custo", "centros de custo")} no filtro`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/obras/nova" />}>
              <Plus className="size-4" />
              Novo centro de custo
            </Button>
          ) : null
        }
      />

      {temObras || buscando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por código, nome ou responsável…"
              ariaLabel="Buscar centro de custo"
            />
            <SelectFilter
              param="tipo"
              label="Tipo"
              placeholder="Obras e departamentos"
              opcoes={TIPO_CENTRO_CUSTO.map((t) => ({
                value: t,
                label: TIPO_CENTRO_CUSTO_INFO[t].label,
              }))}
            />
          </ListFilters>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="codigo" label="Código" /></TableHead>
                  <TableHead><SortHeader column="nome" label="Nome" /></TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead><SortHeader column="responsavel" label="Responsável" /></TableHead>
                  <TableHead><SortHeader column="status" label="Status" /></TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!temObras ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {q
                        ? `Nenhum centro de custo encontrado para “${q}”.`
                        : "Nenhum centro de custo neste filtro."}
                    </TableCell>
                  </TableRow>
                ) : null}
                {obras.map((obra) => {
                  const s = STATUS_OBRA_INFO[obra.status as StatusObra] ?? STATUS_OBRA_INFO.ativa;
                  const t = TIPO_CENTRO_CUSTO_INFO[obra.tipo] ?? TIPO_CENTRO_CUSTO_INFO.obra;
                  return (
                    <TableRow key={obra.id}>
                      <TableCell className="font-medium">{obra.codigo}</TableCell>
                      <TableCell>
                        {/* Setor entra recuado sob o seu departamento. O recuo
                            é o único sinal de hierarquia na lista, então ele
                            vem do `nivel` calculado, não de uma classe fixa. */}
                        <span style={{ paddingLeft: obra.nivel * 20 }} className="inline-block">
                          {obra.nivel > 0 ? (
                            <span aria-hidden className="text-muted-foreground">└ </span>
                          ) : null}
                          {obra.nome}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.variant}>{t.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {obra.responsavel ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {/* O lápis também é gated: `/obras/[id]` redireciona
                            para cá quem não é master ou administrador, então
                            oferecê-lo a gestor e operador era um botão que
                            devolvia a pessoa para a mesma lista, sem uma
                            palavra de explicação. Ausência honesta é melhor
                            que um caminho que volta ao ponto de partida. */}
                        <div className="flex items-center justify-end gap-1">
                          {podeEditar ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Editar"
                                render={<Link href={`/obras/${obra.id}`} />}
                              >
                                <Pencil />
                              </Button>
                              <ConfirmDelete action={excluirObra} id={obra.id} />
                            </>
                          ) : null}
                        </div>
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
          icon={<HardHat />}
          titulo="Nenhum centro de custo cadastrado ainda"
          descricao="Obras e departamentos são o ponto de partida: contratos, imóveis, equipamentos e lançamentos são vinculados a eles."
          acao={podeEditar ? { label: "Novo centro de custo", href: "/obras/nova" } : undefined}
        />
      )}
    </div>
  );
}
