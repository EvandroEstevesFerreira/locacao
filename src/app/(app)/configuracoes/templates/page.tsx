import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DOCUMENTOS } from "@/lib/templates";
import { ConfigRow } from "@/components/shared/config-row";

export const metadata = { title: "Templates de documentos — Loca" };

export default async function TemplatesPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("documento_template")
    .select("tipo")
    .eq("org_id", perfil.org_id);
  const personalizados = new Set((data ?? []).map((d) => d.tipo));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Templates de documentos"
        descricao="Edite o texto dos contratos e termos com variáveis que o sistema preenche."
      />
      <Card>
        <CardContent className="divide-y p-0">
          {DOCUMENTOS.map((doc) => (
            <ConfigRow
              key={doc.tipo}
              href={`/configuracoes/templates/${doc.tipo}`}
              icon={FileText}
              titulo={doc.label}
              descricao={doc.descricao}
              extra={
                personalizados.has(doc.tipo) ? (
                  <Badge variant="secondary">Personalizado</Badge>
                ) : (
                  <Badge variant="outline">Padrão</Badge>
                )
              }
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
