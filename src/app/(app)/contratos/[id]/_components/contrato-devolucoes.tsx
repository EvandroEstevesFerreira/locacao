// Histórico de devoluções: as movimentações de todas as linhas, achatadas e
// ordenadas da mais recente para a mais antiga.
//
// Lê do mesmo `obterItensLocadosCalculados` que a tabela de itens. Como está sob
// `cache()`, esta seção não gasta consulta nenhuma.

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { contaFotos, obterItensLocadosCalculados } from "@/lib/data/contratos";
import { formatarData, type Cadencia } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function ContratoDevolucoes({
  contratoId,
  cadencia,
  prorata,
}: {
  contratoId: string;
  cadencia: Cadencia;
  prorata: boolean;
}) {
  const linhas = await obterItensLocadosCalculados(contratoId, cadencia, prorata);

  const devolucoes = linhas
    .flatMap((l) =>
      (l.movimentacao ?? [])
        .filter((m) => m.tipo === "devolucao")
        .map((m) => ({
          id: m.id,
          item: l.item?.descricao ?? "—",
          quantidade: Number(m.quantidade),
          data: m.data,
          vistoria_id: m.vistoria_id,
          fotos: contaFotos(m.vistoria),
        })),
    )
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  if (devolucoes.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de devoluções</CardTitle>
        <CardDescription>
          Cada devolução gera um relatório fotográfico.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qtd. devolvida</TableHead>
              <TableHead>Relatório fotográfico</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devolucoes.map((d) => (
              <TableRow key={d.id}>
                <TableCell>{formatarData(d.data)}</TableCell>
                <TableCell className="font-medium">{d.item}</TableCell>
                <TableCell className="text-right">{d.quantidade}</TableCell>
                <TableCell>
                  {d.vistoria_id ? (
                    <div className="flex items-center gap-2">
                      {d.fotos === 0 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="size-3" /> Pendente de fotos
                        </Badge>
                      ) : (
                        <Badge variant="secondary">{d.fotos} foto(s)</Badge>
                      )}
                      <Link
                        href={`/vistorias/${d.vistoria_id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        Abrir
                      </Link>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
