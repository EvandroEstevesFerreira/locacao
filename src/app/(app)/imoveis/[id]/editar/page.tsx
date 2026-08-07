import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ImovelForm } from "../../imovel-form";

export const metadata = { title: "Editar imóvel — Loca" };

export default async function EditarImovelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeOperar(perfil.papel)) redirect("/imoveis");

  const supabase = await createClient();
  const [{ data: imovel }, { data: obras }] = await Promise.all([
    supabase.from("imovel").select("*").eq("id", id).single(),
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
  ]);
  if (!imovel) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titulo="Editar imóvel" descricao={imovel.apelido} />
      <Card>
        <CardContent className="pt-6">
          <ImovelForm imovel={imovel} obras={obras ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
