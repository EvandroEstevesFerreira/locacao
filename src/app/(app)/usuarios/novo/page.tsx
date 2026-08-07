import { redirect } from "next/navigation";
import { getCurrentPerfil, podeGerenciarUsuarios } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UsuarioNovoForm } from "../usuario-novo-form";
import { listarObrasParaFiltro } from "@/lib/data/obras";

export const metadata = { title: "Novo usuário — Loca" };

export default async function NovoUsuarioPage() {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarUsuarios(perfil?.papel)) redirect("/");

  const obras = await listarObrasParaFiltro();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo usuário"
        descricao="Crie o acesso com nome, e-mail, perfil e senha temporária."
      />
      <Card>
        <CardContent className="pt-6">
          <UsuarioNovoForm obras={obras} />
        </CardContent>
      </Card>
    </div>
  );
}
