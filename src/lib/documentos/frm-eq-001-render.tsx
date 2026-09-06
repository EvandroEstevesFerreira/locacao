import "server-only";

// Monta o FRM-EQ-001 a partir de um termo — dados, template e PDF.
//
// SEPARADO DA ROTA DE PROPÓSITO, e não pela razão de sempre.
//
// Os outros `-render.tsx` existem para não arrastar o `@react-pdf/renderer`
// para o grafo de quem só quer o tipo dos dados. Este existe por cima disso: o
// PDF do termo agora sai por DOIS caminhos — o download na tela e o anexo do
// e-mail ao funcionário. Montar os campos, os itens e as assinaturas nos dois
// lugares seria duas cópias de umas oitenta linhas, e a divergência apareceria
// como **o PDF que a pessoa recebeu por e-mail sendo diferente do que ela baixa
// na tela** — num documento assinado, com valor de prova.
//
// Uma função, dois chamadores.

import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import { obterTermo, type TermoDetalhe } from "@/lib/data/termo";
import { estadoLabel } from "@/lib/termo";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { renderTemplate, corpoParaParagrafos, resolverTemplate } from "@/lib/templates";
import { TermoEquipamento, type ItemTermoDoc } from "@/lib/documentos/frm-eq-001";
import type { Campo, Assinante } from "@/lib/pdf-form";

export type TermoRenderizado = {
  termo: TermoDetalhe;
  buffer: Buffer;
  /** `FRM-EQ-001-TRM-2026-0007.pdf`, ou `-rascunho` quando não há número. */
  arquivo: string;
};

/**
 * O termo em PDF, pronto para baixar ou anexar.
 *
 * Devolve `null` quando o termo não existe **ou** quando a RLS o esconde:
 * `obterTermo` usa `createClient()`, então termo de outra organização volta
 * como não encontrado, e não como PDF de outro tenant.
 *
 * Sai tanto para rascunho quanto para termo emitido — o rascunho é justamente o
 * que se imprime para colher a assinatura à caneta quando o funcionário não
 * está com o celular na mão. O que muda é o subtítulo, e isso o próprio
 * componente resolve.
 */
export async function gerarTermoEquipamentoPdf(
  id: string,
): Promise<TermoRenderizado | null> {
  const termo = await obterTermo(id);
  if (!termo) return null;

  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return null;

  const supabase = await createClient();
  const [{ data: org }, { data: tplRow }] = await Promise.all([
    supabase.from("organizacao").select("nome").eq("id", perfil.org_id).maybeSingle(),
    supabase
      .from("documento_template")
      .select("titulo, corpo, versao, updated_at")
      .eq("org_id", perfil.org_id)
      .eq("tipo", "termo_equipamento")
      .maybeSingle(),
  ]);
  const orgNome = (org as { nome: string } | null)?.nome ?? "Sistenge";
  const tpl = resolverTemplate("termo_equipamento", tplRow);

  const obra = [termo.obra_codigo, termo.obra_nome].filter(Boolean).join(" — ");
  const variaveis = {
    empresa_nome: orgNome,
    funcionario: termo.funcionario_nome,
    funcionario_cpf: termo.funcionario_cpf ?? "",
    funcionario_cargo: termo.funcionario_cargo ?? "",
    obra,
    data_entrega: formatarData(termo.data_entrega),
    previsao_devolucao: formatarData(termo.previsao_devolucao),
  };

  const campos: Campo[] = [
    { label: "Funcionário", valor: termo.funcionario_nome },
    { label: "CPF", valor: termo.funcionario_cpf },
    { label: "Função", valor: termo.funcionario_cargo },
    { label: "Obra", valor: obra || null },
    { label: "Data da entrega", valor: formatarData(termo.data_entrega) },
    { label: "Previsão de devolução", valor: formatarData(termo.previsao_devolucao) },
  ];

  const itens: ItemTermoDoc[] = termo.itens.map((i) => ({
    descricao: i.item_descricao,
    patrimonio: i.patrimonio,
    quantidade: `${i.quantidade}${i.unidade_medida ? ` ${i.unidade_medida}` : ""}`,
    estadoEntrega: estadoLabel(i.estado_entrega),
    dataDevolucao: i.data_devolucao ? formatarData(i.data_devolucao) : null,
    estadoDevolucao: i.estado_devolucao ? estadoLabel(i.estado_devolucao) : null,
  }));

  // As assinaturas impressas são as da ENTREGA. As da devolução ficam
  // registradas no sistema com hora e IP; imprimir as quatro num papel só faria
  // quem confere não saber qual traço pertence a qual momento.
  const daEntrega = termo.assinaturas.filter((a) => a.momento === "entrega");
  const assinantes: Assinante[] = [
    {
      nome: termo.funcionario_nome,
      papel: "Funcionário",
      detalhe: termo.funcionario_cpf ? `CPF ${termo.funcionario_cpf}` : undefined,
      imagem: daEntrega.find((a) => a.papel === "funcionario")?.imagem ?? null,
    },
    {
      nome: daEntrega.find((a) => a.papel === "empresa")?.nome ?? orgNome,
      papel: "Pela empresa",
      imagem: daEntrega.find((a) => a.papel === "empresa")?.imagem ?? null,
    },
  ];

  // `hojeISOSaoPaulo()`, nunca `new Date().toISOString()`: o Vercel roda em UTC
  // e entre 21h e a meia-noite em Brasília a data sairia do dia seguinte.
  const localData = `${termo.obra_nome ?? "________"}, ${formatarData(
    termo.data_entrega || hojeISOSaoPaulo(),
  )}.`;

  const buffer = await renderToBuffer(
    <TermoEquipamento
      orgNome={orgNome}
      numero={termo.numero_registro}
      campos={campos}
      itens={itens}
      paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, variaveis))}
      localData={localData}
      assinantes={assinantes}
      versao={tpl.versao}
      publicadoEm={tpl.publicadoEm}
    />,
  );

  return {
    termo,
    buffer,
    arquivo: `FRM-EQ-001-${
      termo.numero_registro ? formatarNumero(termo.numero_registro) : "rascunho"
    }.pdf`,
  };
}
