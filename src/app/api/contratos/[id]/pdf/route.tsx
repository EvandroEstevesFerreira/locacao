import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { CADENCIA, formatarBRL, formatarData, type Cadencia, hojeISOSaoPaulo} from "@/lib/locacao";
import { DocumentoTexto, type InfoLinha } from "@/lib/pdf";
import {
  DEFAULT_TEMPLATES,
  documentoInfo,
  renderTemplate,
  corpoParaParagrafos,
} from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select(
      "numero, cadencia, data_inicio, data_fim_prevista, observacoes, org_id, obra:obra_id(codigo, nome, cidade), fornecedor:fornecedor_id(nome, cnpj), item_locado(quantidade, valor_unitario_periodo, identificacao, item:item_id(descricao, unidade))",
    )
    .eq("id", id)
    .single();
  if (!contrato) return NextResponse.json({ error: "Contrato não encontrado." }, { status: 404 });

  const { data: org } = await supabase
    .from("organizacao")
    .select("nome, razao_social, cnpj, endereco, cidade, uf, cep, representante_nome, representante_cargo")
    .eq("id", contrato.org_id)
    .single();
  const orgNome = org?.nome ?? "Sistenge";
  const locatariaNome = org?.razao_social ?? orgNome;
  const locatariaEndereco = [org?.endereco, org?.cidade, org?.uf, org?.cep].filter(Boolean).join(", ");

  const obra = contrato.obra as unknown as { codigo: string; nome: string; cidade: string | null } | null;
  const fornecedor = contrato.fornecedor as unknown as { nome: string; cnpj: string | null } | null;
  const itens = (contrato.item_locado ?? []) as unknown as {
    quantidade: number;
    valor_unitario_periodo: number;
    identificacao: string | null;
    item: { descricao: string; unidade: string | null } | null;
  }[];

  const cadenciaLabel = CADENCIA[contrato.cadencia as Cadencia]?.label ?? String(contrato.cadencia);
  const vigencia = `${contrato.data_inicio ? formatarData(contrato.data_inicio) : "—"} a ${contrato.data_fim_prevista ? formatarData(contrato.data_fim_prevista) : "—"}`;

  const itensTexto =
    itens.length > 0
      ? itens
          .map((i) => {
            const desc = i.item?.descricao ?? "Item";
            const un = i.item?.unidade ? ` ${i.item.unidade}` : "";
            const tag = i.identificacao ? ` [${i.identificacao}]` : "";
            return `• ${Number(i.quantidade)}${un} — ${desc}${tag}: ${formatarBRL(Number(i.valor_unitario_periodo))} / ${cadenciaLabel.toLowerCase()}`;
          })
          .join("\n\n")
      : "• (sem itens cadastrados)";

  const locatariaValor = [locatariaNome, org?.cnpj ? `CNPJ ${org.cnpj}` : null, locatariaEndereco || null]
    .filter(Boolean)
    .join(" · ");
  const locadorValor = [fornecedor?.nome, fornecedor?.cnpj ? `CNPJ ${fornecedor.cnpj}` : null]
    .filter(Boolean)
    .join(" · ");

  const infos: InfoLinha[] = [
    { label: "Contrato nº", valor: contrato.numero },
    { label: "Locadora (fornecedor)", valor: locadorValor || "—" },
    { label: "Locatária", valor: locatariaValor || `${orgNome} (Sistenge)` },
    { label: "Obra", valor: obra ? `${obra.codigo} — ${obra.nome}` : "—" },
    { label: "Vigência", valor: vigencia },
    { label: "Cadência", valor: cadenciaLabel },
  ];

  const variaveis: Record<string, string> = {
    locataria: locatariaNome,
    empresa_cnpj: org?.cnpj ?? "",
    empresa_endereco: locatariaEndereco,
    locador: fornecedor?.nome ?? "o LOCADOR",
    fornecedor_cnpj: fornecedor?.cnpj ?? "",
    contrato_numero: contrato.numero,
    obra: obra ? `${obra.codigo} — ${obra.nome}` : "—",
    vigencia,
    cadencia: cadenciaLabel,
    itens: itensTexto,
    cidade: obra?.cidade ?? org?.cidade ?? "",
  };

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", contrato.org_id)
    .eq("tipo", "contrato_equipamento")
    .maybeSingle();

  const tpl = tplRow ?? DEFAULT_TEMPLATES.contrato_equipamento;
  const tituloDoc = renderTemplate(tpl.titulo, variaveis);
  const paragrafos = corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis));

  const hojeStr = formatarData(hojeISOSaoPaulo());
  const buffer = await renderToBuffer(
    <DocumentoTexto
      orgNome={orgNome}
      eyebrow={documentoInfo("contrato_equipamento")?.eyebrow ?? "Contrato de locação de equipamento"}
      titulo={tituloDoc}
      infos={infos}
      paragrafos={paragrafos}
      assinaturas={[
        { nome: fornecedor?.nome ?? "Locadora", papel: "Locadora (fornecedor)" },
        {
          nome: org?.representante_nome ?? orgNome,
          papel: org?.representante_cargo ? `${org.representante_cargo} — ${locatariaNome}` : `Locatária (${locatariaNome})`,
        },
      ]}
      localData={`${obra?.cidade ?? org?.cidade ?? "________"}, ${hojeStr}.`}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${contrato.numero}.pdf"`,
    },
  });
}
