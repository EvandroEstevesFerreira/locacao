import { redirect } from "next/navigation";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ServicoForm } from "../servico-form";

export const metadata = { title: "Novo serviço — Loca" };

export default async function NovoServicoPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/servicos");

  const supabase = await createClient();
  const { data: fornecedores } = await supabase
    .from("fornecedor")
    .select("id, nome")
    // `ativo`, e NUNCA `deleted_at`: a tabela `fornecedor` não tem essa coluna,
    // e o PostgREST recusa a consulta INTEIRA quando ela cita coluna
    // inexistente — `data` volta nulo, o `?? []` vira lista vazia, e o select
    // de fornecedor apareceria sem opção nenhuma, sem erro na tela nem no log.
    .eq("ativo", true)
    .order("nome");

  return (
    <div className="pagina-form space-y-6">
      <PageHeader
        titulo="Novo serviço"
        descricao="Assinatura, licença ou serviço recorrente de TI. O custo é rateado entre os centros de custo de quem usa."
      />
      <Card>
        <CardContent className="pt-6">
          <ServicoForm
            fornecedores={(fornecedores ?? []) as unknown as { id: string; nome: string }[]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
