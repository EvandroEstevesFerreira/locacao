import Link from "next/link";
import { Package, Plus, Pencil } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { TIPO_ITEM } from "@/lib/itens";
import { listarItens } from "@/lib/data/itens";
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
import { ListFilters } from "@/components/shared/list-filters";
import { SelectFilter } from "@/components/shared/select-filter";
import { listarCategorias } from "@/lib/data/frota";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { excluirItem } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Itens — Loca" };

export default async function ItensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const sp = await searchParams;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["descricao", "tipo", "unidade", "ativo"],
    defaultSort: "descricao",
  });

  const categoria = sp.categoria ?? "";
  const [{ itens, total }, categorias] = await Promise.all([
    listarItens({ q, sort, ascending, from, to, categoria }),
    listarCategorias(),
  ]);
  const tem = itens.length > 0;
  const buscando = q.length > 0 || categoria.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Itens"
        descricao={`Catálogo de equipamentos e materiais — próprios e locados. · ${contagem(total, "item", "itens")} no filtro`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/itens/novo" />}>
              <Plus className="size-4" />
              Novo item
            </Button>
          ) : null
        }
      />

      {tem || buscando ? (
        <>
          {/* O catálogo passou de 5 para 32 itens com a importação do parque de
              TI. Com essa diversidade, a categoria deixa de ser detalhe e vira
              o primeiro corte de quem procura alguma coisa. */}
          <ListFilters>
            <ListSearch placeholder="Buscar por descrição ou unidade…" ariaLabel="Buscar item" />
            <SelectFilter
              param="categoria"
              label="Categoria"
              placeholder="Todas as categorias"
              opcoes={[
                ...categorias.map((c) => ({ value: c.id, label: c.nome })),
                { value: "sem", label: "Sem categoria" },
              ]}
            />
          </ListFilters>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="descricao" label="Descrição" /></TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead><SortHeader column="tipo" label="Tipo" /></TableHead>
                  <TableHead><SortHeader column="unidade" label="Unidade" /></TableHead>
                  <TableHead><SortHeader column="ativo" label="Status" /></TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tem ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhum item encontrado com esse filtro.
                    </TableCell>
                  </TableRow>
                ) : null}
                {itens.map((item) => {
                  const t = TIPO_ITEM[item.tipo];
                  const qtdUnidades = item.unidades;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.descricao}
                        {item.tipo === "equipamento" ? (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {qtdUnidades} un.
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.categoriaNome ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.variant}>{t.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {item.unidade ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.ativo ? "default" : "outline"}>
                          {item.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar"
                            render={<Link href={`/itens/${item.id}`} />}
                          >
                            <Pencil />
                          </Button>
                          {podeEditar ? (
                            <ConfirmDelete action={excluirItem} id={item.id} />
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
          icon={<Package />}
          titulo="Nenhum item cadastrado ainda"
          descricao="O catálogo alimenta os contratos: cadastre os equipamentos e materiais que a organização aluga."
          acao={podeEditar ? { label: "Novo item", href: "/itens/novo" } : undefined}
        />
      )}
    </div>
  );
}
