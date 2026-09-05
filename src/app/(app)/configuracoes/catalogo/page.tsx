import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentPerfil, podeConfigurarSistema, podeEditarCadastros } from "@/lib/auth";
import { listarCategoriasComTipos } from "@/lib/data/catalogo";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CatalogoEditor } from "./catalogo-editor";

export const metadata = { title: "Categorias e tipos — Loca" };

export default async function CatalogoPage() {
  const perfil = await getCurrentPerfil();
  if (!podeConfigurarSistema(perfil?.papel)) redirect("/configuracoes");

  const categorias = await listarCategoriasComTipos();
  const tipos = categorias.reduce((s, c) => s + c.tipos.length, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Categorias e tipos"
        descricao={`A família de cada item, dentro de cada categoria. ${categorias.length} categorias, ${tipos} tipos.`}
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
            O tipo é o que impede o mesmo modelo de ser cadastrado duas vezes com
            a grafia diferente. Com a família digitada dentro da descrição, o
            sistema já teve <strong>Notebook Dell Latitude 3490</strong> e
            <strong> Notebook Dell Latitute 3490</strong> como dois cadastros,
            com seis máquinas divididas entre eles.
          </p>
          <CatalogoEditor
            categorias={categorias}
            podeEditar={podeEditarCadastros(perfil?.papel)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
