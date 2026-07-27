import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FornecedorForm } from "../fornecedor-form";

export const metadata = { title: "Novo fornecedor — Loca" };

export default async function NovoFornecedorPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/fornecedores");

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obra")
    .select("id, codigo, nome")
    .order("codigo");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo fornecedor"
        descricao="Cadastre uma locadora ou fornecedor."
      />
      <Card>
        <CardContent className="pt-6">
          <FornecedorForm obras={obras ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
