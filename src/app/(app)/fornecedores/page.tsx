import Link from "next/link";
import { Truck, Plus, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
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
import { excluirFornecedor } from "./actions";

export const metadata = { title: "Fornecedores — Loca" };

export default async function FornecedoresPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  const { data: fornecedores } = await supabase
    .from("fornecedor")
    .select("id, nome, cnpj, contato_nome, contato_telefone, ativo")
    .order("nome");

  const tem = (fornecedores?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Locadores"
        titulo="Fornecedores"
        descricao="Locadoras e fornecedores de quem a organização aluga."
      >
        {podeEditar ? (
          <Button render={<Link href="/fornecedores/novo" />}>
            <Plus className="size-4" />
            Novo fornecedor
          </Button>
        ) : null}
      </PageHeader>

      {tem ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores!.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.cnpj ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.contato_nome ?? "—"}
                      {f.contato_telefone ? ` · ${f.contato_telefone}` : ""}
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
                          <ConfirmDelete
                            action={excluirFornecedor}
                            id={f.id}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Truck className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum fornecedor cadastrado ainda</p>
            {podeEditar ? (
              <Button render={<Link href="/fornecedores/novo" />}>
                <Plus className="size-4" />
                Cadastrar primeiro fornecedor
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
