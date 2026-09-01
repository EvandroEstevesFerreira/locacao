import { notFound, redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { contextoRateio } from "@/lib/data/custo-item";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RateioForm } from "./rateio-form";

export const metadata = { title: "Ratear lançamento — Loca" };

export default async function RateioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const { id } = await params;
  const ctx = await contextoRateio(id);
  if (!ctx) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Ratear por item"
        descricao={`${ctx.descricao} · atribua o custo às linhas do contrato`}
        acoes={
          <Button variant="outline" render={<Link href="/financeiro" />}>
            Voltar
          </Button>
        }
      />

      {ctx.contratoId === null ? (
        // Sem contrato não há linhas para receber o custo. Dizer isso, e onde
        // resolver, é melhor que uma tela vazia.
        <EmptyState
          titulo="Lançamento sem contrato vinculado"
          descricao="O rateio distribui o custo entre as linhas de um contrato de locação. Vincule o lançamento a um contrato para poder detalhá-lo por item."
          acao={{ label: "Editar lançamento", href: `/financeiro/${id}` }}
        />
      ) : ctx.itens.length === 0 ? (
        <EmptyState
          titulo="O contrato não tem itens"
          descricao="Cadastre os itens locados do contrato para poder atribuir custo a eles."
          acao={{ label: "Abrir contrato", href: `/contratos/${ctx.contratoId}` }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <RateioForm
              lancamentoId={ctx.lancamentoId}
              valorLancamento={ctx.valor}
              itens={ctx.itens}
              parcelas={ctx.parcelas}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
