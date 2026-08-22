import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { tipoImovelLabel } from "@/lib/imoveis";
import type { Campo } from "@/lib/pdf-form";
import { TermoCompromisso } from "@/lib/documentos/frm-rh-001";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  corpoParaParagrafos,
} from "@/lib/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const ocupanteId = url.searchParams.get("ocupante");
  if (!ocupanteId) {
    return NextResponse.json({ error: "Ocupante não informado." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const [{ data: imovel }, { data: ocupante }] = await Promise.all([
    supabase
      .from("imovel")
      .select("apelido, tipo, endereco, cidade, uf, obra_id, org_id")
      .eq("id", id)
      .single(),
    supabase
      .from("ocupante_imovel")
      .select("nome, cpf, cargo, quarto, armario")
      .eq("id", ocupanteId)
      .single(),
  ]);
  if (!imovel || !ocupante) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

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

  const imovelEndereco =
    [imovel.endereco, imovel.cidade, imovel.uf].filter(Boolean).join(", ") || null;
  const obraLabel = obra ? [obra.codigo, obra.nome].filter(Boolean).join(" — ") : null;

  // Os 14 rótulos do bloco de identificação do FRM-RH-001, na ordem do original.
  // O que o Loca não guarda vai sem `valor`: o CampoGrid desenha a linha para o
  // RH preencher à mão. Ver a decisão "só o essencial" na spec de 2026-08-22.
  const campos: Campo[] = [
    { label: "Nome completo", valor: ocupante.nome },
    { label: "CPF", valor: ocupante.cpf },
    { label: "RG / Órgão emissor" },
    { label: "Função / Cargo", valor: ocupante.cargo },
    { label: "Centro de Resultado (CR)", valor: obra?.centro_custo ?? null },
    { label: "Contrato / Obra", valor: obraLabel },
    { label: "Data de admissão" },
    { label: "Endereço do alojamento", valor: imovelEndereco },
    { label: "Nº do alojamento / Quarto", valor: ocupante.quarto },
    { label: "Nº do armário individual", valor: ocupante.armario },
    { label: "Encarregado responsável" },
    { label: "Telefone do encarregado" },
    { label: "Contato de emergência (nome)" },
    { label: "Contato de emergência (telefone)" },
  ];

  const { data: tplRow } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", imovel.org_id)
    .eq("tipo", "termo_responsabilidade")
    .maybeSingle();

  const variaveis: Record<string, string> = {
    ocupante: ocupante.nome,
    ocupante_cpf: ocupante.cpf ?? "—",
    ocupante_cargo: ocupante.cargo ?? "—",
    imovel: `${imovel.apelido} (${tipoImovelLabel(imovel.tipo)})`,
    imovel_endereco: imovelEndereco ?? "—",
    quarto: ocupante.quarto ?? "—",
    armario: ocupante.armario ?? "—",
    obra: obraLabel ?? "—",
    centro_resultado: obra?.centro_custo ?? "—",
    empresa_nome: orgNome,
    cidade: imovel.cidade ?? "",
  };

  const tpl = tplRow ?? DEFAULT_TEMPLATES.termo_responsabilidade;
  const tituloDoc = renderTemplate(tpl.titulo, variaveis);
  const paragrafos = corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis));

  const hojeStr = formatarData(hojeISOSaoPaulo());
  const buffer = await renderToBuffer(
    <TermoCompromisso
      orgNome={orgNome}
      titulo={tituloDoc}
      campos={campos}
      paragrafos={paragrafos}
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
