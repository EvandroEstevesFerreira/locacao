import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeGerenciarUsuarios,
  PAPEL_INFO,
  type Papel,
} from "@/lib/auth";
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

export const metadata = { title: "Usuários — Loca" };

export default async function UsuariosPage() {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarUsuarios(perfil?.papel)) redirect("/");

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("perfil")
    .select("id, nome, email, papel, ativo")
    .order("nome");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Usuários"
        descricao="Perfis e acesso por obra dos usuários da organização."
      >
        <Button render={<Link href="/usuarios/novo" />}>
          <Plus className="size-4" />
          Novo usuário
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usuarios ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.nome ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.email}
                  </TableCell>
                  <TableCell>
                    {PAPEL_INFO[u.papel as Papel]?.label ?? u.papel}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.ativo ? "default" : "outline"}>
                      {u.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Editar"
                      render={<Link href={`/usuarios/${u.id}`} />}
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
