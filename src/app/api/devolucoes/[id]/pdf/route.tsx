import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarDevolucao } from "@/lib/data/devolucoes";
import { formatarData } from "@/lib/locacao";
import { gerarTermoDevolucaoPdf } from "@/lib/documentos/termo-devolucao-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O termo de uma devolução fechada.
 *
 * `buscarDevolucao` devolve `null` tanto quando não existe quanto quando a RLS
 * esconde a linha — 404 nos dois casos, sem distinguir.
 *
 * Rascunho NÃO gera termo: ele ainda não tem número, e um documento sem número
 * circulando é exatamente o que a numeração existe para impedir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const dev = await buscarDevolucao(id);
  if (!dev || !dev.contrato) {
    return NextResponse.json({ error: "Devolução não encontrada." }, { status: 404 });
  }
  if (dev.status !== "fechado" || !dev.numero_registro) {
    return NextResponse.json(
      { error: "O termo só existe depois que a devolução é fechada." },
      { status: 409 },
    );
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizacao").select("nome").maybeSingle();
  const obra = dev.contrato.obra;

  const buffer = await gerarTermoDevolucaoPdf({
    numero: dev.numero_registro,
    orgNome: org?.nome ?? "Sistenge",
    fornecedor: dev.fornecedor?.nome ?? "Fornecedor",
    obra: obra ? `${obra.codigo} — ${obra.nome}` : "Obra",
    contratoNumero: dev.contrato.numero,
    contratoRegistro: dev.contrato.numero_registro,
    devolvidoEm: formatarData(dev.devolvido_em),
    responsavel: dev.responsavel,
    notaFornecedor: dev.nota_fornecedor,
    observacoes: dev.observacoes,
    itens: dev.itens.map((i) => ({
      descricao: i.item_descricao,
      patrimonio: i.unidade_identificador,
      quantidade: i.quantidade,
      condicao: i.condicao,
      observacoes: i.observacoes,
    })),
    localData: `${formatarData(dev.devolvido_em)}.`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Termo-devolucao-${dev.numero_registro}.pdf"`,
    },
  });
}
