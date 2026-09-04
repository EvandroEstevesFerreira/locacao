import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarRecebimento } from "@/lib/data/recebimentos";
import { formatarData } from "@/lib/locacao";
import { gerarRomaneioPdf } from "@/lib/documentos/romaneio-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O romaneio de um recebimento fechado.
 *
 * `buscarRecebimento` devolve `null` tanto quando não existe quanto quando a
 * RLS esconde a linha — 404 nos dois casos, sem distinguir.
 *
 * Rascunho NÃO gera romaneio: ele ainda não tem número, e um documento sem
 * número circulando é exatamente o que a numeração existe para impedir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const rec = await buscarRecebimento(id);
  if (!rec || !rec.contrato) {
    return NextResponse.json({ error: "Recebimento não encontrado." }, { status: 404 });
  }
  if (rec.status !== "fechado" || !rec.numero_registro) {
    return NextResponse.json(
      { error: "O romaneio só existe depois que o recebimento é fechado." },
      { status: 409 },
    );
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizacao").select("nome").maybeSingle();
  const obra = rec.contrato.obra;

  const buffer = await gerarRomaneioPdf({
    numero: rec.numero_registro,
    orgNome: org?.nome ?? "Sistenge",
    fornecedor: rec.fornecedor?.nome ?? "Fornecedor",
    obra: obra ? `${obra.codigo} — ${obra.nome}` : "Obra",
    contratoNumero: rec.contrato.numero,
    contratoRegistro: rec.contrato.numero_registro,
    recebidoEm: formatarData(rec.recebido_em),
    conferente: rec.conferente,
    notaFornecedor: rec.nota_fornecedor,
    observacoes: rec.observacoes,
    itens: rec.itens.map((i) => ({
      descricao: i.item_descricao,
      patrimonio: i.unidade_identificador,
      quantidade: i.quantidade,
      condicao: i.condicao,
      observacoes: i.observacoes,
    })),
    localData: `${formatarData(rec.recebido_em)}.`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Romaneio-${rec.numero_registro}.pdf"`,
    },
  });
}
