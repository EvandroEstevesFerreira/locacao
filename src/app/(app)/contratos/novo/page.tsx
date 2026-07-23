import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ContratoForm } from "../contrato-form";

export const metadata = { title: "Novo contrato — Loca" };

export default async function NovoContratoPage() {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/contratos");

  const supabase = await createClient();
  const [{ data: obras }, { data: fornecedores }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").eq("status", "ativa").order("codigo"),
    supabase.from("fornecedor").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo contrato"
        descricao="Vincule uma obra e um fornecedor e defina a cadência de cobrança."
      />
      <Card>
        <CardContent className="pt-6">
          <ContratoForm obras={obras ?? []} fornecedores={fornecedores ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
