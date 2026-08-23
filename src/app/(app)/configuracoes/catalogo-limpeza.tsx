"use client";

// Catálogo de tarefas de limpeza — a tabela editável por trás do FRM-RH-005.
//
// Um único componente cliente para a tabela inteira, e não uma ilha por linha:
// são 44 tarefas, e 44 ilhas com estado próprio seria muito JavaScript para
// resolver uma coisa só — qual linha está em edição. `editando` guarda um id;
// as outras 43 linhas continuam sendo marcação estática.
//
// A ordem é a do percurso pelo alojamento, não a alfabética. É por isso que ela
// é editável e aparece na primeira coluna: quem muda a rotina precisa mexer
// nela, e escondê-la faria a folha impressa sair fora de sequência sem
// explicação visível.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Eye, EyeOff, X } from "lucide-react";
import { FREQUENCIAS, FREQUENCIA_INFO, type Frequencia } from "@/lib/alojamento";
import type { TarefaCatalogo } from "@/lib/data/alojamento";
import {
  salvarTarefaLimpeza,
  alternarTarefaLimpeza,
  excluirTarefaLimpeza,
} from "./limpeza-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const VARIANTE: Record<Frequencia, "outline" | "secondary" | "default"> = {
  D: "outline",
  S: "secondary",
  M: "default",
};

export function CatalogoLimpeza({
  tarefas,
  podeEditar,
}: {
  tarefas: TarefaCatalogo[];
  podeEditar: boolean;
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);

  // Agrupa preservando a ordem da coluna `ordem` — que é a do percurso pelo
  // alojamento. Agrupar por chave num objeto devolveria os ambientes em ordem
  // alfabética e jogaria as áreas externas para o meio da folha.
  const grupos: { nome: string; itens: TarefaCatalogo[] }[] = [];
  for (const t of tarefas) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nome === t.grupo) ultimo.itens.push(t);
    else grupos.push({ nome: t.grupo, itens: [t] });
  }

  const nomes = grupos.map((g) => g.nome);
  const ativas = tarefas.filter((t) => t.ativo).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {tarefas.length} tarefas no catálogo, {ativas} ativas. Só as ativas vão
          para a folha impressa.
        </p>
        {podeEditar ? (
          <Button
            variant={criando ? "secondary" : "outline"}
            size="sm"
            onClick={() => {
              setCriando((v) => !v);
              setEditando(null);
            }}
          >
            {criando ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
            {criando ? "Cancelar" : "Nova tarefa"}
          </Button>
        ) : null}
      </div>

      {criando ? (
        <div className="rounded-lg border border-dashed p-3">
          <TarefaForm nomes={nomes} aoConcluir={() => setCriando(false)} />
        </div>
      ) : null}

      {grupos.map((g) => (
        <div key={g.nome} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {g.nome}
          </h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Ordem</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead className="w-32">Frequência</TableHead>
                  <TableHead className="w-36 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.itens.map((t) =>
                  editando === t.id ? (
                    <TableRow key={t.id}>
                      <TableCell colSpan={4}>
                        <TarefaForm
                          tarefa={t}
                          nomes={nomes}
                          aoConcluir={() => setEditando(null)}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow
                      key={t.id}
                      className={t.ativo ? undefined : "opacity-55"}
                    >
                      <TableCell className="tabular-nums text-muted-foreground">
                        {t.ordem}
                      </TableCell>
                      <TableCell>
                        {t.descricao}
                        {t.ativo ? null : (
                          <span className="ml-2 text-xs text-muted-foreground">
                            (fora da folha)
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={VARIANTE[t.frequencia]}>
                          {FREQUENCIA_INFO[t.frequencia].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {podeEditar ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCriando(false);
                                setEditando(t.id);
                              }}
                              aria-label={`Editar: ${t.descricao}`}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <form action={alternarTarefaLimpeza}>
                              <input type="hidden" name="id" value={t.id} />
                              <input
                                type="hidden"
                                name="ativo"
                                value={t.ativo ? "false" : "true"}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="sm"
                                aria-label={
                                  t.ativo
                                    ? `Tirar da folha: ${t.descricao}`
                                    : `Devolver à folha: ${t.descricao}`
                                }
                              >
                                {t.ativo ? (
                                  <Eye className="size-3.5" />
                                ) : (
                                  <EyeOff className="size-3.5" />
                                )}
                              </Button>
                            </form>
                            <ConfirmDelete
                              action={excluirTarefaLimpeza}
                              id={t.id}
                              mensagem="Excluir esta tarefa do catálogo? Para apenas tirá-la da folha impressa, use o botão de ocultar — assim as semanas já marcadas continuam fazendo sentido."
                            />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ),
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Formulário de criar/editar. Sem `tarefa`, cria. */
function TarefaForm({
  tarefa,
  nomes,
  aoConcluir,
}: {
  tarefa?: TarefaCatalogo;
  /** Ambientes já usados, para o autocompletar do campo. */
  nomes: string[];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  // Chamada direta dentro de um `useTransition`: o resultado chega ao mesmo
  // escopo que devolve a linha ao modo de leitura. Com `useActionState` seria
  // preciso um `useEffect` reagindo ao estado, e chamar `setState` dentro de
  // efeito é erro de lint neste projeto (react-hooks).
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarTarefaLimpeza(dados);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      aoConcluir();
      router.refresh();
    });
  }

  const id = tarefa?.id ?? "nova";

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto_5rem]">
      {tarefa ? <input type="hidden" name="id" value={tarefa.id} /> : null}

      <div className="space-y-1.5">
        <Label htmlFor={`grupo-${id}`}>Ambiente</Label>
        <Input
          id={`grupo-${id}`}
          name="grupo"
          list="grupos-limpeza"
          required
          maxLength={80}
          defaultValue={tarefa?.grupo ?? ""}
          placeholder="BANHEIROS"
        />
        <datalist id="grupos-limpeza">
          {nomes.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`desc-${id}`}>Tarefa</Label>
        <Input
          id={`desc-${id}`}
          name="descricao"
          required
          maxLength={200}
          defaultValue={tarefa?.descricao ?? ""}
          placeholder="Lavar piso com desinfetante"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`freq-${id}`}>Frequência</Label>
        <NativeSelect
          id={`freq-${id}`}
          name="frequencia"
          defaultValue={tarefa?.frequencia ?? "D"}
        >
          {FREQUENCIAS.map((f) => (
            <option key={f} value={f}>
              {FREQUENCIA_INFO[f].label} — {FREQUENCIA_INFO[f].folha}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ord-${id}`}>Ordem</Label>
        <Input
          id={`ord-${id}`}
          name="ordem"
          type="number"
          min={0}
          max={9999}
          defaultValue={tarefa ? String(tarefa.ordem) : ""}
          placeholder="fim"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-4">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : tarefa ? "Salvar tarefa" : "Criar tarefa"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
          Cancelar
        </Button>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      </div>
    </form>
  );
}
