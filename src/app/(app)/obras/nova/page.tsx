import { redirect } from "next/navigation";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ObraForm } from "../obra-form";

export const metadata = { title: "Nova obra — Loca" };

export default async function NovaObraPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/obras");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Nova obra" descricao="Cadastre uma obra da organização." />
      <Card>
        <CardContent className="pt-6">
          <ObraForm />
        </CardContent>
      </Card>
    </div>
  );
}
