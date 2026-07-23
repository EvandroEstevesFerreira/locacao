import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
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

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  financeiro: "Financeiro",
  operacional: "Operacional",
  visualizador: "Visualizador",
};

export default async function UsuariosPage() {
  const perfil = await getCurrentPerfil();
  if (perfil?.papel !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("perfil")
    .select("id, nome, email, papel, ativo")
    .order("nome");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Usuários"
        descricao="Papéis e acesso por obra dos usuários da organização."
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Papel</TableHead>
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
                  <TableCell>{PAPEL_LABEL[u.papel] ?? u.papel}</TableCell>
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

      <p className="text-sm text-muted-foreground">
        Para convidar novos usuários, cadastre-os no painel do Supabase
        (Authentication → Users) — eles aparecerão aqui automaticamente. O
        convite por e-mail dentro do app entra numa fase futura.
      </p>
    </div>
  );
}
