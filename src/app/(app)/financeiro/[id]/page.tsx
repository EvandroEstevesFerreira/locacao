import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LancamentoForm } from "../lancamento-form";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Editar lançamento — Loca" };

export default async function EditarLancamentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: lancamento }, obras, { data: contratos }] =
    await Promise.all([
      supabase
        .from("lancamento_financeiro")
        .select("id, obra_id, contrato_id, descricao, competencia, valor, vencimento, status")
        .eq("id", id)
        .single(),
      listarObrasParaFiltro(),
      supabase.from("contrato_locacao").select("id, numero").order("created_at", { ascending: false }),
    ]);

  if (!lancamento) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar lançamento" descricao={lancamento.descricao} />
      <Card>
        <CardContent className="pt-6">
          <LancamentoForm
            lancamento={lancamento}
            obras={obras}
            contratos={contratos ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
