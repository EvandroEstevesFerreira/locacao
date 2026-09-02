import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FuncionarioForm } from "./funcionario-form";

export const metadata = { title: "Funcionários — Loca" };

/**
 * Cadastro de funcionários — o primeiro cadastro de PESSOA do sistema.
 *
 * `perfil` são os usuários com login (sete pessoas); `ocupante_imovel` é uma
 * ocupação de alojamento, com quarto e armário. Quem opera equipamento e não
 * mora em alojamento não tinha linha em nenhum dos dois, e é ele que assina o
 * termo.
 */
export default async function FuncionariosPage() {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/termos");

  const supabase = await createClient();
  const [{ data: funcionarios }, obras] = await Promise.all([
    supabase
      .from("funcionario")
      .select("id, nome, cpf, cargo, matricula, telefone, ativo, obra:obra_id(codigo, nome)")
      .order("nome"),
    listarObrasParaFiltro(),
  ]);

  type Linha = {
    id: string;
    nome: string;
    cpf: string | null;
    cargo: string | null;
    matricula: string | null;
    telefone: string | null;
    ativo: boolean;
    obra: { codigo: string; nome: string } | null;
  };
  const linhas = (funcionarios ?? []) as unknown as Linha[];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Funcionários"
        descricao="Quem recebe equipamento e assina o termo de responsabilidade"
        acoes={
          <Button variant="outline" render={<Link href="/termos" />}>
            Voltar aos termos
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cadastrar funcionário</CardTitle>
        </CardHeader>
        <CardContent>
          <FuncionarioForm obras={obras} />
        </CardContent>
      </Card>

      {linhas.length === 0 ? (
        <EmptyState
          icon={<Users className="size-6" />}
          titulo="Nenhum funcionário cadastrado"
          descricao="O termo de responsabilidade é assinado por um funcionário. Cadastre acima quem recebe equipamento na obra."
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.cpf ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.cargo ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.matricula ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.obra ? `${f.obra.codigo} — ${f.obra.nome}` : "—"}
                    </TableCell>
                    <TableCell>
                      {/* Desligamento é `ativo = false`, nunca exclusão: o
                          vínculo com os termos antigos tem de sobreviver. */}
                      <Badge variant={f.ativo ? "default" : "outline"}>
                        {f.ativo ? "Ativo" : "Desligado"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
