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
import { CalendarPlus, Download, ListChecks, Settings2 } from "lucide-react";
import {
  listarChecklists,
  listarTarefasLimpeza,
} from "@/lib/data/alojamento";
import { assinarUrls } from "@/lib/data/storage";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { segundaFeiraDaSemana, rotuloSemana } from "@/lib/alojamento";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LimpezaSemana } from "../../limpeza-semana";
import { abrirChecklistSemana } from "../../actions";
import { semearTarefasLimpeza } from "../../../configuracoes/limpeza-actions";

export async function ImovelLimpeza({
  imovelId,
  orgId,
  podeEditar,
}: {
  imovelId: string;
  /** Primeira pasta do caminho no Storage — a policy do bucket a exige. */
  orgId: string;
  podeEditar: boolean;
}) {
  const [tarefas, checklists] = await Promise.all([
    listarTarefasLimpeza(),
    listarChecklists(imovelId),
  ]);

  // "Hoje" é sempre o de Brasília: o Vercel roda em UTC e das 21h à meia-noite
  // a semana viraria antes da hora.
  const assinadas = await assinarUrls(
    "imoveis",
    checklists.map((c) => c.documento_path),
  );

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
            separada.{" "}
            <Link
              href="/configuracoes/limpeza"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Editar o catálogo
            </Link>
            .
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
          {tarefas.length > 0 && podeEditar ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href="/configuracoes/limpeza" />}
            >
              <Settings2 className="size-3.5" aria-hidden />
              Catálogo de tarefas
            </Button>
          ) : null}
        </div>

        {checklists.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma semana registrada neste alojamento.
          </p>
        ) : (
          <div className="divide-y">
            {checklists.map((c) => (
              <LimpezaSemana
                key={c.id}
                checklist={c}
                imovelId={imovelId}
                orgId={orgId}
                url={
                  c.documento_path ? (assinadas.get(c.documento_path) ?? null) : null
                }
                corrente={c.semana_inicio === semanaAtual}
                podeEditar={podeEditar}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
