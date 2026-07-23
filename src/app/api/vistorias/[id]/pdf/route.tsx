import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  STATUS_AVARIA,
  TIPO_VISTORIA,
  type StatusAvaria,
  type TipoVistoria,
} from "@/lib/vistoria";
import { DocumentoVistoria, type VistoriaPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Vistoria + contrato/obra (RLS garante o acesso).
  const { data: vistoria } = await supabase
    .from("vistoria")
    .select(
      "id, tipo, data, responsavel, observacoes, assinatura_empresa_nome, assinatura_empresa_img, assinatura_retirante_nome, assinatura_retirante_img, contrato:contrato_id(numero, obra:obra_id(codigo,nome))",
    )
    .eq("id", id)
    .single();
  if (!vistoria) {
    return NextResponse.json({ error: "Vistoria não encontrada." }, { status: 404 });
  }

  const contrato = vistoria.contrato as unknown as {
    numero: string;
    obra: { codigo: string; nome: string } | null;
  } | null;

  // Avarias
  const { data: avarias } = await supabase
    .from("avaria")
    .select("descricao, custo_estimado, status")
    .eq("vistoria_id", id)
    .order("created_at");
  const totalAvarias = (avarias ?? []).reduce(
    (s, a) => s + Number(a.custo_estimado),
    0,
  );

  // Contexto de devolução (se houver)
  const { data: movs } = await supabase
    .from("movimentacao")
    .select("quantidade, item_locado:item_locado_id(item:item_id(descricao))")
    .eq("vistoria_id", id);
  const mov = (movs ?? [])[0] as unknown as
    | { quantidade: number; item_locado: { item: { descricao: string } | null } | null }
    | undefined;
  const contexto = mov
    ? `Devolução de ${mov.quantidade} un. de ${mov.item_locado?.item?.descricao ?? "item"}`
    : undefined;

  // Fotos → URLs assinadas → bytes → data URIs (embutidas no PDF)
  const { data: fotos } = await supabase
    .from("vistoria_foto")
    .select("path")
    .eq("vistoria_id", id)
    .order("created_at");
  const paths = (fotos ?? []).map((f) => f.path);
  const assinadas = paths.length
    ? (await supabase.storage.from("vistorias").createSignedUrls(paths, 600))
        .data ?? []
    : [];

  const dataUris: string[] = [];
  for (const s of assinadas) {
    if (!s.signedUrl) continue;
    try {
      const resp = await fetch(s.signedUrl);
      if (!resp.ok) continue;
      const contentType = resp.headers.get("content-type") ?? "image/jpeg";
      const b64 = Buffer.from(await resp.arrayBuffer()).toString("base64");
      dataUris.push(`data:${contentType};base64,${b64}`);
    } catch {
      // Ignora foto que falhar ao baixar; o relatório sai com as demais.
    }
  }

  const dados: VistoriaPdf = {
    contratoLinha: contrato
      ? `Contrato ${contrato.numero}${contrato.obra ? ` · ${contrato.obra.codigo}` : ""}`
      : undefined,
    tipoLabel: TIPO_VISTORIA[vistoria.tipo as TipoVistoria].label,
    data: formatarData(vistoria.data),
    responsavel: vistoria.responsavel ?? "—",
    avariasCusto: formatarBRL(totalAvarias),
    contexto,
    observacoes: vistoria.observacoes ?? undefined,
    avarias: (avarias ?? []).map((a) => ({
      descricao: a.descricao,
      custo: formatarBRL(Number(a.custo_estimado)),
      status: STATUS_AVARIA[a.status as StatusAvaria].label,
    })),
    fotos: dataUris,
    empresaNome: (vistoria.assinatura_empresa_nome as string | null) ?? undefined,
    empresaImg: (vistoria.assinatura_empresa_img as string | null) ?? undefined,
    retiranteNome:
      (vistoria.assinatura_retirante_nome as string | null) ?? undefined,
    retiranteImg:
      (vistoria.assinatura_retirante_img as string | null) ?? undefined,
    empresaAssinado: !!vistoria.assinatura_empresa_img,
    geradoEm: formatarData(new Date().toISOString().slice(0, 10)),
  };

  const buffer = await renderToBuffer(<DocumentoVistoria v={dados} />);
  const nome = `vistoria-${contrato?.numero ?? id}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
    },
  });
}
