import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ObraForm } from "../obra-form";

export const metadata = { title: "Editar obra — Loca" };

export default async function EditarObraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/obras");

  const { id } = await params;
  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obra")
    .select("id, codigo, nome, endereco, responsavel, centro_custo, status")
    .eq("id", id)
    .single();

  if (!obra) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar obra" descricao={obra.nome} />
      <Card>
        <CardContent className="pt-6">
          <ObraForm obra={obra} />
        </CardContent>
      </Card>
    </div>
  );
}
