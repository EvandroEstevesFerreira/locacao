import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DOCUMENTOS } from "@/lib/templates";

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
        eyebrow="Configurações"
        titulo="Templates de documentos"
        descricao="Edite o texto dos contratos e termos com variáveis que o sistema preenche."
      />
      {DOCUMENTOS.map((doc) => (
        <Card key={doc.tipo}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4" /> {doc.label}
                {personalizados.has(doc.tipo) ? (
                  <Badge variant="secondary">Personalizado</Badge>
                ) : (
                  <Badge variant="outline">Padrão</Badge>
                )}
              </CardTitle>
              <CardDescription>{doc.descricao}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/configuracoes/templates/${doc.tipo}`} />}
            >
              Editar
              <ChevronRight className="size-4" />
            </Button>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
