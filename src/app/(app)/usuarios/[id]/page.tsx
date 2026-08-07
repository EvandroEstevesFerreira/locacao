import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarUsuarios } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsuarioForm } from "../usuario-form";
import { excluirUsuario } from "../actions";

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
      supabase.from("perfil").select("id, nome, email, papel, ativo, modulos").eq("id", id).single(),
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
            modulosDoUsuario={(usuario.modulos as string[] | null) ?? null}
          />
        </CardContent>
      </Card>

      {usuario.id !== perfil?.id ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Excluir usuário
            </CardTitle>
            <CardDescription>
              Remove o acesso desta pessoa em definitivo. Não pode ser desfeito.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={excluirUsuario}>
              <input type="hidden" name="id" value={usuario.id} />
              <Button type="submit" variant="outline" className="text-destructive">
                Excluir {usuario.nome ?? usuario.email ?? "usuário"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
