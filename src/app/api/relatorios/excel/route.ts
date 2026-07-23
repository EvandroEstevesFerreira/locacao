import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dataDeISO } from "@/lib/locacao";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") as TipoRelatorio | null;
  if (!tipo || !TIPOS_RELATORIO.some((t) => t.valor === tipo)) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }

  const relatorio = await gerarRelatorio(supabase, tipo, {
    obra_id: url.searchParams.get("obra") ?? undefined,
    inicio: url.searchParams.get("inicio") ?? undefined,
    fim: url.searchParams.get("fim") ?? undefined,
  });

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(relatorio.titulo.slice(0, 30));
  ws.columns = relatorio.colunas.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.tipo === "texto" ? 32 : 16,
  }));
  ws.getRow(1).font = { bold: true };

  for (const linha of relatorio.linhas) {
    const row: Record<string, string | number | Date | null> = {};
    for (const c of relatorio.colunas) {
      const v = linha[c.key];
      if (v === null || v === undefined || v === "") row[c.key] = null;
      else if (c.tipo === "data") row[c.key] = dataDeISO(String(v));
      else if (c.tipo === "moeda" || c.tipo === "numero") row[c.key] = Number(v);
      else row[c.key] = String(v);
    }
    ws.addRow(row);
  }

  relatorio.colunas.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.tipo === "moeda") col.numFmt = '"R$" #,##0.00';
    if (c.tipo === "data") col.numFmt = "dd/mm/yyyy";
  });

  const buffer = await wb.xlsx.writeBuffer();
  const nome = `relatorio-${tipo}.xlsx`;
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
