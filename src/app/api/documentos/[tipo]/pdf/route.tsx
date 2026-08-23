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
import { listarTarefasLimpeza } from "@/lib/data/alojamento";
import { rotuloSemana } from "@/lib/alojamento";

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

  const url2 = new URL(request.url);
  const variante = url2.searchParams.get("variante");
  const semanaParam = url2.searchParams.get("semana");

  // A folha de limpeza usa o catálogo da organização quando ele existe; sem
  // ele, cai no embutido — melhor entregar a folha padrão à obra do que uma
  // folha vazia porque ninguém abriu Configurações ainda.
  const tarefas =
    tipo === "checklist_limpeza" ? await listarTarefasLimpeza() : [];

  const elemento = DOCUMENTOS_EM_BRANCO[tipo]!(
    {
      orgNome,
      titulo: renderTemplate(tpl.titulo, variaveis),
      paragrafos: corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis)),
    },
    variante,
    {
      catalogo: tarefas.length > 0 ? tarefas : undefined,
      semana: semanaParam ? rotuloSemana(semanaParam) : undefined,
    },
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
