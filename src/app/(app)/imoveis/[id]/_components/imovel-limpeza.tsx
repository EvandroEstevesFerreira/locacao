// Rotina semanal de limpeza do alojamento (FRM-RH-005).
//
// A folha é impressa, marcada à mão pelo auxiliar e conferida pelo Encarregado.
// O que o sistema guarda é o CONTROLE — que semanas foram abertas, quem foi o
// auxiliar e como o Encarregado avaliou — não a marcação diária, que continua
// no papel afixado no alojamento.
//
// O corte por frequência é o que faz a folha caber: a semanal leva as tarefas
// diárias e semanais, e as mensais saem numa folha própria.

import Link from "next/link";
import { CalendarPlus, Download, ListChecks } from "lucide-react";
import {
  listarChecklists,
  listarTarefasLimpeza,
} from "@/lib/data/alojamento";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { segundaFeiraDaSemana, rotuloSemana } from "@/lib/alojamento";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import {
  abrirChecklistSemana,
  excluirChecklistLimpeza,
  semearTarefasLimpeza,
} from "../../actions";

const AVALIACAO_INFO: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  conforme: { label: "Conforme", variant: "outline" },
  parcial: { label: "Parcialmente conforme", variant: "secondary" },
  nao_conforme: { label: "Não conforme", variant: "destructive" },
};

export async function ImovelLimpeza({
  imovelId,
  podeEditar,
}: {
  imovelId: string;
  podeEditar: boolean;
}) {
  const [tarefas, checklists] = await Promise.all([
    listarTarefasLimpeza(),
    listarChecklists(imovelId),
  ]);

  // "Hoje" é sempre o de Brasília: o Vercel roda em UTC e das 21h à meia-noite
  // a semana viraria antes da hora.
  const semanaAtual = segundaFeiraDaSemana(hojeISOSaoPaulo());
  const jaAberta = checklists.some((c) => c.semana_inicio === semanaAtual);

  const diarias = tarefas.filter((t) => t.frequencia === "D").length;
  const semanais = tarefas.filter((t) => t.frequencia === "S").length;
  const mensais = tarefas.filter((t) => t.frequencia === "M").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Limpeza do alojamento</CardTitle>
        <CardDescription>
          Checklist semanal (FRM-RH-005). A folha é impressa e marcada à mão; aqui
          fica o controle das semanas e a avaliação do Encarregado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {tarefas.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm">
            <p className="font-medium">Catálogo de tarefas ainda não criado</p>
            <p className="mt-1 text-muted-foreground">
              São 44 tarefas divididas por ambiente e frequência. O sistema pode
              criá-las de uma vez, a partir do padrão do FRM-RH-005 — depois elas
              ficam editáveis.
            </p>
            {podeEditar ? (
              <form action={semearTarefasLimpeza} className="mt-3">
                <input type="hidden" name="imovel_id" value={imovelId} />
                <Button type="submit" variant="outline" size="sm">
                  <ListChecks className="size-3.5" aria-hidden />
                  Criar catálogo padrão
                </Button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Catálogo com <strong>{tarefas.length}</strong> tarefas —{" "}
            {diarias} diárias, {semanais} semanais e {mensais} mensais. A folha
            semanal imprime {diarias + semanais}; as mensais saem em folha
            separada.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/api/documentos/checklist_limpeza/pdf?semana=${semanaAtual}`}
                target="_blank"
              />
            }
          >
            <Download className="size-3.5" aria-hidden />
            Folha da semana ({rotuloSemana(semanaAtual)})
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href="/api/documentos/checklist_limpeza/pdf?variante=mensal"
                target="_blank"
              />
            }
          >
            <Download className="size-3.5" aria-hidden />
            Folha mensal
          </Button>
          {podeEditar && !jaAberta ? (
            <form action={abrirChecklistSemana}>
              <input type="hidden" name="imovel_id" value={imovelId} />
              <Button type="submit" size="sm">
                <CalendarPlus className="size-3.5" aria-hidden />
                Abrir semana
              </Button>
            </form>
          ) : null}
        </div>

        {checklists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma semana registrada neste alojamento.
          </p>
        ) : (
          <div className="divide-y">
            {checklists.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    Semana de {rotuloSemana(c.semana_inicio)}
                    {c.semana_inicio === semanaAtual ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (semana corrente)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.auxiliar_nome ?? "Auxiliar não informado"}
                    {c.observacoes ? ` · ${c.observacoes}` : ""}
                  </p>
                </div>
                {c.avaliacao ? (
                  <Badge variant={AVALIACAO_INFO[c.avaliacao]?.variant}>
                    {AVALIACAO_INFO[c.avaliacao]?.label ?? c.avaliacao}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Sem avaliação</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href={`/api/documentos/checklist_limpeza/pdf?semana=${c.semana_inicio}`}
                      target="_blank"
                    />
                  }
                >
                  <Download className="size-3.5" aria-hidden />
                  Folha
                </Button>
                {podeEditar ? (
                  <ConfirmDelete
                    action={excluirChecklistLimpeza}
                    id={c.id}
                    hidden={{ imovel_id: imovelId }}
                  />
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
