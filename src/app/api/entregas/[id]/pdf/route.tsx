import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { buscarEntrega } from "@/lib/data/alojamento";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  corpoParaParagrafos,
  type TipoDocumento,
} from "@/lib/templates";
import { TermoChaves, type DadosEntrega } from "@/lib/documentos/frm-rh-003";
import { KitAlojamento } from "@/lib/documentos/frm-rh-004";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FRM-RH-003 (chaves) ou FRM-RH-004 (kit) preenchido a partir de um registro de
 * `entrega_ocupante`. Qual dos dois sai é decidido pelo `tipo` do registro — a
 * mesma tabela guarda os dois ciclos, e o documento segue o tipo.
 *
 * Os componentes são os MESMOS que geram a folha em branco: sem `dados` saem
 * vazios, com `dados` saem preenchidos.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const entrega = await buscarEntrega(id);
  if (!entrega?.ocupante || !entrega.imovel) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  const ocupante = entrega.ocupante as {
    nome: string;
    cpf: string | null;
    cargo: string | null;
    quarto: string | null;
    armario: string | null;
  };
  const imovel = entrega.imovel as {
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    obra_id: string | null;
    org_id: string;
  };

  const supabase = await createClient();
  const [{ data: org }, { data: obra }] = await Promise.all([
    supabase.from("organizacao").select("nome").eq("id", imovel.org_id).single(),
    imovel.obra_id
      ? supabase
          .from("obra")
          .select("codigo, nome, centro_custo")
          .eq("id", imovel.obra_id)
          .single()
      : Promise.resolve({ data: null }),
  ]);
  const orgNome = org?.nome ?? "Sistenge";

  const tipo: TipoDocumento =
    entrega.tipo === "kit" ? "kit_alojamento" : "termo_chaves";

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", imovel.org_id)
    .eq("tipo", tipo)
    .maybeSingle();
  const tpl = tplRow ?? DEFAULT_TEMPLATES[tipo];

  const dados: DadosEntrega = {
    ocupante: ocupante.nome,
    cpf: ocupante.cpf,
    cargo: ocupante.cargo,
    centroResultado: obra?.centro_custo ?? null,
    obra: obra ? [obra.codigo, obra.nome].filter(Boolean).join(" — ") : null,
    endereco:
      [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || null,
    quarto: ocupante.quarto,
    armario: ocupante.armario,
    entregueEm: entrega.entregue_em ? formatarData(entrega.entregue_em) : null,
    devolvidoEm: entrega.devolvido_em ? formatarData(entrega.devolvido_em) : null,
    itens: Array.isArray(entrega.itens) ? (entrega.itens as string[]) : [],
    avarias: entrega.avarias,
    devolucaoMotivo: entrega.devolucao_motivo,
    tratativa: entrega.tratativa,
  };

  const variaveis = { empresa_nome: orgNome };
  const conteudo = {
    orgNome,
    titulo: renderTemplate(tpl.titulo, variaveis),
    paragrafos: corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis)),
  };
  // `hojeISOSaoPaulo()`, nunca `new Date().toISOString()`: o Vercel roda em UTC
  // e entre 21h e a meia-noite em Brasília a data sairia do dia seguinte.
  const localData = `${imovel.cidade ?? "________"}, ${formatarData(
    entrega.devolvido_em ?? entrega.entregue_em ?? hojeISOSaoPaulo(),
  )}.`;

  const buffer = await renderToBuffer(
    tipo === "kit_alojamento" ? (
      <KitAlojamento {...conteudo} dados={dados} />
    ) : (
      <TermoChaves {...conteudo} dados={dados} localData={localData} />
    ),
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${
        tipo === "kit_alojamento" ? "FRM-RH-004" : "FRM-RH-003"
      }-${id}.pdf"`,
    },
  });
}
