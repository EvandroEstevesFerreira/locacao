import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { configPeople, buscarPessoas } from "@/lib/people/cliente";
import type { PessoaPeople } from "@/lib/people/contrato";
import { conciliar, inequivocas, resumo } from "@/lib/people/conciliacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConciliarLista } from "./conciliar-lista";

export const metadata = { title: "Conciliar com o People — Loca" };

/**
 * A conciliação das linhas escritas à mão com a base do People.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * PRECISA ACONTECER ANTES DE LIGAR A SINCRONIZAÇÃO. As linhas de hoje têm
 * `people_id` nulo, e o upsert casa por `people_id`: sincronizar antes criaria
 * uma linha nova para cada pessoa que já está cadastrada, e as duas
 * apareceriam lado a lado na hora de emitir um termo.
 *
 * As pessoas são lidas AO VIVO, sem tabela de apoio. São 483 em cinco páginas,
 * e esta tela é usada um punhado de vezes na vida do sistema — uma tabela de
 * staging seria estrutura permanente para um trabalho que acaba.
 */
export default async function ConciliarPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeEditarCadastros(perfil.papel)) redirect("/termos/funcionarios");

  const cfg = configPeople();
  if (!cfg) {
    return (
      <div className="space-y-6">
        <PageHeader
          titulo="Conciliar com o Sistenge People"
          descricao="Ligar cada funcionário do Loca à pessoa correspondente no People"
          acoes={
            <Button variant="outline" render={<Link href="/termos/funcionarios" />}>
              <ArrowLeft className="size-4" aria-hidden />
              Funcionários
            </Button>
          }
        />
        <EmptyState
          titulo="Integração não configurada"
          descricao="As variáveis PEOPLE_API_URL e PEOPLE_API_TOKEN precisam estar no ambiente para esta tela ler a base de pessoas."
        />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: locais } = await supabase
    .from("funcionario")
    .select("id, nome")
    .eq("ativo", true)
    .is("people_id", null)
    .order("nome");

  const aConciliar = (locais ?? []) as { id: string; nome: string }[];

  let pessoas: PessoaPeople[] = [];
  let erroPeople: string | null = null;
  try {
    pessoas = (await buscarPessoas(cfg, null)).pessoas;
  } catch (e) {
    pessoas = [];
    erroPeople = e instanceof Error ? e.message : "Não consegui ler o People.";
  }

  const sugestoes = conciliar(aConciliar, pessoas);
  const contas = resumo(sugestoes);
  const automaticos = new Set(inequivocas(sugestoes).map((s) => s.funcionarioId));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Conciliar com o Sistenge People"
        descricao="Ligar cada funcionário do Loca à pessoa correspondente no People"
        acoes={
          <Button variant="outline" render={<Link href="/termos/funcionarios" />}>
            <ArrowLeft className="size-4" aria-hidden />
            Funcionários
          </Button>
        }
      />

      {erroPeople ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">Não consegui ler a base do People.</p>
            <p className="mt-1 text-muted-foreground">{erroPeople}</p>
          </CardContent>
        </Card>
      ) : aConciliar.length === 0 ? (
        <EmptyState
          titulo="Nada a conciliar"
          descricao="Todos os funcionários ativos já estão ligados a uma pessoa do People. A sincronização pode ser ligada com segurança."
        />
      ) : (
        <ConciliarLista
          sugestoes={sugestoes}
          automaticos={[...automaticos]}
          contas={contas}
          totalPeople={pessoas.length}
        />
      )}
    </div>
  );
}
