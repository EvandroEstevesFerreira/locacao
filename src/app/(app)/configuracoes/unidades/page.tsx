import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentPerfil, podeConfigurarSistema, podeEditarCadastros } from "@/lib/auth";
import { listarUnidades } from "@/lib/data/catalogo";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UnidadesEditor } from "./unidades-editor";

export const metadata = { title: "Unidades de medida — Loca" };

export default async function UnidadesPage() {
  const perfil = await getCurrentPerfil();
  if (!podeConfigurarSistema(perfil?.papel)) redirect("/configuracoes");

  const unidades = await listarUnidades(true);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Unidades de medida"
        descricao="A lista que o cadastro de item oferece."
        acoes={
          <Button variant="outline" render={<Link href="/configuracoes" />}>
            <ArrowLeft className="size-4" aria-hidden />
            Configurações
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            O campo era livre, com sugestões. Campo livre de unidade sempre acaba
            com <strong>un</strong>, <strong>UN</strong>, <strong>unid</strong> e
            <strong> unidade</strong> convivendo na mesma tabela, e aí nenhum
            relatório soma direito.
          </p>
          <UnidadesEditor
            unidades={unidades}
            podeEditar={podeEditarCadastros(perfil?.papel)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
