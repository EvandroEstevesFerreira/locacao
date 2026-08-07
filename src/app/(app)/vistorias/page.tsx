import Link from "next/link";
import { ClipboardCheck, Plus, ChevronRight } from "lucide-react";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { formatarData } from "@/lib/locacao";
import { TIPO_VISTORIA } from "@/lib/vistoria";
import { listarVistorias } from "@/lib/data/vistorias";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
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
import { SelectFilter } from "@/components/shared/select-filter";
import { ListFilters } from "@/components/shared/list-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Vistorias — Loca" };

export default async function VistoriasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const sp = await searchParams;
  const obra = sp.obra;
  const { sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["data", "tipo"],
    defaultSort: "data",
    defaultDir: "desc",
  });

  const [{ itens: vistorias, total }, obrasData] = await Promise.all([
    listarVistorias({ sort, ascending, from, to, obraId: obra }),
    listarObrasParaFiltro(),
  ]);
  const tem = vistorias.length > 0;
  const buscando = Boolean(obra);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Vistorias"
        descricao={`Registros de retirada e devolução com fotos e avarias. · ${contagem(total, "vistoria", "vistorias")} no filtro`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/vistorias/nova" />}>
              <Plus className="size-4" />
              Nova vistoria
            </Button>
          ) : null
        }
      />

      <ListFilters>
        <SelectFilter
          param="obra"
          label="Obra"
          placeholder="Todas as obras"
          opcoes={obrasData.map((o) => ({ value: o.id, label: `${o.codigo} — ${o.nome}` }))}
        />
      </ListFilters>

      {tem || buscando ? (
        <>
          <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader column="data" label="Data" /></TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead><SortHeader column="tipo" label="Tipo" /></TableHead>
                  <TableHead className="text-right">Fotos</TableHead>
                  <TableHead className="text-right">Avarias</TableHead>
                  <TableHead className="w-12 text-right">Abrir</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!tem ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Nenhuma vistoria encontrada.
                    </TableCell>
                  </TableRow>
                ) : null}
                {vistorias.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>{formatarData(v.data)}</TableCell>
                    <TableCell className="font-medium">
                      {v.contratoNumero ?? "—"}
                      {v.obraCodigo ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {v.obraCodigo}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TIPO_VISTORIA[v.tipo].variant}>
                        {TIPO_VISTORIA[v.tipo].label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {v.fotos === 0 ? (
                        <Badge variant="destructive">Pendente</Badge>
                      ) : (
                        v.fotos
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {v.avarias}
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
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      ) : (
        <EmptyState
          icon={<ClipboardCheck />}
          titulo="Nenhuma vistoria registrada ainda"
          descricao="A vistoria é a prova do estado do item na retirada e na devolução, com fotos e avarias."
          acao={podeEditar ? { label: "Nova vistoria", href: "/vistorias/nova" } : undefined}
        />
      )}
    </div>
  );
}
