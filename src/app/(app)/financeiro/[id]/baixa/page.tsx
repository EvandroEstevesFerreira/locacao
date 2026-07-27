import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { calcularEncargos } from "@/lib/financeiro";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { BaixaForm } from "../../baixa-form";

export const metadata = { title: "Dar baixa — Loca" };

type Lanc = {
  id: string;
  descricao: string;
  valor: number;
  vencimento: string;
  nf_numero: string | null;
};

export default async function BaixaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id || !podeGerenciarFinanceiro(perfil.papel)) redirect("/financeiro");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("lancamento_financeiro")
    .select("id, descricao, valor, vencimento, nf_numero")
    .eq("id", id)
    .single();
  if (!data) notFound();
  const lanc = data as Lanc;

  const encargos = calcularEncargos({
    valor: Number(lanc.valor),
    vencimento: lanc.vencimento,
    referencia: hojeISOSaoPaulo(),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Financeiro" titulo="Dar baixa" descricao="Conciliação: valor efetivo, encargos e comprovante." />
      <Card>
        <CardContent className="pt-6">
          <BaixaForm lancamento={lanc} orgId={perfil.org_id} encargos={encargos} />
        </CardContent>
      </Card>
    </div>
  );
}
