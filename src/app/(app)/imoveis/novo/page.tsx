import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ImovelForm } from "../imovel-form";

export const metadata = { title: "Novo imóvel — Loca" };

export default async function NovoImovelPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeOperar(perfil.papel)) redirect("/imoveis");

  const supabase = await createClient();
  const { data: obras } = await supabase
    .from("obra")
    .select("id, codigo, nome")
    .order("codigo");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titulo="Novo imóvel" descricao="Cadastre um imóvel locado." />
      <Card>
        <CardContent className="pt-6">
          <ImovelForm obras={obras ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
