import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { LancamentoForm } from "../lancamento-form";

export const metadata = { title: "Novo lançamento — Loca" };

export default async function NovoLancamentoPage() {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const supabase = await createClient();
  const [{ data: obras }, { data: contratos }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
    supabase.from("contrato_locacao").select("id, numero").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo lançamento"
        descricao="Conta a pagar de uma locação."
      />
      <Card>
        <CardContent className="pt-6">
          <LancamentoForm obras={obras ?? []} contratos={contratos ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
