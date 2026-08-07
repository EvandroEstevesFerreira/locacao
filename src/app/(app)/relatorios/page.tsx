import { FileSpreadsheet, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  expandirLinhas,
  dadosGrafico,
  formatarValor,
  type TipoRelatorio,
} from "@/lib/relatorios";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";

export const metadata = { title: "Relatórios — Loca" };


export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{
    tipo?: string;
    obra?: string;
    fornecedor?: string;
    status?: string;
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
  const [{ data: obras }, { data: fornecedores }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
    supabase.from("fornecedor").select("id, nome").order("nome"),
  ]);

  const relatorio = await gerarRelatorio(supabase, tipo, {
    obra_id: sp.obra || undefined,
    fornecedor_id: sp.fornecedor || undefined,
    status: sp.status === "pago" || sp.status === "pendente" ? sp.status : undefined,
    inicio: sp.inicio || undefined,
    fim: sp.fim || undefined,
  });

  const qs = new URLSearchParams();
  qs.set("tipo", tipo);
  if (sp.obra) qs.set("obra", sp.obra);
  if (sp.fornecedor) qs.set("fornecedor", sp.fornecedor);
  if (sp.status) qs.set("status", sp.status);
  if (sp.inicio) qs.set("inicio", sp.inicio);
  if (sp.fim) qs.set("fim", sp.fim);
  const query = qs.toString();

  const grafico = dadosGrafico(relatorio);
  const maxGrafico = grafico.reduce((m, g) => Math.max(m, g.valor), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Relatórios"
        descricao="Gere relatórios com filtros e exporte em PDF ou Excel."
      />

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3" method="get">
            <div className="flex flex-col gap-1">
              <label htmlFor="f-tipo" className="text-xs text-muted-foreground">Relatório</label>
              <NativeSelect className="w-auto" id="f-tipo" name="tipo" defaultValue={tipo}>
                {TIPOS_RELATORIO.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="f-obra" className="text-xs text-muted-foreground">Obra</label>
              <NativeSelect className="w-auto" id="f-obra" name="obra" defaultValue={sp.obra ?? ""}>
                <option value="">Todas</option>
                {(obras ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.codigo} — {o.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="f-fornecedor" className="text-xs text-muted-foreground">Fornecedor</label>
              <NativeSelect className="w-auto"
                id="f-fornecedor"
                name="fornecedor"
                defaultValue={sp.fornecedor ?? ""}
              >
                <option value="">Todos</option>
                {(fornecedores ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="f-status" className="text-xs text-muted-foreground">Status</label>
              <NativeSelect className="w-auto" id="f-status" name="status" defaultValue={sp.status ?? ""}>
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="f-inicio" className="text-xs text-muted-foreground">De</label>
              <Input
                id="f-inicio"
                type="date"
                name="inicio"
                defaultValue={sp.inicio ?? ""}
                className="w-auto"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="f-fim" className="text-xs text-muted-foreground">Até</label>
              <Input
                id="f-fim"
                type="date"
                name="fim"
                defaultValue={sp.fim ?? ""}
                className="w-auto"
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

      {/* Gráfico (relatórios agregados) */}
      {grafico.length > 0 ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-xs tracking-wide text-muted-foreground uppercase">
              {relatorio.titulo} — visão em barras
            </p>
            {grafico.map((g, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{g.label}</span>
                  <span className="font-medium">{formatarValor("moeda", g.valor)}</span>
                </div>
                {/* Trilha e preenchimento arredondados: a borda reta sem raio
                    era artefato do antigo --radius: 0. A cor acompanha o
                    BarChart (foreground com opacidade em vez de primary, que no
                    tema escuro viraria branco puro). */}
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-foreground/80"
                    style={{
                      width: `${maxGrafico > 0 ? (g.valor / maxGrafico) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
                expandirLinhas(relatorio).map((lr, idx) => {
                  const dir = (t: string) => t === "moeda" || t === "numero";
                  if (lr.tipo === "dado") {
                    return (
                      <TableRow key={idx}>
                        {relatorio.colunas.map((c) => (
                          <TableCell
                            key={c.key}
                            className={dir(c.tipo) ? "text-right" : ""}
                          >
                            {formatarValor(c.tipo, lr.valores[c.key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  }
                  const primeira = relatorio.colunas[0].key;
                  return (
                    <TableRow key={idx} className="bg-muted font-medium">
                      {relatorio.colunas.map((c) => {
                        let conteudo = "";
                        if (c.key in lr.valores)
                          conteudo = formatarValor("moeda", lr.valores[c.key]);
                        else if (c.key === primeira)
                          conteudo =
                            lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
                        return (
                          <TableCell
                            key={c.key}
                            className={dir(c.tipo) ? "text-right" : ""}
                          >
                            {conteudo}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
