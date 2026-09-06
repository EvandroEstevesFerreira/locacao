import { NextResponse } from "next/server";

import { gerarTermoEquipamentoPdf } from "@/lib/documentos/frm-eq-001-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FRM-EQ-001 preenchido a partir de um termo.
 *
 * A montagem inteira — campos, itens, template e assinaturas — vive em
 * `frm-eq-001-render.tsx`, porque o MESMO PDF sai por outro caminho: o anexo do
 * e-mail ao funcionário. Duas montagens fariam o documento que a pessoa recebe
 * divergir do que ela baixa, num papel com valor de prova.
 *
 * `gerarTermoEquipamentoPdf` devolve `null` tanto para termo inexistente quanto
 * para termo de outra organização (a leitura passa pela RLS) — 404 nos dois
 * casos, sem distinguir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const doc = await gerarTermoEquipamentoPdf(id);
  if (!doc) {
    return NextResponse.json({ error: "Termo não encontrado." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(doc.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.arquivo}"`,
    },
  });
}
