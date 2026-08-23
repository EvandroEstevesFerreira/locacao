"use client";

// Uma semana da rotina de limpeza, com o painel de fechamento.
//
// A linha inteira é cliente porque o painel abre e fecha — e, uma vez cliente,
// o `ConfirmDelete` e o link da folha vêm junto sem custo. Server action
// importada direto de "./actions": módulo "use server" pode ser importado por
// componente cliente; o proibido é o contrário.
//
// O FECHAMENTO É O QUE FALTAVA NA FASE 4. `auxiliar_nome`, `avaliacao` e
// `observacoes` existem em `checklist_limpeza` desde a migration 0045 e eram
// lidos pela tela, mas nada os escrevia: toda semana aparecia como "Sem
// avaliação" para sempre. Abrir a semana registrava que a folha foi impressa;
// faltava registrar o que a conferência da sexta encontrou.

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Download, X } from "lucide-react";
import { AVALIACOES, AVALIACAO_INFO, rotuloSemana } from "@/lib/alojamento";
import { salvarFechamentoLimpeza, excluirChecklistLimpeza } from "./actions";
import { DocumentoAssinado } from "./documento-assinado";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type SemanaChecklist = {
  id: string;
  semana_inicio: string;
  auxiliar_nome: string | null;
  avaliacao: string | null;
  observacoes: string | null;
  documento_path: string | null;
};

export function LimpezaSemana({
  checklist,
  imovelId,
  orgId,
  url,
  corrente,
  podeEditar,
}: {
  checklist: SemanaChecklist;
  imovelId: string;
  /** Primeira pasta do caminho no Storage — a policy do bucket a exige. */
  orgId: string;
  /** URL assinada da folha digitalizada, quando já existe. */
  url: string | null;
  corrente: boolean;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // Chamada direta dentro de um `useTransition`, e não `useActionState`: aqui
  // o resultado chega ao mesmo escopo que fecha o painel. Com `useActionState`
  // seria preciso um `useEffect` para reagir ao estado, e chamar `setState`
  // dentro de efeito é erro de lint neste projeto (react-hooks).
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarFechamentoLimpeza(dados);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      setAberto(false);
      router.refresh();
    });
  }

  const info = checklist.avaliacao
    ? AVALIACAO_INFO[checklist.avaliacao as keyof typeof AVALIACAO_INFO]
    : null;
  const avaliada = Boolean(checklist.avaliacao);

  return (
    <div className="py-2 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            Semana de {rotuloSemana(checklist.semana_inicio)}
            {corrente ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                (semana corrente)
              </span>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {checklist.auxiliar_nome ?? "Auxiliar não informado"}
            {checklist.observacoes ? ` · ${checklist.observacoes}` : ""}
          </p>
        </div>

        {info ? (
          <Badge variant={info.variant}>{info.label}</Badge>
        ) : (
          <Badge variant="secondary">Sem avaliação</Badge>
        )}

        {podeEditar ? (
          <Button
            variant={aberto ? "secondary" : "outline"}
            size="sm"
            onClick={() => setAberto((v) => !v)}
          >
            {aberto ? (
              <X className="size-3.5" aria-hidden />
            ) : (
              <ClipboardCheck className="size-3.5" aria-hidden />
            )}
            {aberto ? "Cancelar" : avaliada ? "Editar avaliação" : "Avaliar semana"}
          </Button>
        ) : null}

        <Button
          variant="outline"
          size="sm"
          render={
            <Link
              href={`/api/documentos/checklist_limpeza/pdf?semana=${checklist.semana_inicio}`}
              target="_blank"
            />
          }
        >
          <Download className="size-3.5" aria-hidden />
          Folha
        </Button>

        <DocumentoAssinado
          entidade="checklist_limpeza"
          registroId={checklist.id}
          imovelId={imovelId}
          orgId={orgId}
          url={url}
          podeEditar={podeEditar}
        />

        {podeEditar ? (
          <ConfirmDelete
            action={excluirChecklistLimpeza}
            id={checklist.id}
            hidden={{ imovel_id: imovelId }}
          />
        ) : null}
      </div>

      {aberto ? (
        <form
          onSubmit={enviar}
          className="mt-3 grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2"
        >
          <input type="hidden" name="id" value={checklist.id} />
          <input type="hidden" name="imovel_id" value={imovelId} />

          <div className="space-y-1.5">
            <Label htmlFor={`aux-${checklist.id}`}>Auxiliar de limpeza</Label>
            <Input
              id={`aux-${checklist.id}`}
              name="auxiliar_nome"
              maxLength={120}
              defaultValue={checklist.auxiliar_nome ?? ""}
              placeholder="Quem executou a limpeza nesta semana"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`av-${checklist.id}`}>Avaliação do Encarregado</Label>
            <NativeSelect
              id={`av-${checklist.id}`}
              name="avaliacao"
              defaultValue={checklist.avaliacao ?? ""}
            >
              <option value="">Ainda não avaliada</option>
              {AVALIACOES.map((a) => (
                <option key={a} value={a}>
                  {AVALIACAO_INFO[a].label}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`obs-${checklist.id}`}>Observações da conferência</Label>
            <Textarea
              id={`obs-${checklist.id}`}
              name="observacoes"
              rows={3}
              maxLength={2000}
              defaultValue={checklist.observacoes ?? ""}
              placeholder="Pendências encontradas, itens em falta, orientações dadas."
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pendente}>
              {pendente ? "Salvando…" : "Salvar avaliação"}
            </Button>
            {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
