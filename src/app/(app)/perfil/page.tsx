import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, PAPEL_INFO } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PerfilForm } from "./perfil-form";

export const metadata = { title: "Meu perfil — Loca" };

export default async function PerfilPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil) redirect("/login");

  const supabase = await createClient();
  const { data: vinculos } = await supabase
    .from("obra_usuario")
    .select("obra:obra_id(codigo, nome)")
    .eq("perfil_id", perfil.id);
  const obras = (vinculos ?? [])
    .map((v) => v.obra as unknown as { codigo: string; nome: string } | null)
    .filter(Boolean) as { codigo: string; nome: string }[];

  const info = PAPEL_INFO[perfil.papel];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Conta"
        titulo="Meu perfil"
        descricao="Seus dados de acesso ao sistema."
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">E-mail</p>
            <p className="font-medium">{perfil.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Perfil</p>
            <p className="font-medium">{info?.label ?? perfil.papel}</p>
            <p className="text-xs text-muted-foreground">{info?.descricao}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs text-muted-foreground">Obras com acesso</p>
            <p className="font-medium">
              {perfil.papel === "master" || perfil.papel === "administrador"
                ? "Todas as obras"
                : obras.length > 0
                  ? obras.map((o) => `${o.codigo} — ${o.nome}`).join(", ")
                  : "Nenhuma obra atribuída"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados e senha</CardTitle>
          <CardDescription>
            Atualize seu nome e, se quiser, defina uma nova senha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PerfilForm nome={perfil.nome ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
