import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData } from "@/lib/locacao";
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { data: imovel } = await supabase
    .from("imovel")
    .select("apelido, tipo, endereco, cidade, uf, proprietario_nome, banco, agencia, conta, tipo_conta, titular_conta, pix_chave, org_id, contrato_imovel(data_inicio, data_fim, valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, dia_vencimento, indice_reajuste, caucao_valor, vigente)")
    .eq("id", id)
    .single();
  if (!imovel) return NextResponse.json({ error: "Imóvel não encontrado." }, { status: 404 });

  const { data: org } = await supabase
    .from("organizacao")
    .select("nome, razao_social, cnpj, endereco, cidade, uf, cep, representante_nome, representante_cargo, representante_cpf")
    .eq("id", imovel.org_id)
    .single();
  const orgNome = org?.nome ?? "Sistenge";
  const locatariaNome = org?.razao_social ?? orgNome;
  const locatariaEndereco = [org?.endereco, org?.cidade, org?.uf, org?.cep].filter(Boolean).join(", ");
  const assinanteLocataria = org?.representante_nome ?? orgNome;

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", imovel.org_id)
    .eq("tipo", "contrato_imovel")
    .maybeSingle();

  const contratos = (imovel.contrato_imovel ?? []) as Array<{
    data_inicio: string | null; data_fim: string | null; valor_aluguel: number;
    valor_condominio: number; valor_iptu: number; seguro_fianca: number;
    seguro_fianca_mensal: boolean; dia_vencimento: number | null;
    indice_reajuste: string | null; caucao_valor: number | null; vigente: boolean;
  }>;
  const c = contratos.find((x) => x.vigente) ?? contratos[0] ?? null;

  const locatariaValor = [
    locatariaNome,
    org?.cnpj ? `CNPJ ${org.cnpj}` : null,
    locatariaEndereco || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const infos: InfoLinha[] = [
    { label: "Imóvel", valor: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})` },
    { label: "Endereço", valor: [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—" },
    { label: "Locador (proprietário)", valor: imovel.proprietario_nome ?? "—" },
    { label: "Locatária", valor: locatariaValor || `${orgNome} (Sistenge)` },
  ];
  if (c) {
    infos.push(
      { label: "Vigência", valor: `${c.data_inicio ? formatarData(c.data_inicio) : "—"} a ${c.data_fim ? formatarData(c.data_fim) : "—"}` },
      { label: "Aluguel mensal", valor: formatarBRL(Number(c.valor_aluguel)) },
      { label: "Condomínio", valor: formatarBRL(Number(c.valor_condominio)) },
      { label: "IPTU", valor: formatarBRL(Number(c.valor_iptu)) },
      { label: "Seguro fiança", valor: `${formatarBRL(Number(c.seguro_fianca))}${c.seguro_fianca_mensal ? "" : " (não somado à parcela)"}` },
      { label: "Total mensal", valor: formatarBRL(Number(c.valor_aluguel) + Number(c.valor_condominio) + Number(c.valor_iptu) + (c.seguro_fianca_mensal ? Number(c.seguro_fianca) : 0)) },
      { label: "Vencimento", valor: c.dia_vencimento ? `dia ${c.dia_vencimento}` : "—" },
    );
    if (c.caucao_valor != null) infos.push({ label: "Caução", valor: formatarBRL(Number(c.caucao_valor)) });
  }

  // Dados bancários do imóvel (pagamento ao locador) — para conferência/assinatura.
  const contaTxt = [
    imovel.conta,
    imovel.tipo_conta === "corrente" ? "corrente" : imovel.tipo_conta === "poupanca" ? "poupança" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  if (imovel.banco) infos.push({ label: "Banco", valor: imovel.banco });
  if (imovel.agencia) infos.push({ label: "Agência", valor: imovel.agencia });
  if (contaTxt) infos.push({ label: "Conta", valor: contaTxt });
  if (imovel.titular_conta) infos.push({ label: "Titular", valor: imovel.titular_conta });
  if (imovel.pix_chave) infos.push({ label: "Chave PIX", valor: imovel.pix_chave });

  const totalMensal = c
    ? Number(c.valor_aluguel) +
      Number(c.valor_condominio) +
      Number(c.valor_iptu) +
      (c.seguro_fianca_mensal ? Number(c.seguro_fianca) : 0)
    : 0;
  const dadosBancarios =
    [
      imovel.banco ? `Banco ${imovel.banco}` : null,
      imovel.agencia ? `ag. ${imovel.agencia}` : null,
      contaTxt ? `conta ${contaTxt}` : null,
      imovel.titular_conta ? `titular ${imovel.titular_conta}` : null,
      imovel.pix_chave ? `PIX ${imovel.pix_chave}` : null,
    ]
      .filter(Boolean)
      .join(", ") || "não informados";

  const variaveis: Record<string, string> = {
    locataria: locatariaNome,
    empresa_cnpj: org?.cnpj ?? "",
    empresa_endereco: locatariaEndereco,
    locador: imovel.proprietario_nome ?? "o LOCADOR",
    imovel: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})`,
    imovel_endereco: [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || "—",
    vigencia: c
      ? `${c.data_inicio ? formatarData(c.data_inicio) : "—"} a ${c.data_fim ? formatarData(c.data_fim) : "—"}`
      : "—",
    aluguel: c ? formatarBRL(Number(c.valor_aluguel)) : "—",
    condominio: c ? formatarBRL(Number(c.valor_condominio)) : "R$ 0,00",
    iptu: c ? formatarBRL(Number(c.valor_iptu)) : "R$ 0,00",
    seguro_fianca: c ? formatarBRL(Number(c.seguro_fianca)) : "R$ 0,00",
    total_mensal: c ? formatarBRL(totalMensal) : "—",
    vencimento: c?.dia_vencimento ? `dia ${c.dia_vencimento}` : "—",
    indice_reajuste: c?.indice_reajuste ?? "—",
    caucao: c?.caucao_valor != null ? formatarBRL(Number(c.caucao_valor)) : "—",
    dados_bancarios: dadosBancarios,
    cidade: imovel.cidade ?? "",
  };

  const tpl = tplRow ?? DEFAULT_TEMPLATES.contrato_imovel;
  const tituloDoc = renderTemplate(tpl.titulo, variaveis);
  const paragrafos = corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis));

  const hojeStr = formatarData(new Date().toISOString().slice(0, 10));
  const buffer = await renderToBuffer(
    <DocumentoTexto
      orgNome={orgNome}
      eyebrow={documentoInfo("contrato_imovel")?.eyebrow ?? "Contrato de locação"}
      titulo={tituloDoc}
      infos={infos}
      paragrafos={paragrafos}
      assinaturas={[
        { nome: imovel.proprietario_nome ?? "Locador", papel: "Locador" },
        {
          nome: assinanteLocataria,
          papel: org?.representante_cargo
            ? `${org.representante_cargo} — ${locatariaNome}`
            : `Locatária (${locatariaNome})`,
        },
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
