import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, Users, X } from "lucide-react";

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
import { FuncionarioForm, type FuncionarioParaEditar } from "./funcionario-form";

export const metadata = { title: "Funcionários — Loca" };

/**
 * Cadastro de funcionários — o primeiro cadastro de PESSOA do sistema.
 *
 * `perfil` são os usuários com login (sete pessoas); `ocupante_imovel` é uma
 * ocupação de alojamento, com quarto e armário. Quem opera equipamento e não
 * mora em alojamento não tinha linha em nenhum dos dois, e é ele que assina o
 * termo.
 */
export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/termos");

  // `?editar=<id>` carrega o funcionário no MESMO formulário que cria.
  //
  // Sem um caminho de edição, o e-mail deduzido do nome era um beco sem saída:
  // a lista mostrava "Por conferir" e não havia onde conferir. A importação do
  // inventário vai deduzir cerca de 110 endereços de uma vez.
  const sp = await searchParams;
  const editarId = Array.isArray(sp.editar) ? sp.editar[0] : sp.editar;

  const supabase = await createClient();
  const [{ data: funcionarios }, obras] = await Promise.all([
    supabase
      .from("funcionario")
      .select(
        "id, nome, cpf, cargo, matricula, telefone, email, email_confirmado, ativo, obra:obra_id(codigo, nome)",
      )
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
    email: string | null;
    email_confirmado: boolean;
    ativo: boolean;
    obra: { codigo: string; nome: string } | null;
  };
  const linhas = (funcionarios ?? []) as unknown as Linha[];

  // `obra_id` não vem no select da lista (a lista mostra código e nome), então
  // o funcionário em edição é lido à parte. São dois `select` só quando alguém
  // está editando.
  const emEdicao = editarId
    ? ((
        await supabase
          .from("funcionario")
          .select(
            "id, nome, cpf, cargo, matricula, telefone, email, email_confirmado, obra_id, ativo",
          )
          .eq("id", editarId)
          .maybeSingle()
      ).data as FuncionarioParaEditar | null)
    : null;

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
          <CardTitle className="text-base">
            {emEdicao ? `Editando ${emEdicao.nome}` : "Cadastrar funcionário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <FuncionarioForm
            key={emEdicao?.id ?? "novo"}
            funcionario={emEdicao ?? undefined}
            obras={obras}
          />
          {emEdicao ? (
            <Button variant="ghost" size="sm" render={<Link href="/termos/funcionarios" />}>
              <X className="size-3.5" aria-hidden />
              Cancelar edição
            </Button>
          ) : null}
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
                  <TableHead>E-mail</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Matrícula</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.email ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {f.email}
                          {/* Endereço deduzido do nome, ainda sem ninguém ter
                              conferido. Enquanto estiver assim, nenhum termo
                              é enviado para ele. */}
                          {!f.email_confirmado ? (
                            <Badge variant="outline">Por conferir</Badge>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
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
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${f.nome}`}
                        render={<Link href={`/termos/funcionarios?editar=${f.id}`} />}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
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
