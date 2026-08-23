import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { formatarDataHora } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
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

export const metadata = { title: "Auditoria — Loca" };

const ENTIDADE_LABEL: Record<string, string> = {
  contrato_locacao: "Contrato",
  item_locado: "Item do contrato",
  lancamento_financeiro: "Lançamento financeiro",
  obra: "Obra",
  fornecedor: "Fornecedor",
  imovel: "Imóvel",
  contrato_imovel: "Contrato de imóvel",
  ocupante_imovel: "Ocupante",
  perfil: "Usuário",
};

const ACAO = {
  INSERT: { label: "Criou", variant: "default" as const },
  UPDATE: { label: "Alterou", variant: "secondary" as const },
  DELETE: { label: "Excluiu", variant: "outline" as const },
};

export default async function AuditoriaPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_log")
    .select("id, entidade, registro_id, acao, autor, dados, criado_em")
    .order("criado_em", { ascending: false })
    .limit(200);

  type Log = {
    id: number;
    entidade: string;
    registro_id: string | null;
    acao: keyof typeof ACAO;
    autor: string | null;
    dados: Record<string, unknown> | null;
    criado_em: string;
  };
  const linhas = (logs ?? []) as Log[];

  // Nomes dos autores.
  const autorIds = [...new Set(linhas.map((l) => l.autor).filter(Boolean))] as string[];
  const nomePorId = new Map<string, string>();
  if (autorIds.length > 0) {
    const { data: perfis } = await supabase
      .from("perfil")
      .select("id, nome, email")
      .in("id", autorIds);
    for (const p of perfis ?? []) nomePorId.set(p.id, p.nome ?? p.email ?? "—");
  }

  const rotuloRegistro = (l: Log) => {
    const d = l.dados ?? {};
    return (
      (d.numero as string) ||
      (d.apelido as string) ||
      (d.descricao as string) ||
      (d.nome as string) ||
      (l.registro_id ? `${l.registro_id.slice(0, 8)}…` : "—")
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Auditoria"
        descricao="Quem criou, alterou ou excluiu registros — 200 eventos mais recentes."
      />
      <Card>
        <CardContent className="p-0">
          {linhas.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead>Autor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => {
                    const a = ACAO[l.acao] ?? { label: l.acao, variant: "outline" as const };
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatarDataHora(l.criado_em)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={a.variant}>{a.label}</Badge>
                        </TableCell>
                        <TableCell>{ENTIDADE_LABEL[l.entidade] ?? l.entidade}</TableCell>
                        <TableCell className="font-medium">{rotuloRegistro(l)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {l.autor ? nomePorId.get(l.autor) ?? "—" : "sistema"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
