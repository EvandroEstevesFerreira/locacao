import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarUsuarios } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { UsuarioForm } from "../usuario-form";

export const metadata = { title: "Editar usuário — Loca" };

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarUsuarios(perfil?.papel)) redirect("/");

  const { id } = await params;
  const supabase = await createClient();

  const [{ data: usuario }, { data: obras }, { data: vinculos }] =
    await Promise.all([
      supabase.from("perfil").select("id, nome, email, papel, ativo").eq("id", id).single(),
      supabase.from("obra").select("id, codigo, nome").order("codigo"),
      supabase.from("obra_usuario").select("obra_id").eq("perfil_id", id),
    ]);

  if (!usuario) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Editar usuário"
        descricao={usuario.nome ?? usuario.email ?? ""}
      />
      <Card>
        <CardContent className="pt-6">
          <UsuarioForm
            usuario={{
              id: usuario.id,
              nome: usuario.nome ?? "",
              email: usuario.email ?? "",
              papel: usuario.papel,
              ativo: usuario.ativo,
            }}
            obras={obras ?? []}
            obrasDoUsuario={(vinculos ?? []).map((v) => v.obra_id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
