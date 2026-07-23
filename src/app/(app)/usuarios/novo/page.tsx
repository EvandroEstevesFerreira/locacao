import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarUsuarios } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UsuarioNovoForm } from "../usuario-novo-form";

export const metadata = { title: "Novo usuário — Loca" };

export default async function NovoUsuarioPage() {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarUsuarios(perfil?.papel)) redirect("/");

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obra")
    .select("id, codigo, nome")
    .order("codigo");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo usuário"
        descricao="Crie o acesso com nome, e-mail, perfil e senha temporária."
      />
      <Card>
        <CardContent className="pt-6">
          <UsuarioNovoForm obras={obras ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
