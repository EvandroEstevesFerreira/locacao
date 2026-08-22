import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import {
  DEFAULT_TEMPLATES,
  documentoInfo,
  renderTemplate,
  corpoParaParagrafos,
} from "@/lib/templates";
import {
  DOCUMENTOS_EM_BRANCO,
  ehDocumentoEmBranco,
} from "@/lib/documentos/registro";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Gera um documento do alojamento EM BRANCO, para imprimir e preencher à mão.
 *
 * Serve os FRM-RH-002 a 005 pela tela de Documentos do alojamento. Os documentos
 * que saem preenchidos com dados de um registro (contrato, termo do ocupante)
 * têm rota própria, porque precisam buscar aquele registro.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ tipo: string }> },
) {
  const { tipo } = await params;
  if (!ehDocumentoEmBranco(tipo)) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = await createClient();
  const [{ data: org }, { data: tplRow }] = await Promise.all([
    supabase.from("organizacao").select("nome").eq("id", perfil.org_id).single(),
    supabase
      .from("documento_template")
      .select("titulo, corpo")
      .eq("org_id", perfil.org_id)
      .eq("tipo", tipo)
      .maybeSingle(),
  ]);
  const orgNome = org?.nome ?? "Sistenge";

  const tpl = tplRow ?? DEFAULT_TEMPLATES[tipo];
  const variaveis = { empresa_nome: orgNome };

  const variante = new URL(request.url).searchParams.get("variante");
  const elemento = DOCUMENTOS_EM_BRANCO[tipo]!(
    {
      orgNome,
      titulo: renderTemplate(tpl.titulo, variaveis),
      paragrafos: corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis)),
    },
    variante,
  );

  const buffer = await renderToBuffer(elemento);
  const nome = documentoInfo(tipo)?.eyebrow.split(" ·")[0] ?? tipo;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}${variante ? `-${variante}` : ""}.pdf"`,
    },
  });
}
