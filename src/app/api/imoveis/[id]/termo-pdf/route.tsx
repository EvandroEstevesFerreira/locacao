import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/locacao";
import { tipoImovelLabel } from "@/lib/imoveis";
import { DocumentoTexto, type InfoLinha } from "@/lib/pdf";

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

  const infos: InfoLinha[] = [
    { label: "Ocupante", valor: ocupante.nome },
    { label: "CPF", valor: ocupante.cpf ?? "—" },
    { label: "Imóvel", valor: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})` },
    { label: "Endereço", valor: [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—" },
    { label: "Cedente", valor: `${orgNome} (Sistenge)` },
  ];

  const paragrafos = [
    `Eu, ${ocupante.nome}${ocupante.cpf ? `, inscrito(a) no CPF nº ${ocupante.cpf}` : ""}, declaro que ocuparei o imóvel acima identificado, disponibilizado por ${orgNome}, assumindo integral responsabilidade sobre sua guarda, conservação e uso adequado.`,
    "Comprometo-me a: (a) zelar pela limpeza e conservação do imóvel e de seus equipamentos; (b) comunicar imediatamente à empresa quaisquer avarias, defeitos ou ocorrências; (c) não realizar alterações estruturais sem autorização; (d) utilizar o imóvel de forma pacífica e conforme as normas de convivência.",
    "Declaro ciência de que serei responsável por danos causados ao imóvel além do desgaste natural de uso, apurados em vistoria, bem como pela devolução do imóvel em bom estado ao término da ocupação.",
    "Por ser expressão da verdade, firmo o presente Termo de Responsabilidade.",
  ];

  const hojeStr = formatarData(new Date().toISOString().slice(0, 10));
  const buffer = await renderToBuffer(
    <DocumentoTexto
      orgNome={orgNome}
      eyebrow="Termo de responsabilidade"
      titulo="TERMO DE RESPONSABILIDADE"
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
