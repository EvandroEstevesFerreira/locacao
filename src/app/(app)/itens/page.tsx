import Link from "next/link";
import { Package, Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { TIPO_ITEM, type TipoItem } from "@/lib/itens";
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
import { PAGE_SIZE, contagem, parseListParams, termoOr } from "@/lib/lista";
import { excluirItem } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Itens — Loca" };

type Row = {
  id: string;
  tipo: TipoItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
  equipamento_unidade: { count: number }[];
};

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

  const supabase = await createClient();
  let query = supabase
    .from("item_catalogo")
    .select("id, tipo, descricao, unidade, ativo, equipamento_unidade(count)", { count: "exact" });
  if (q) query = query.or(termoOr(["descricao", "unidade"], q));
  query = query.order(sort, { ascending }).range(from, to);
  const { data, count } = await query;

  const itens = (data ?? []) as Row[];
  const total = count ?? 0;
  const tem = itens.length > 0;
  const buscando = q.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Itens"
        descricao={`Catálogo de equipamentos e materiais que a organização aluga. · ${contagem(total, "item", "itens")} no filtro`}
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
          <ListSearch placeholder="Buscar por descrição ou unidade…" ariaLabel="Buscar item" />
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="descricao" label="Descrição" /></TableHead>
                  <TableHead><SortHeader column="tipo" label="Tipo" /></TableHead>
                  <TableHead><SortHeader column="unidade" label="Unidade" /></TableHead>
                  <TableHead><SortHeader column="ativo" label="Status" /></TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tem ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhum item encontrado para “{q}”.
                    </TableCell>
                  </TableRow>
                ) : null}
                {itens.map((item) => {
                  const t = TIPO_ITEM[item.tipo];
                  const qtdUnidades = item.equipamento_unidade?.[0]?.count ?? 0;
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
