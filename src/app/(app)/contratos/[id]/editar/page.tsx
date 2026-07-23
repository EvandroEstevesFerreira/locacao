import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ContratoForm } from "../../contrato-form";

export const metadata = { title: "Editar contrato — Loca" };

export default async function EditarContratoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/contratos");

  const { id } = await params;
  const supabase = await createClient();
  const [{ data: contrato }, { data: obras }, { data: fornecedores }] =
    await Promise.all([
      supabase
        .from("contrato_locacao")
        .select(
          "id, obra_id, fornecedor_id, numero, cadencia, data_inicio, data_fim_prevista, status, observacoes, cobranca_prorata",
        )
        .eq("id", id)
        .single(),
      supabase.from("obra").select("id, codigo, nome").order("codigo"),
      supabase.from("fornecedor").select("id, nome").order("nome"),
    ]);

  if (!contrato) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo={`Editar contrato ${contrato.numero}`} />
      <Card>
        <CardContent className="pt-6">
          <ContratoForm
            contrato={contrato}
            obras={obras ?? []}
            fornecedores={fornecedores ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
