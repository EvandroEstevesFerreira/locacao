import { redirect } from "next/navigation";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ObraForm } from "../obra-form";
import { listarDepartamentosPossiveisPai } from "@/lib/data/obras";

export const metadata = { title: "Novo centro de custo — Loca" };

export default async function NovaObraPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/obras");

  // Buscado sempre: na criação o tipo muda enquanto a pessoa preenche, e
  // buscar depois exigiria uma ida ao servidor no meio do formulário.
  const paisPossiveis = await listarDepartamentosPossiveisPai();

  return (
    <div className="pagina-form space-y-6">
      <PageHeader
        titulo="Novo centro de custo"
        descricao="Cadastre uma obra ou um departamento da organização."
      />
      <Card>
        <CardContent className="pt-6">
          <ObraForm paisPossiveis={paisPossiveis} />
        </CardContent>
      </Card>
    </div>
  );
}
