import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";

import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { conclusoesDoUsuario } from "@/lib/data/treinamento";
import {
  trilhasDoUsuario,
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  SITUACAO_TRILHA_INFO,
} from "@/lib/treinamento";
import { formatarDataHora } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Treinamento — Loca" };

/**
 * As minhas trilhas.
 *
 * Não é módulo liberável: fica disponível a todo usuário autenticado, como
 * Perfil e Novidades. Trancar a porta do treinamento e esconder a chave seria
 * o contrário do que ele existe para fazer.
 */
export default async function TreinamentoPage() {
  const perfil = await getCurrentPerfil();
  const conclusoes = perfil?.id ? await conclusoesDoUsuario(perfil.id) : [];

  const trilhas = trilhasDoUsuario(
    perfil?.papel,
    perfil?.modulos,
    perfil?.papel === "master",
  );
  const pendentes = trilhas.filter(
    (t) => situacaoDaTrilha(t, conclusoes) !== "concluida",
  ).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Treinamento"
        descricao={
          pendentes === 0
            ? "Você está em dia com o treinamento."
            : `${pendentes} ${pendentes === 1 ? "trilha pendente" : "trilhas pendentes"}`
        }
        acoes={
          podeEditarCadastros(perfil?.papel) ? (
            <Button variant="outline" render={<Link href="/treinamento/pendentes" />}>
              <Users className="size-4" />
              Quem treinou
            </Button>
          ) : null
        }
      />

      {trilhas.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          titulo="Nenhuma trilha disponível"
          descricao="As trilhas aparecem conforme os módulos liberados para você. Se você acha que falta alguma, fale com quem administra o sistema."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {trilhas.map((t) => {
            const situacao = situacaoDaTrilha(t, conclusoes);
            const info = SITUACAO_TRILHA_INFO[situacao];
            const v = versaoConcluida(t, conclusoes);
            const mudaram = aulasQueMudaram(t, v);
            const minha = conclusoes.find((c) => c.trilha === t.chave && c.versao === v);

            return (
              <Card key={t.chave}>
                <CardContent className="flex flex-wrap items-start gap-3 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t.titulo}
                      <Badge variant={info.variant}>{info.label}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.resumo}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.aulas.length}{" "}
                      {t.aulas.length === 1 ? "aula" : "aulas"} ·{" "}
                      {t.perguntas.length} perguntas no fim
                      {situacao === "desatualizada"
                        ? ` · ${mudaram.length} ${mudaram.length === 1 ? "aula mudou" : "aulas mudaram"} desde a sua conclusão`
                        : ""}
                      {situacao === "concluida" && minha
                        ? ` · concluída em ${formatarDataHora(minha.concluidoEm)}`
                        : ""}
                    </p>
                  </div>
                  <Button render={<Link href={`/treinamento/${t.chave}`} />}>
                    {situacao === "nao_iniciada"
                      ? "Começar"
                      : situacao === "desatualizada"
                        ? "Ver o que mudou"
                        : "Revisar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
