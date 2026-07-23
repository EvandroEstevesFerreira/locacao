import Link from "next/link";
import { HardHat, Plus, Pencil } from "lucide-react";
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
import { excluirObra } from "./actions";

export const metadata = { title: "Obras — Loca" };

const STATUS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  encerrada: { label: "Encerrada", variant: "outline" },
};

export default async function ObrasPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obra")
    .select("id, codigo, nome, responsavel, status")
    .order("codigo");

  const temObras = (obras?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titulo="Obras" descricao="Obras e contratos da organização.">
        {podeEditar ? (
          <Button render={<Link href="/obras/nova" />}>
            <Plus className="size-4" />
            Nova obra
          </Button>
        ) : null}
      </PageHeader>

      {temObras ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <HardHat className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma obra cadastrada ainda</p>
            {podeEditar ? (
              <Button render={<Link href="/obras/nova" />}>
                <Plus className="size-4" />
                Cadastrar primeira obra
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
