import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { tipoImovelLabel } from "@/lib/imoveis";
import { DocumentoTexto, type InfoLinha } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: imovel } = await supabase
    .from("imovel")
    .select("apelido, tipo, endereco, cidade, uf, proprietario_nome, org_id, contrato_imovel(data_inicio, data_fim, valor_aluguel, valor_condominio, dia_vencimento, indice_reajuste, caucao_valor, vigente)")
    .eq("id", id)
    .single();
  if (!imovel) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });

  const { data: org } = await supabase.from("organizacao").select("nome").eq("id", imovel.org_id).single();
  const orgNome = org?.nome ?? "Sistenge";

  const contratos = (imovel.contrato_imovel ?? []) as Array<{
    data_inicio: string | null; data_fim: string | null; valor_aluguel: number;
    valor_condominio: number; dia_vencimento: number | null; indice_reajuste: string | null;
    caucao_valor: number | null; vigente: boolean;
  }>;
  const c = contratos.find((x) => x.vigente) ?? contratos[0] ?? null;

  const infos: InfoLinha[] = [
    { label: "Imóvel", valor: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})` },
    { label: "Endereço", valor: [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—" },
    { label: "Locador (proprietário)", valor: imovel.proprietario_nome ?? "—" },
    { label: "Locatária", valor: `${orgNome} (Sistenge)` },
  ];
  if (c) {
    infos.push(
      { label: "Vigência", valor: `${c.data_inicio ? formatarData(c.data_inicio) : "—"} a ${c.data_fim ? formatarData(c.data_fim) : "—"}` },
      { label: "Aluguel mensal", valor: formatarBRL(Number(c.valor_aluguel)) },
      { label: "Condomínio", valor: formatarBRL(Number(c.valor_condominio)) },
      { label: "Vencimento", valor: c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—" },
    );
    if (c.caucao_valor != null) infos.push({ label: "Caução", valor: formatarBRL(Number(c.caucao_valor)) });
  }

  const aluguel = c ? formatarBRL(Number(c.valor_aluguel)) : "—";
  const cond = c ? formatarBRL(Number(c.valor_condominio)) : "R$ 0,00";
  const paragrafos = [
    `Pelo presente instrumento particular, ${orgNome} (doravante LOCATÁRIA) e ${imovel.proprietario_nome ?? "o LOCADOR"} (doravante LOCADOR) ajustam a locação do imóvel acima identificado, nas condições a seguir.`,
    `O valor do aluguel mensal é de ${aluguel}, acrescido de condomínio de ${cond}${c?.dia_vencimento ? `, com vencimento todo dia ${c.dia_vencimento} de cada mês` : ""}. ${c?.indice_reajuste ? `O reajuste observará o índice ${c.indice_reajuste}, na periodicidade legal.` : ""}`,
    "A LOCATÁRIA compromete-se a conservar o imóvel, comunicar avarias e devolvê-lo, ao término da locação, no estado em que o recebeu, salvo o desgaste natural pelo uso regular.",
    "Eventuais danos causados ao imóvel, além do desgaste natural, serão de responsabilidade da LOCATÁRIA, apurados em vistoria de devolução.",
    "As partes elegem o foro da comarca do imóvel para dirimir questões oriundas deste contrato.",
  ];

  const hojeStr = formatarData(new Date().toISOString().slice(0, 10));
  const buffer = await renderToBuffer(
    <DocumentoTexto
      orgNome={orgNome}
      eyebrow="Contrato de locação"
      titulo="CONTRATO DE LOCAÇÃO DE IMÓVEL"
      infos={infos}
      paragrafos={paragrafos}
      assinaturas={[
        { nome: imovel.proprietario_nome ?? "Locador", papel: "Locador" },
        { nome: orgNome, papel: "Locatária (Sistenge)" },
      ]}
      localData={`${imovel.cidade ?? "________"}, ${hojeStr}.`}
    />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="contrato-${id}.pdf"`,
    },
  });
}
