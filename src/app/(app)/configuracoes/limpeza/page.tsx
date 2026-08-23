// Catálogo de tarefas de limpeza (FRM-RH-005).
//
// Fica em Configurações porque a policy `tarefa_limpeza_write` da migration
// 0045 o trata como cadastro da organização: mudar uma tarefa muda a folha de
// TODOS os alojamentos. A tela do imóvel apenas aponta para cá.
//
// `podeConfigurarSistema` na porta e `podeEditarCadastros` nos botões: a RLS já
// exige `pode_gerir_cadastros()` para escrever, e esta é a mensagem amigável
// antes do erro de banco.

import { redirect } from "next/navigation";
import Link from "next/link";
import { ListChecks, Download } from "lucide-react";
import { getCurrentPerfil, podeConfigurarSistema, podeEditarCadastros } from "@/lib/auth";
import { listarCatalogoLimpeza } from "@/lib/data/alojamento";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { CatalogoLimpeza } from "../catalogo-limpeza";
import { semearTarefasLimpeza } from "../limpeza-actions";

export const metadata = { title: "Catálogo de limpeza — Loca" };

export default async function LimpezaPage() {
  const perfil = await getCurrentPerfil();
  if (!perfil || !podeConfigurarSistema(perfil.papel)) redirect("/");

  const tarefas = await listarCatalogoLimpeza();
  const podeEditar = podeEditarCadastros(perfil.papel);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Catálogo de limpeza"
        descricao="As tarefas que compõem a folha do FRM-RH-005, por ambiente e frequência. Diárias e semanais saem na folha da semana; as mensais, em folha própria."
      />

      {tarefas.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon={<ListChecks />}
            titulo="Catálogo ainda não criado"
            descricao="São 44 tarefas divididas por ambiente e frequência. O sistema cria todas de uma vez, a partir do padrão do FRM-RH-005 — depois elas ficam editáveis, uma a uma."
          />
          {podeEditar ? (
            <form action={semearTarefasLimpeza} className="flex justify-center">
              <Button type="submit" variant="outline" size="sm">
                <ListChecks className="size-3.5" aria-hidden />
                Criar catálogo padrão
              </Button>
            </form>
          ) : null}
        </div>
      ) : (
        <>
          <CatalogoLimpeza tarefas={tarefas} podeEditar={podeEditar} />

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm">
              <p className="text-muted-foreground">
                Confira o resultado antes de mandar imprimir: a folha em branco
                sai do catálogo ativo.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <Link
                      href="/api/documentos/checklist_limpeza/pdf"
                      target="_blank"
                    />
                  }
                >
                  <Download className="size-3.5" aria-hidden />
                  Folha semanal
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
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
