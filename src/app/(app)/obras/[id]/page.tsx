import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { historicoAvanco } from "@/lib/data/avanco";
import {
  orcamentoVigente,
  historicoOrcamento,
  realizadoLocacao,
} from "@/lib/data/orcamento";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { percentualPrazo } from "@/lib/avanco";
import { percentualConsumido } from "@/lib/orcamento";
import { ObraForm } from "../obra-form";
import { BlocoAvanco } from "./_components/bloco-avanco";
import { BlocoOrcamento } from "./_components/bloco-orcamento";

export const metadata = { title: "Editar obra — Loca" };

export default async function EditarObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/obras");

  const { id } = await params;
  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obra")
    .select(
      "id, codigo, nome, endereco, responsavel, centro_custo, status, destinatarios_alerta, data_inicio, data_fim_prevista, data_fim_real",
    )
    .eq("id", id)
    .single();

  if (!obra) notFound();

  // Quem já recebe os avisos desta obra por estar vinculado a ela. É exibição,
  // não configuração: sem isto a pessoa digita nos "e-mails extras" endereços
  // que o vínculo já entrega, e passa a receber dois e-mails iguais.
  const { data: vinculos } = await supabase
    .from("obra_usuario")
    .select("perfil:perfil_id(email, ativo)")
    .eq("obra_id", id);
  const vinculados = (vinculos ?? [])
    .map((v) => v.perfil as unknown as { email: string | null; ativo: boolean } | null)
    .filter((p): p is { email: string; ativo: boolean } => Boolean(p?.ativo && p.email))
    .map((p) => p.email);

  // Em paralelo: são quatro leituras independentes, e serializá-las somaria
  // latência sem motivo.
  const [historico, orcamento, historicoOrc, realizado, catalogo] = await Promise.all([
    historicoAvanco(id),
    orcamentoVigente(id),
    historicoOrcamento(id),
    realizadoLocacao(id),
    supabase
      .from("item_catalogo")
      .select("id, descricao")
      .eq("ativo", true)
      .order("descricao")
      .then((r) => r.data ?? []),
  ]);

  const hojeISO = hojeISOSaoPaulo();
  const fisico = historico[0]?.percentual ?? null;
  const prazo = percentualPrazo(obra, hojeISO);
  const consumido = orcamento
    ? percentualConsumido(orcamento.valor_total, realizado.comContrato)
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar obra" descricao={obra.nome} />
      <Card>
        <CardContent className="pt-6">
          <ObraForm obra={obra} vinculados={vinculados} />
        </CardContent>
      </Card>

      <BlocoAvanco obra={obra} historico={historico} consumido={consumido} />

      <BlocoOrcamento
        obraId={id}
        orcamento={orcamento}
        realizado={realizado}
        historico={historicoOrc}
        fisico={fisico}
        prazo={prazo}
        catalogo={catalogo}
      />
    </div>
  );
}
