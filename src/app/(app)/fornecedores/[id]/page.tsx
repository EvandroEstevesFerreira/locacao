import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FornecedorForm } from "../fornecedor-form";

export const metadata = { title: "Editar fornecedor — Loca" };

export default async function EditarFornecedorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/fornecedores");

  const { id } = await params;
  const supabase = await createClient();
  const { data: fornecedor } = await supabase
    .from("fornecedor")
    .select(
      "id, nome, cnpj, contato_nome, contato_telefone, contato_email, observacoes, ativo",
    )
    .eq("id", id)
    .single();

  if (!fornecedor) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar fornecedor" descricao={fornecedor.nome} />
      <Card>
        <CardContent className="pt-6">
          <FornecedorForm fornecedor={fornecedor} />
        </CardContent>
      </Card>
    </div>
  );
}
