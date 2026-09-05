import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { listarPecasParaReparo } from "@/lib/data/reparos";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReparoForm } from "../reparo-form";

export const metadata = { title: "Abrir ordem de reparo — Loca" };

/**
 * Abertura de uma ordem.
 *
 * `avaria` no query string pre-vincula a ordem ao dano que a originou — e o
 * caminho de chegada mais comum é o botão "Abrir reparo" do laudo.
 */
export default async function NovaOrdemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect("/frota/reparos");

  const sp = await searchParams;
  const [pecas] = await Promise.all([listarPecasParaReparo()]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Abrir ordem de reparo"
        descricao="A ordem autoriza a peça a sair da obra. Ela nasce numerada — não há rascunho, porque um rascunho de autorização não autoriza nada."
        acoes={
          <Button variant="outline" render={<Link href="/frota/reparos" />}>
            <ArrowLeft className="size-4" aria-hidden />
            Ordens
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <ReparoForm
            reparo={{
              unidade_id: sp.peca ?? "",
              avaria_id: sp.avaria ?? null,
              status: "aberto",
              descricao: "",
              executor: null,
              aberto_em: hojeISOSaoPaulo(),
              enviado_em: null,
              previsto_para: null,
              concluido_em: null,
              valor: 0,
              responsabilidade: "indefinida",
              garantia_dias: null,
              observacoes: null,
            }}
            pecas={pecas}
            podeEditar
          />
        </CardContent>
      </Card>
    </div>
  );
}
