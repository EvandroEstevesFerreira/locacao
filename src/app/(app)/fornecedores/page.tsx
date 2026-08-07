import Link from "next/link";
import { Truck, Plus, Pencil } from "lucide-react";
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
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, parseListParams, termoOr } from "@/lib/lista";
import { FornecedoresToolbar } from "./fornecedores-toolbar";
import { excluirFornecedor } from "./actions";
import { EmptyState } from "@/components/shared/empty-state";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Fornecedores — Loca" };

type Forn = {
  id: string;
  nome: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  ativo: boolean;
  fornecedor_obra: { obra: { id: string; codigo: string } | null }[];
};

export default async function FornecedoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const obra = sp.obra ?? "";
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["nome", "cnpj", "ativo"],
    defaultSort: "nome",
  });
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  // Filtro por obra vira join interno (server-side) para paginar corretamente.
  const embed = obra
    ? "fornecedor_obra!inner(obra:obra_id(id, codigo))"
    : "fornecedor_obra(obra:obra_id(id, codigo))";
  const [{ data: fornecedoresData, count }, obrasData] = await Promise.all([
    (() => {
      let query = supabase
        .from("fornecedor")
        .select(
          `id, nome, cnpj, contato_nome, contato_telefone, ativo, ${embed}`,
          { count: "exact" },
        );
      if (obra) query = query.eq("fornecedor_obra.obra_id", obra);
      if (q) query = query.or(termoOr(["nome", "cnpj"], q));
      return query.order(sort, { ascending }).range(from, to);
    })(),
    listarObrasParaFiltro(),
  ]);

  const fornecedores = (fornecedoresData ?? []) as unknown as Forn[];
  const total = count ?? 0;
  const tem = fornecedores.length > 0;
  const filtrando = Boolean(q || obra);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Fornecedores"
        descricao="Locadoras e fornecedores de quem a organização aluga."
        acoes={
          podeEditar ? (
            <Button render={<Link href="/fornecedores/novo" />}>
              <Plus className="size-4" />
              Novo fornecedor
            </Button>
          ) : null
        }
      />

      <FornecedoresToolbar obras={obrasData} q={q} obra={obra} />

      {tem ? (
        <>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="nome" label="Nome" /></TableHead>
                  <TableHead><SortHeader column="cnpj" label="CNPJ" /></TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Obras</TableHead>
                  <TableHead><SortHeader column="ativo" label="Status" /></TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map((f) => {
                  const codigos = (f.fornecedor_obra ?? [])
                    .map((fo) => fo.obra?.codigo)
                    .filter(Boolean);
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.cnpj ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {f.contato_nome ?? "—"}
                        {f.contato_telefone ? ` · ${f.contato_telefone}` : ""}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {codigos.length ? codigos.join(", ") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.ativo ? "default" : "outline"}>
                          {f.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Editar"
                            render={<Link href={`/fornecedores/${f.id}`} />}
                          >
                            <Pencil />
                          </Button>
                          {podeEditar ? (
                            <ConfirmDelete action={excluirFornecedor} id={f.id} />
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
      ) : filtrando ? (
        <EmptyState
          titulo="Nenhum fornecedor encontrado"
          descricao="Ajuste a busca ou o filtro de obra."
        />
      ) : (
        <EmptyState
          icon={<Truck />}
          titulo="Nenhum fornecedor cadastrado ainda"
          descricao="Cadastre as locadoras e fornecedores de quem a organização aluga."
          acao={podeEditar ? { label: "Novo fornecedor", href: "/fornecedores/novo" } : undefined}
        />
      )}
    </div>
  );
}
