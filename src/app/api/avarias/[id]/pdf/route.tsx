import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buscarAvaria } from "@/lib/data/avarias";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { responsabilidadeLabel, STATUS_AVARIA_INFO, type StatusAvaria } from "@/lib/avaria";
import { gerarLaudoAvariaPdf } from "@/lib/documentos/laudo-avaria-render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O laudo de uma avaria.
 *
 * Ao contrário do romaneio e do termo de devolução, este PDF sai mesmo com a
 * apuração INCOMPLETA — e é de propósito. O laudo em branco é o formulário que
 * vai a campo para ser preenchido à mão; exigir a apuração pronta para poder
 * imprimir inverteria a ordem do trabalho real.
 *
 * `buscarAvaria` devolve `null` tanto quando não existe quanto quando a RLS
 * esconde a linha — 404 nos dois casos, sem distinguir.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const avaria = await buscarAvaria(id);
  if (!avaria) {
    return NextResponse.json({ error: "Avaria não encontrada." }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: org } = await supabase.from("organizacao").select("nome").maybeSingle();
  const obra = avaria.contrato?.obra;

  const buffer = await gerarLaudoAvariaPdf({
    // `numero_registro` é preenchido por trigger no INSERT (migration 0048), então
    // toda avaria tem um. O fallback existe só para não imprimir "null" caso uma
    // linha antiga tenha escapado da numeração retroativa.
    numero: avaria.numero_registro ?? "AVARIA",
    orgNome: org?.nome ?? "Sistenge",
    fornecedor: avaria.fornecedor?.nome ?? null,
    obra: obra ? `${obra.codigo} — ${obra.nome}` : "Obra",
    contratoNumero: avaria.contrato?.numero ?? null,
    contratoRegistro: avaria.contrato?.numero_registro ?? null,
    data: formatarData(avaria.data),
    descricao: avaria.descricao,
    laudo: avaria.laudo,
    responsabilidade: responsabilidadeLabel(avaria.responsabilidade),
    status:
      STATUS_AVARIA_INFO[avaria.status as StatusAvaria]?.label ?? avaria.status,
    custoEstimado: formatarBRL(avaria.custo_estimado),
    peca: avaria.unidade_identificador,
    devolucao: avaria.devolucao?.numero_registro ?? null,
    localData: `${formatarData(avaria.data)}.`,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Laudo-${avaria.numero_registro ?? id}.pdf"`,
    },
  });
}
