import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import { obterConclusao } from "@/lib/data/treinamento";
import { trilhaPorChave } from "@/lib/treinamento/index";
import { PAPEL_INFO } from "@/lib/permissoes";
import { formatarData } from "@/lib/locacao";
import { renderTemplate, corpoParaParagrafos, resolverTemplate } from "@/lib/templates";
import { ComprovanteTreinamento } from "@/lib/documentos/frm-tr-001";
import type { Campo, Assinante } from "@/lib/pdf-form";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FRM-TR-001 preenchido a partir da conclusão assinada de uma trilha.
 *
 * A RLS é a proteção: `obterConclusao` usa `createClient()`, e a policy
 * `treinamento_select` (migration 0063) devolve só a linha da própria pessoa,
 * ou qualquer uma para master/administrador. Não há checagem de papel aqui —
 * quem pede o comprovante de outra pessoa simplesmente não recebe linha
 * nenhuma, e a rota responde 404. Duas regras de acesso sobre o mesmo dado
 * divergem; a RLS já é a regra.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ trilha: string }> },
) {
  const { trilha: chave } = await params;

  const trilha = trilhaPorChave(chave);
  if (!trilha) {
    return NextResponse.json({ error: "Trilha não encontrada." }, { status: 404 });
  }

  const perfil = await getCurrentPerfil();
  if (!perfil) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 404 });
  }

  // Comprovante de treinamento não concluído não existe: nem rascunho, nem
  // "quase lá" — a RLS acima já limita isso à própria pessoa.
  const conclusao = await obterConclusao(perfil.id, trilha.chave, trilha.versao);
  if (!conclusao) {
    return NextResponse.json({ error: "Conclusão não encontrada." }, { status: 404 });
  }

  const supabase = await createClient();
  const [{ data: org }, { data: tplRow }] = await Promise.all([
    supabase.from("organizacao").select("nome").eq("id", perfil.org_id).maybeSingle(),
    supabase
      .from("documento_template")
      .select("titulo, corpo, versao, updated_at")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "comprovante_treinamento")
      .maybeSingle(),
  ]);
  const orgNome = (org as { nome: string } | null)?.nome ?? "Sistenge";
  const tpl = resolverTemplate("comprovante_treinamento", tplRow);

  const concluidoEm = formatarData(conclusao.concluidoEm.slice(0, 10));
  const variaveis = {
    empresa_nome: orgNome,
    pessoa: perfil.nome,
    trilha: trilha.titulo,
    versao: String(trilha.versao),
    concluido_em: concluidoEm,
  };

  const campos: Campo[] = [
    { label: "Pessoa", valor: perfil.nome },
    { label: "Papel no sistema", valor: PAPEL_INFO[perfil.papel].label },
    { label: "Trilha", valor: trilha.titulo },
    { label: "Versão do conteúdo", valor: String(trilha.versao) },
    { label: "Concluído em", valor: concluidoEm },
    { label: "Comprovante", valor: conclusao.numeroRegistro },
  ];

  const aulas = trilha.aulas.map((a) => ({ titulo: a.titulo, resumo: a.resumo }));

  const assinantes: Assinante[] = [
    { papel: "Quem concluiu", nome: perfil.nome, imagem: conclusao.assinatura },
  ];

  // `localData`: cidade não é conhecida aqui, então só a data.
  const localData = `${concluidoEm}.`;

  const buffer = await renderToBuffer(
    <ComprovanteTreinamento
      orgNome={orgNome}
      numero={conclusao.numeroRegistro}
      campos={campos}
      aulas={aulas}
      paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis))}
      localData={localData}
      assinantes={assinantes}
      versao={tpl.versao}
      publicadoEm={tpl.publicadoEm}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="FRM-TR-001-${
        conclusao.numeroRegistro ?? trilha.chave
      }.pdf"`,
    },
  });
}
