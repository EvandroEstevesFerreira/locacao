import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { buscarMedida } from "@/lib/data/alojamento";
import { formatarData, formatarDataHora, hojeISOSaoPaulo } from "@/lib/locacao";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  corpoParaParagrafos,
} from "@/lib/templates";
import {
  MedidaDisciplinar,
  type DadosMedida,
} from "@/lib/documentos/frm-rh-002";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FRM-RH-002 preenchido a partir de uma medida registrada.
 *
 * `buscarMedida` devolve `null` tanto quando a medida não existe quanto quando o
 * usuário não pode lê-la — a policy de SELECT esconde a linha. Respondemos 404
 * nos dois casos sem distinguir: um 403 confirmaria a existência de um registro
 * disciplinar a quem não tem acesso a ele.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const medida = await buscarMedida(id);
  if (!medida?.ocupante || !medida.imovel) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  const supabase = await createClient();
  const [{ data: org }, { data: obra }] = await Promise.all([
    supabase.from("organizacao").select("nome").eq("id", medida.imovel.org_id).single(),
    medida.imovel.obra_id
      ? supabase
          .from("obra")
          .select("codigo, nome")
          .eq("id", medida.imovel.obra_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const orgNome = org?.nome ?? "Sistenge";

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", medida.imovel.org_id)
    .eq("tipo", "medida_disciplinar")
    .maybeSingle();
  const tpl = tplRow ?? DEFAULT_TEMPLATES.medida_disciplinar;

  const periodo =
    medida.suspensao_inicio && medida.suspensao_fim
      ? `${formatarData(medida.suspensao_inicio)} a ${formatarData(medida.suspensao_fim)}`
      : medida.suspensao_inicio
        ? `a partir de ${formatarData(medida.suspensao_inicio)}`
        : null;

  const dados: DadosMedida = {
    ocupante: medida.ocupante.nome,
    cpf: medida.ocupante.cpf,
    cargo: medida.ocupante.cargo,
    obra: obra ? [obra.codigo, obra.nome].filter(Boolean).join(" — ") : null,
    tipo: medida.tipo,
    suspensaoDias: medida.suspensao_dias,
    suspensaoPeriodo: periodo,
    fatoEm: medida.fato_em ? formatarDataHora(medida.fato_em) : null,
    fatoLocal: medida.fato_local,
    fatoDescricao: medida.fato_descricao,
    testemunhas: medida.testemunhas,
    regrasVioladas: medida.regras_violadas ?? [],
    cltArtigo: medida.clt_artigo,
    reincidencia: medida.reincidencia,
    fundamentacao: medida.fundamentacao,
    ciencia: medida.ciencia,
  };

  const variaveis = { empresa_nome: orgNome };
  const buffer = await renderToBuffer(
    <MedidaDisciplinar
      orgNome={orgNome}
      titulo={renderTemplate(tpl.titulo, variaveis)}
      paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis))}
      dados={dados}
      localData={`${medida.imovel.cidade ?? "________"}, ${formatarData(
        medida.data || hojeISOSaoPaulo(),
      )}.`}
    />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="FRM-RH-002-${id}.pdf"`,
    },
  });
}
