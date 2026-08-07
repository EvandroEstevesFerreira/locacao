import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarData, hojeISOSaoPaulo} from "@/lib/locacao";
import { tipoImovelLabel } from "@/lib/imoveis";
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
  const url = new URL(request.url);
  const ocupanteId = url.searchParams.get("ocupante");
  if (!ocupanteId) return NextResponse.json({ error: "Ocupante não informado." }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [{ data: imovel }, { data: ocupante }] = await Promise.all([
    supabase.from("imovel").select("apelido, tipo, endereco, cidade, uf, org_id").eq("id", id).single(),
    supabase.from("ocupante_imovel").select("nome, cpf").eq("id", ocupanteId).single(),
  ]);
  if (!imovel || !ocupante) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });

  const { data: org } = await supabase.from("organizacao").select("nome").eq("id", imovel.org_id).single();
  const orgNome = org?.nome ?? "Sistenge";

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", imovel.org_id)
    .eq("tipo", "termo_responsabilidade")
    .maybeSingle();

  const imovelEndereco = [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—";
  const infos: InfoLinha[] = [
    { label: "Ocupante", valor: ocupante.nome },
    { label: "CPF", valor: ocupante.cpf ?? "—" },
    { label: "Imóvel", valor: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})` },
    { label: "Endereço", valor: imovelEndereco },
    { label: "Cedente", valor: `${orgNome} (Sistenge)` },
  ];

  const variaveis: Record<string, string> = {
    ocupante: ocupante.nome,
    ocupante_cpf: ocupante.cpf ?? "—",
    imovel: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})`,
    imovel_endereco: imovelEndereco,
    empresa_nome: orgNome,
    cidade: imovel.cidade ?? "",
  };

  const tpl = tplRow ?? DEFAULT_TEMPLATES.termo_responsabilidade;
  const tituloDoc = renderTemplate(tpl.titulo, variaveis);
  const paragrafos = corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis));

  const hojeStr = formatarData(hojeISOSaoPaulo());
  const buffer = await renderToBuffer(
    <DocumentoTexto
      orgNome={orgNome}
      eyebrow={documentoInfo("termo_responsabilidade")?.eyebrow ?? "Termo de responsabilidade"}
      titulo={tituloDoc}
      infos={infos}
      paragrafos={paragrafos}
      assinaturas={[
        { nome: ocupante.nome, papel: "Ocupante" },
        { nome: orgNome, papel: "Sistenge" },
      ]}
      localData={`${imovel.cidade ?? "________"}, ${hojeStr}.`}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="termo-${ocupanteId}.pdf"`,
    },
  });
}
