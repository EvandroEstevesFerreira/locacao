import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
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
    .select(
      "id, codigo, nome, endereco, responsavel, centro_custo, status, destinatarios_alerta",
    )
    .eq("id", id)
    .single();

  if (!obra) notFound();

  // Quem já recebe os avisos desta obra por estar vinculado a ela. É exibição,
  // não configuração: sem isto a pessoa digita nos "e-mails extras" endereços
  // que o vínculo já entrega, e passa a receber dois e-mails iguais.
  const { data: vinculos } = await supabase
    .from("obra_usuario")
    .select("perfil:perfil_id(email, ativo)")
    .eq("obra_id", id);
  const vinculados = (vinculos ?? [])
    .map((v) => v.perfil as unknown as { email: string | null; ativo: boolean } | null)
    .filter((p): p is { email: string; ativo: boolean } => Boolean(p?.ativo && p.email))
    .map((p) => p.email);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar obra" descricao={obra.nome} />
      <Card>
        <CardContent className="pt-6">
          <ObraForm obra={obra} vinculados={vinculados} />
        </CardContent>
      </Card>
    </div>
  );
}
