import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarReparo } from "@/lib/data/reparos";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { statusReparoLabel, responsabilidadeLabel } from "@/lib/reparo";
import { gerarOrdemReparoPdf } from "@/lib/documentos/ordem-reparo-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A ordem de reparo em PDF.
 *
 * Sai em QUALQUER status, inclusive 'aberto' — e é o ponto: este documento
 * viaja com a máquina, e ele precisa existir ANTES de a peça sair da obra.
 * Exigir a ordem concluída para poder imprimir inverteria a ordem do trabalho.
 *
 * `buscarReparo` devolve `null` tanto quando não existe quanto quando a RLS
 * esconde a linha — 404 nos dois casos, sem distinguir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const reparo = await buscarReparo(id);
  if (!reparo) {
    return NextResponse.json(
      { error: "Ordem de reparo não encontrada." },
      { status: 404 },
    );
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizacao").select("nome").maybeSingle();

  const buffer = await gerarOrdemReparoPdf({
    // `numero_registro` vem do trigger no INSERT (migration 0068), então toda
    // ordem tem um. O fallback existe só para não imprimir "null".
    numero: reparo.numero_registro ?? "ORDEM",
    orgNome: org?.nome ?? "Sistenge",
    peca: reparo.unidadeIdentificador ?? "—",
    item: reparo.itemDescricao ?? "Equipamento",
    descricao: reparo.descricao,
    executor: reparo.executor,
    status: statusReparoLabel(reparo.status),
    responsabilidade: responsabilidadeLabel(reparo.responsabilidade),
    abertoEm: formatarData(reparo.aberto_em),
    enviadoEm: reparo.enviado_em ? formatarData(reparo.enviado_em) : null,
    previstoPara: reparo.previsto_para ? formatarData(reparo.previsto_para) : null,
    concluidoEm: reparo.concluido_em ? formatarData(reparo.concluido_em) : null,
    valor: formatarBRL(reparo.valor),
    garantia:
      reparo.garantia_dias !== null ? `${reparo.garantia_dias} dias` : null,
    observacoes: reparo.observacoes,
    avaria: reparo.avariaNumero,
    localData: `${formatarData(reparo.aberto_em)}.`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Ordem-reparo-${reparo.numero_registro ?? id}.pdf"`,
    },
  });
}
