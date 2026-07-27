import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmpresaForm, type EmpresaDados } from "../empresa-form";

export const metadata = { title: "Dados da empresa — Loca" };

export default async function EmpresaPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizacao")
    .select("*")
    .eq("id", perfil.org_id)
    .single();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Configurações"
        titulo="Dados da empresa"
        descricao="Cadastro completo da organização — usado nos contratos e documentos."
      />
      <Card>
        <CardContent className="pt-6">
          <EmpresaForm empresa={(data ?? {}) as EmpresaDados} />
        </CardContent>
      </Card>
    </div>
  );
}
