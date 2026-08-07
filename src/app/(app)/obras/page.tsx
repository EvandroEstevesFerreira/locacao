import Link from "next/link";
import { HardHat, Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
import { PAGE_SIZE, contagem, parseListParams, termoOr } from "@/lib/lista";
import { excluirObra } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata = { title: "Obras — Loca" };

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  encerrada: { label: "Encerrada", variant: "outline" },
};

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

  const supabase = await createClient();
  let query = supabase
    .from("obra")
    .select("id, codigo, nome, responsavel, status", { count: "exact" });
  if (q) query = query.or(termoOr(["codigo", "nome", "responsavel"], q));
  query = query.order(sort, { ascending }).range(from, to);
  const { data: obras, count } = await query;

  const total = count ?? 0;
  const temObras = (obras?.length ?? 0) > 0;
  const buscando = q.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Obras"
        descricao={`Obras e contratos da organização. · ${contagem(total, "obra", "obras")} no filtro`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/obras/nova" />}>
              <Plus className="size-4" />
              Nova obra
            </Button>
          ) : null
        }
      />

      {temObras || buscando ? (
        <>
          <ListSearch placeholder="Buscar por código, nome ou responsável…" ariaLabel="Buscar obra" />
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="codigo" label="Código" /></TableHead>
                  <TableHead><SortHeader column="nome" label="Nome" /></TableHead>
                  <TableHead><SortHeader column="responsavel" label="Responsável" /></TableHead>
                  <TableHead><SortHeader column="status" label="Status" /></TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!temObras ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      Nenhuma obra encontrada para “{q}”.
                    </TableCell>
                  </TableRow>
                ) : null}
                {obras!.map((obra) => {
                  const s = STATUS[obra.status] ?? STATUS.ativa;
                  return (
                    <TableRow key={obra.id}>
                      <TableCell className="font-medium">{obra.codigo}</TableCell>
                      <TableCell>{obra.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {obra.responsavel ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar"
                            render={<Link href={`/obras/${obra.id}`} />}
                          >
                            <Pencil />
                          </Button>
                          {podeEditar ? (
                            <ConfirmDelete action={excluirObra} id={obra.id} />
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
          titulo="Nenhuma obra cadastrada ainda"
          descricao="As obras são o ponto de partida: contratos, imóveis e lançamentos são vinculados a elas."
          acao={podeEditar ? { label: "Nova obra", href: "/obras/nova" } : undefined}
        />
      )}
    </div>
  );
}
