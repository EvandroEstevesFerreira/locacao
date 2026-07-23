import Link from "next/link";
import { ClipboardCheck, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { formatarData } from "@/lib/locacao";
import { TIPO_VISTORIA, type TipoVistoria } from "@/lib/vistoria";
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

export const metadata = { title: "Vistorias — Loca" };

type Row = {
  id: string;
  tipo: TipoVistoria;
  data: string;
  contrato: { numero: string; obra: { codigo: string } | null } | null;
  vistoria_foto: { count: number }[];
  avaria: { count: number }[];
};

export default async function VistoriasPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);

  const supabase = await createClient();
  const { data } = await supabase
    .from("vistoria")
    .select(
      "id, tipo, data, contrato:contrato_id(numero, obra:obra_id(codigo)), vistoria_foto(count), avaria(count)",
    )
    .order("data", { ascending: false });

  const vistorias = (data ?? []) as unknown as Row[];
  const tem = vistorias.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Vistorias"
        descricao="Registros de retirada e devolução com fotos e avarias."
      >
        {podeEditar ? (
          <Button render={<Link href="/vistorias/nova" />}>
            <Plus className="size-4" />
            Nova vistoria
          </Button>
        ) : null}
      </PageHeader>

      {tem ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Fotos</TableHead>
                  <TableHead className="text-right">Avarias</TableHead>
                  <TableHead className="w-12 text-right">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vistorias.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{formatarData(v.data)}</TableCell>
                    <TableCell className="font-medium">
                      {v.contrato?.numero ?? "—"}
                      {v.contrato?.obra ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {v.contrato.obra.codigo}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TIPO_VISTORIA[v.tipo].variant}>
                        {TIPO_VISTORIA[v.tipo].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {(v.vistoria_foto?.[0]?.count ?? 0) === 0 ? (
                        <Badge variant="destructive">Pendente</Badge>
                      ) : (
                        (v.vistoria_foto?.[0]?.count ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.avaria?.[0]?.count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Abrir"
                        render={<Link href={`/vistorias/${v.id}`} />}
                      >
                        <ChevronRight />
                      </Button>
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
              <ClipboardCheck className="size-6 text-muted-foreground" />
            </div>
            <p className="font-medium">Nenhuma vistoria registrada ainda</p>
            {podeEditar ? (
              <Button render={<Link href="/vistorias/nova" />}>
                <Plus className="size-4" />
                Registrar primeira vistoria
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
