import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PAPEL_INFO } from "@/lib/permissoes";
import { usuariosDaOrganizacao, conclusoesDaOrganizacao } from "@/lib/data/treinamento";
import { resumirPendencias } from "@/lib/treinamento";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Quem treinou — Loca" };

/**
 * O painel de quem treinou e quem falta.
 *
 * `/treinamento` não é módulo liberável, então o proxy não protege esta rota —
 * a checagem de papel é AQUI, e é o único lugar que a faz.
 */
export default async function PendentesPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/treinamento");

  const [usuarios, conclusoes] = await Promise.all([
    usuariosDaOrganizacao(),
    conclusoesDaOrganizacao(),
  ]);

  const linhas = resumirPendencias(usuarios, conclusoes);
  const emDia = linhas.filter((l) => l.pendentes.length === 0).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Quem treinou"
        descricao={`${emDia} de ${linhas.length} em dia com o treinamento`}
        acoes={
          <Button variant="outline" render={<Link href="/treinamento" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
                <TableHead>O que falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum usuário ativo.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.perfilId}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {PAPEL_INFO[l.papel].label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.concluidas} de {l.total}
                    </TableCell>
                    <TableCell>
                      {l.pendentes.length === 0 ? (
                        <Badge variant="secondary">Em dia</Badge>
                      ) : (
                        <span className="text-sm">{l.pendentes.join(", ")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        O treinamento pendente não bloqueia o acesso a nada — foi decisão de
        projeto. Este painel existe para cobrar, não para trancar: no dia em que
        alguém precisar lançar algo com urgência, ele consegue.
      </p>
    </div>
  );
}
