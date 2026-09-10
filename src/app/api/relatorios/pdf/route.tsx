import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/locacao";
import {
  TIPOS_RELATORIO,
  gerarRelatorio,
  type TipoRelatorio,
} from "@/lib/relatorios";
import { exigirModulo } from "@/lib/modulos";
import { getCurrentPerfil } from "@/lib/auth";
import { DocumentoRelatorio } from "@/lib/pdf";

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
  const meta = tipo ? TIPOS_RELATORIO.find((t) => t.valor === tipo) : undefined;
  if (!tipo || !meta) {
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }

  // A MESMA TRAVA DA TELA, aqui também. Esta rota aceita `?tipo=` de quem
  // souber montar o endereço, e três relatórios listam patrimônio da frota
  // com identificador de peça. Filtrar só a lista da tela protegeria a porta e
  // deixaria a janela aberta.
  if (meta.modulo) {
    const semModulo = exigirModulo(await getCurrentPerfil(), meta.modulo);
    if (semModulo) {
      return NextResponse.json({ error: semModulo }, { status: 403 });
    }
  }

  const inicio = url.searchParams.get("inicio") ?? undefined;
  const fim = url.searchParams.get("fim") ?? undefined;
  const statusParam = url.searchParams.get("status");
  const relatorio = await gerarRelatorio(supabase, tipo, {
    obra_id: url.searchParams.get("obra") ?? undefined,
    fornecedor_id: url.searchParams.get("fornecedor") ?? undefined,
    status: statusParam === "pago" || statusParam === "pendente" ? statusParam : undefined,
    inicio,
    fim,
  });

  const periodo =
    inicio || fim
      ? `${inicio ? formatarData(inicio) : "…"} a ${fim ? formatarData(fim) : "…"}`
      : undefined;

  const buffer = await renderToBuffer(
    <DocumentoRelatorio relatorio={relatorio} periodo={periodo} />,
  );
  const nome = `relatorio-${tipo}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nome}"`,
    },
  });
}
