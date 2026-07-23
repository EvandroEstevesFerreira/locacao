import { redirect } from "next/navigation";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FornecedorForm } from "../fornecedor-form";

export const metadata = { title: "Novo fornecedor — Loca" };

export default async function NovoFornecedorPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/fornecedores");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo fornecedor"
        descricao="Cadastre uma locadora ou fornecedor."
      />
      <Card>
        <CardContent className="pt-6">
          <FornecedorForm />
        </CardContent>
      </Card>
    </div>
  );
}
