import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { FornecedorForm } from "../fornecedor-form";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { formatarTelefone } from "@/lib/telefone";
import { obrasComContratoDoFornecedor } from "@/lib/data/fornecedores";

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
  const [
    { data: fornecedor },
    obras,
    { data: vinculos },
    { data: contatos },
    obrasComContrato,
  ] = await Promise.all([
      supabase
        .from("fornecedor")
        .select(
          "id, nome, cnpj, codigo_mega, contato_email, observacoes, ativo",
        )
        .eq("id", id)
        .single(),
      listarObrasParaFiltro(),
      supabase.from("fornecedor_obra").select("obra_id").eq("fornecedor_id", id),
      // Os contatos em consulta própria, e não como embed do fornecedor: o
      // `.single()` acima devolveria a lista aninhada e o formulário teria de
      // desembrulhar `T | T[] | null` do PostgREST, que é o que a camada de
      // leitura existe para não expor. `principal` primeiro, para o formulário
      // abrir com ele no topo.
      supabase
        .from("fornecedor_contato")
        .select("id, nome, cargo, telefone, principal")
        .eq("fornecedor_id", id)
        .order("principal", { ascending: false })
        .order("created_at"),
      obrasComContratoDoFornecedor(id),
    ]);

  if (!fornecedor) notFound();

  return (
    <div className="pagina-form space-y-6">
      {/* O NOME no título e a ação embaixo. Quem abre esta tela já sabe que
          veio editar; o que ele precisa confirmar é DE QUEM é o cadastro —
          especialmente com razões sociais parecidas na lista. */}
      <PageHeader titulo={fornecedor.nome} descricao="Editar fornecedor" />
      <Card>
        <CardContent className="pt-6">
          <FornecedorForm
            fornecedor={fornecedor}
            contatos={(contatos ?? []).map((c) => ({
              id: c.id as string,
              nome: c.nome as string,
              cargo: (c.cargo as string | null) ?? "",
              // FORMATADO na carga: o banco guarda "5511980765016" e o campo
              // abriria com os dígitos crus. Formatar só no `onBlur` deixaria a
              // primeira impressão errada em todo cadastro já existente.
              telefone: formatarTelefone(c.telefone as string | null) ?? "",
              principal: c.principal as boolean,
            }))}
            obras={obras}
            obrasDoFornecedor={(vinculos ?? []).map((v) => v.obra_id)}
            obrasComContrato={obrasComContrato}
          />
        </CardContent>
      </Card>
    </div>
  );
}
