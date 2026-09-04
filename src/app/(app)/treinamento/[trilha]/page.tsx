import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDot } from "lucide-react";

import { getCurrentPerfil } from "@/lib/auth";
import { conclusoesDoUsuario, obterConclusao } from "@/lib/data/treinamento";
import {
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  trilhasDoUsuario,
} from "@/lib/treinamento";
import { trilhaPorChave } from "@/lib/treinamento/index";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AulaLida } from "./_components/aula-lida";
import { Questionario } from "./_components/questionario";
import { ComprovanteAssinatura } from "./_components/comprovante-assinatura";

export const metadata = { title: "Trilha de treinamento — Loca" };

export default async function TrilhaPage({
  params,
}: {
  params: Promise<{ trilha: string }>;
}) {
  const { trilha: chave } = await params;
  const trilha = trilhaPorChave(chave);
  if (!trilha) notFound();

  const perfil = await getCurrentPerfil();

  // A trilha é visível só a quem tem direito a ela: uma trilha de módulo
  // bloqueado ensinaria uma tela que a pessoa não pode abrir.
  const minhas = trilhasDoUsuario(
    perfil?.papel,
    perfil?.modulos,
    perfil?.papel === "master",
  );
  if (!minhas.some((t) => t.chave === trilha.chave)) notFound();

  const conclusoes = perfil?.id ? await conclusoesDoUsuario(perfil.id) : [];
  const situacao = situacaoDaTrilha(trilha, conclusoes);
  const v = versaoConcluida(trilha, conclusoes);
  const mudaram = new Set(aulasQueMudaram(trilha, v).map((a) => a.id));
  const concluida = situacao === "concluida";

  const desta = concluida && perfil?.id
    ? await obterConclusao(perfil.id, trilha.chave, trilha.versao)
    : null;

  const aulaTitulo = Object.fromEntries(trilha.aulas.map((a) => [a.id, a.titulo]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        titulo={trilha.titulo}
        descricao={trilha.resumo}
        acoes={
          <Button variant="outline" render={<Link href="/treinamento" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      {situacao === "desatualizada" ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Você concluiu a versão {v} desta trilha. Desde então{" "}
          {mudaram.size === 1 ? "uma aula mudou" : `${mudaram.size} aulas mudaram`}
          {" "}— elas estão marcadas abaixo. Releia só o que mudou e refaça o
          questionário, que é curto.
        </div>
      ) : null}

      {trilha.aulas.map((a, i) => (
        <Card key={a.id} id={`aula-${a.id}`} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              {a.titulo}
              {situacao === "desatualizada" && mudaram.has(a.id) ? (
                <Badge variant="default">Mudou</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{a.resumo}</p>

            <ol className="space-y-3">
              {a.passos.map((p, j) => (
                <li key={j} className="border-l-2 border-border pl-3">
                  <p className="font-mono text-xs text-muted-foreground">{p.onde}</p>
                  <p className="text-sm font-medium">{p.acao}</p>
                  <p className="mt-1 flex gap-1.5 text-sm text-muted-foreground">
                    <CircleDot className="mt-0.5 size-3.5 shrink-0" />
                    {p.esperado}
                  </p>
                </li>
              ))}
            </ol>

            {a.atencao?.length ? (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Atenção
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {a.atencao.map((t, k) => (
                    <li key={k}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <AulaLida trilhaChave={trilha.chave} aulaId={a.id} />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>
            {concluida ? "Questionário — você já passou" : "Questionário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {concluida ? (
            <p className="text-sm text-muted-foreground">
              Você concluiu esta versão da trilha. Pode refazer o questionário
              quando quiser — o comprovante continua o mesmo.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              São {trilha.perguntas.length} perguntas, e é preciso acertar todas.
              Errar não tem custo: o sistema mostra por que a resposta é aquela,
              aponta a aula, e você tenta de novo.
            </p>
          )}

          {/* `correta` e `porque` NÃO descem para o cliente. É o que impede o
              gabarito de sair no HTML. O `porque` volta do servidor só para as
              perguntas que a pessoa errou. */}
          <Questionario
            trilhaChave={trilha.chave}
            perguntas={trilha.perguntas.map((p) => ({
              id: p.id,
              enunciado: p.enunciado,
              alternativas: p.alternativas,
              aula: p.aula,
            }))}
            aulaTitulo={aulaTitulo}
          />
        </CardContent>
      </Card>

      {concluida ? (
        <Card>
          <CardHeader>
            <CardTitle>Comprovante</CardTitle>
          </CardHeader>
          <CardContent>
            <ComprovanteAssinatura
              trilhaChave={trilha.chave}
              jaAssinado={Boolean(desta?.assinatura)}
              numeroRegistro={desta?.numeroRegistro ?? null}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
