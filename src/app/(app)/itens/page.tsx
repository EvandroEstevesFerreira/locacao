import Link from "next/link";
import { Package, Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { TIPO_ITEM, type TipoItem } from "@/lib/itens";
import { PageHeader } from "@/components/page-header";
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
import { excluirItem } from "./actions";

export const metadata = { title: "Itens — Loca" };

type Row = {
  id: string;
  tipo: TipoItem;
  descricao: string;
  unidade: string | null;
  ativo: boolean;
  equipamento_unidade: { count: number }[];
};

export default async function ItensPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  const { data } = await supabase
    .from("item_catalogo")
    .select("id, tipo, descricao, unidade, ativo, equipamento_unidade(count)")
    .order("descricao");

  const itens = (data ?? []) as Row[];
  const tem = itens.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Itens"
        descricao="Catálogo de equipamentos e materiais que a organização aluga."
      >
        {podeEditar ? (
          <Button render={<Link href="/itens/novo" />}>
            <Plus className="size-4" />
            Novo item
          </Button>
        ) : null}
      </PageHeader>

      {tem ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Package className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum item cadastrado ainda</p>
            {podeEditar ? (
              <Button render={<Link href="/itens/novo" />}>
                <Plus className="size-4" />
                Cadastrar primeiro item
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
