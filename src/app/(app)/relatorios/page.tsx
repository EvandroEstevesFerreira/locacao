import { FileSpreadsheet, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  formatarValor,
  type TipoRelatorio,
} from "@/lib/relatorios";
import { PageHeader } from "@/components/page-header";
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

export const metadata = { title: "Relatórios — Loca" };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none";

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    obra?: string;
    inicio?: string;
    fim?: string;
  }>;
}) {
  const sp = await searchParams;
  const tipo = (
    TIPOS_RELATORIO.some((t) => t.valor === sp.tipo) ? sp.tipo : "itens_abertos"
  ) as TipoRelatorio;
  const meta = TIPOS_RELATORIO.find((t) => t.valor === tipo)!;

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obra")
    .select("id, codigo, nome")
    .order("codigo");

  const relatorio = await gerarRelatorio(supabase, tipo, {
    obra_id: sp.obra || undefined,
    inicio: sp.inicio || undefined,
    fim: sp.fim || undefined,
  });

  const qs = new URLSearchParams();
  qs.set("tipo", tipo);
  if (sp.obra) qs.set("obra", sp.obra);
  if (sp.inicio) qs.set("inicio", sp.inicio);
  if (sp.fim) qs.set("fim", sp.fim);
  const query = qs.toString();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        eyebrow="Análise"
        titulo="Relatórios"
        descricao="Gere relatórios com filtros e exporte em PDF ou Excel."
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Relatório</label>
              <select name="tipo" defaultValue={tipo} className={selectClasses}>
                {TIPOS_RELATORIO.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Obra</label>
              <select name="obra" defaultValue={sp.obra ?? ""} className={selectClasses}>
                <option value="">Todas</option>
                {(obras ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} — {o.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">De</label>
              <input
                type="date"
                name="inicio"
                defaultValue={sp.inicio ?? ""}
                className={selectClasses}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Até</label>
              <input
                type="date"
                name="fim"
                defaultValue={sp.fim ?? ""}
                className={selectClasses}
              />
            </div>
            <Button type="submit" variant="outline">
              Gerar
            </Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            {meta.descricao}
            {meta.usaPeriodo ? "" : " (este relatório ignora o período.)"}
          </p>
        </CardContent>
      </Card>

      {/* Exportar */}
      <div className="flex gap-2">
        <Button variant="outline" render={<a href={`/api/relatorios/pdf?${query}`} />}>
          <FileText className="size-4" />
          Exportar PDF
        </Button>
        <Button
          variant="outline"
          render={<a href={`/api/relatorios/excel?${query}`} />}
        >
          <FileSpreadsheet className="size-4" />
          Exportar Excel
        </Button>
      </div>

      {/* Prévia */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {relatorio.colunas.map((c) => (
                  <TableHead
                    key={c.key}
                    className={c.tipo === "moeda" || c.tipo === "numero" ? "text-right" : ""}
                  >
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatorio.linhas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={relatorio.colunas.length}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Nenhum registro para os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                relatorio.linhas.map((linha, idx) => (
                  <TableRow key={idx}>
                    {relatorio.colunas.map((c) => (
                      <TableCell
                        key={c.key}
                        className={
                          c.tipo === "moeda" || c.tipo === "numero" ? "text-right" : ""
                        }
                      >
                        {formatarValor(c.tipo, linha[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
