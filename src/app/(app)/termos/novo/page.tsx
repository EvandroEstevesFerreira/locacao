import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TermoWizard } from "../termo-wizard";

export const metadata = { title: "Novo termo — Loca" };

export default async function NovoTermoPage() {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/termos");

  const supabase = await createClient();

  const [{ data: funcionarios }, { data: itens }, { data: pecas }, obras, { data: org }] =
    await Promise.all([
      supabase
        .from("funcionario")
        .select("id, nome, cpf")
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("item_catalogo")
        .select("id, descricao, unidade, controle")
        .eq("ativo", true)
        .is("deleted_at", null)
        .order("descricao"),
      // Só peça DISPONÍVEL entra na lista: oferecer uma que já está com outra
      // pessoa produziria dois termos assinados sobre o mesmo patrimônio.
      supabase
        .from("equipamento_unidade")
        .select("id, identificador, item_id")
        .eq("situacao", "disponivel")
        .order("identificador"),
      listarObrasParaFiltro(),
      supabase
        .from("organizacao")
        .select("nome")
        .eq("id", perfil!.org_id)
        .maybeSingle(),
    ]);

  const listaFuncionarios = (funcionarios ?? []) as unknown as {
    id: string;
    nome: string;
    cpf: string | null;
  }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Novo termo de responsabilidade"
        descricao="Quem recebe, o que sai, em que estado e com assinatura"
        acoes={
          <Button variant="outline" render={<Link href="/termos" />}>
            Cancelar
          </Button>
        }
      />

      {listaFuncionarios.length === 0 ? (
        // Sem funcionário não há quem assine, e o passo a passo travaria no
        // primeiro campo. Dizer o que falta é melhor que uma lista vazia.
        <EmptyState
          titulo="Nenhum funcionário cadastrado"
          descricao="O termo é assinado por um funcionário. Cadastre quem recebe equipamento antes de emitir o primeiro termo."
          acao={{ label: "Cadastrar funcionários", href: "/termos/funcionarios" }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <TermoWizard
              funcionarios={listaFuncionarios}
              itens={
                ((itens ?? []) as unknown as {
                  id: string;
                  descricao: string;
                  unidade: string | null;
                  controle: "peca" | "quantidade";
                }[])
              }
              pecas={
                ((pecas ?? []) as unknown as {
                  id: string;
                  identificador: string;
                  item_id: string;
                }[]).map((p) => ({
                  id: p.id,
                  identificador: p.identificador,
                  itemId: p.item_id,
                }))
              }
              obras={obras}
              nomeEmpresa={(org as { nome: string } | null)?.nome ?? "Sistenge"}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
