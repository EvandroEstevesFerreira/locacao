import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { VistoriaForm } from "../vistoria-form";

export const metadata = { title: "Nova vistoria — Loca" };

const PODE = ["admin", "gestor", "operacional"];

type ContratoRow = {
  id: string;
  numero: string;
  obra: { codigo: string; nome: string } | null;
};

export default async function NovaVistoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ contrato?: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!PODE.includes(perfil?.papel ?? "")) redirect("/vistorias");

  const { contrato } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_locacao")
    .select("id, numero, obra:obra_id(codigo,nome)")
    .order("created_at", { ascending: false });

  const contratos = ((data ?? []) as unknown as ContratoRow[]).map((c) => ({
    id: c.id,
    numero: c.numero,
    obra: c.obra ? `${c.obra.codigo} — ${c.obra.nome}` : "—",
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Nova vistoria"
        descricao="Registre a vistoria; depois adicione fotos e avarias."
      />
      <Card>
        <CardContent className="pt-6">
          <VistoriaForm contratos={contratos} contratoIdInicial={contrato} />
        </CardContent>
      </Card>
    </div>
  );
}
