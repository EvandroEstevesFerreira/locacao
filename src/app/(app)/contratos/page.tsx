import Link from "next/link";
import { FileText, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import {
  CADENCIA,
  STATUS_CONTRATO,
  formatarData,
  type Cadencia,
  type StatusContrato,
} from "@/lib/locacao";
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

export const metadata = { title: "Contratos — Loca" };

type Row = {
  id: string;
  numero: string;
  cadencia: Cadencia;
  data_inicio: string;
  data_fim_prevista: string | null;
  status: StatusContrato;
  obra: { codigo: string; nome: string } | null;
  fornecedor: { nome: string } | null;
};

export default async function ContratosPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);

  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_locacao")
    .select(
      "id, numero, cadencia, data_inicio, data_fim_prevista, status, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome)",
    )
    .order("created_at", { ascending: false });

  const contratos = (data ?? []) as unknown as Row[];
  const tem = contratos.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Locação"
        titulo="Contratos"
        descricao="Contratos de locação por obra e fornecedor."
      >
        {podeEditar ? (
          <Button render={<Link href="/contratos/novo" />}>
            <Plus className="size-4" />
            Novo contrato
          </Button>
        ) : null}
      </PageHeader>

      {tem ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Cadência</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12 text-right">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contratos.map((c) => {
                  const s = STATUS_CONTRATO[c.status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.numero}</TableCell>
                      <TableCell>
                        {c.obra ? `${c.obra.codigo} — ${c.obra.nome}` : "—"}
                      </TableCell>
                      <TableCell>{c.fornecedor?.nome ?? "—"}</TableCell>
                      <TableCell>{CADENCIA[c.cadencia].label}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatarData(c.data_inicio)} –{" "}
                        {formatarData(c.data_fim_prevista)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Abrir"
                          render={<Link href={`/contratos/${c.id}`} />}
                        >
                          <ChevronRight />
                        </Button>
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
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhum contrato cadastrado ainda</p>
            {podeEditar ? (
              <Button render={<Link href="/contratos/novo" />}>
                <Plus className="size-4" />
                Cadastrar primeiro contrato
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
