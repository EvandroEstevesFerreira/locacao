import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeConfigurarSistema } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MODULOS } from "@/lib/modulos";
import { documentosDoModulo } from "@/lib/templates";
import { ConfigRow, SecaoTitulo } from "@/components/shared/config-row";

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
      {MODULOS.filter((m) => documentosDoModulo(m.chave).length > 0).map((m) => (
        <div key={m.chave} className="space-y-2">
          <SecaoTitulo>{m.label}</SecaoTitulo>
          <Card>
            <CardContent className="divide-y p-0">
              {documentosDoModulo(m.chave).map((doc) => (
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
      ))}
    </div>
  );
}
