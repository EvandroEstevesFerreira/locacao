import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { dataDeISO } from "@/lib/locacao";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  expandirLinhas,
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

  const statusParam = url.searchParams.get("status");
  const relatorio = await gerarRelatorio(supabase, tipo, {
    obra_id: url.searchParams.get("obra") ?? undefined,
    fornecedor_id: url.searchParams.get("fornecedor") ?? undefined,
    status: statusParam === "pago" || statusParam === "pendente" ? statusParam : undefined,
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

  const primeira = relatorio.colunas[0].key;
  for (const lr of expandirLinhas(relatorio)) {
    const row: Record<string, string | number | Date | null> = {};
    if (lr.tipo === "dado") {
      for (const c of relatorio.colunas) {
        const v = lr.valores[c.key];
        if (v === null || v === undefined || v === "") row[c.key] = null;
        else if (c.tipo === "data") row[c.key] = dataDeISO(String(v));
        else if (c.tipo === "moeda" || c.tipo === "numero") row[c.key] = Number(v);
        else row[c.key] = String(v);
      }
      ws.addRow(row);
    } else {
      for (const c of relatorio.colunas) {
        if (c.key in lr.valores) row[c.key] = Number(lr.valores[c.key]);
        else if (c.key === primeira)
          row[c.key] = lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
        else row[c.key] = null;
      }
      const r = ws.addRow(row);
      r.font = { bold: true };
      if (lr.tipo === "total") {
        r.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF7E9E8" },
          };
        });
      }
    }
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
