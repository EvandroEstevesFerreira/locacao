import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TemplateEditor } from "../../template-editor";
import {
  DEFAULT_TEMPLATES,
  documentoInfo,
  type TipoDocumento,
} from "@/lib/templates";

export const metadata = { title: "Editar template — Loca" };

export default async function EditarTemplatePage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  const doc = documentoInfo(tipo as TipoDocumento);
  if (!doc) notFound();

  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("documento_template")
    .select("titulo, corpo")
    .eq("org_id", perfil.org_id)
    .eq("tipo", doc.tipo)
    .maybeSingle();

  const padrao = DEFAULT_TEMPLATES[doc.tipo];
  const titulo = data?.titulo ?? padrao.titulo;
  const corpo = data?.corpo ?? padrao.corpo;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titulo={doc.label} descricao={doc.descricao} />
      <Card>
        <CardContent className="pt-6">
          <TemplateEditor
            doc={doc}
            titulo={titulo}
            corpo={corpo}
            personalizado={Boolean(data)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
