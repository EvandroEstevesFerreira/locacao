"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Link2, UserX, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { Sugestao } from "@/lib/people/conciliacao";
import { SITUACAO_PEOPLE_INFO } from "@/lib/people/contrato";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  vincularPessoa,
  desativarFuncionario,
  vincularInequivocos,
} from "../actions";

type Contas = {
  total: number;
  automaticas: number;
  manuais: number;
  ambiguas: number;
  semCandidato: number;
};

/**
 * A lista de conciliação.
 *
 * Os inequívocos ficam num bloco só, com UM botão — são a maioria e não merecem
 * 75 cliques. Os que precisam de decisão vêm um a um, com os candidatos ao
 * lado e o que os distingue à vista: situação, cargo e matrícula.
 */
export function ConciliarLista({
  sugestoes,
  automaticos,
  contas,
  totalPeople,
}: {
  sugestoes: Sugestao[];
  automaticos: string[];
  contas: Contas;
  totalPeople: number;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const auto = new Set(automaticos);
  const manuais = sugestoes.filter((s) => !auto.has(s.funcionarioId));

  function agir(fn: () => Promise<{ ok: boolean; erro?: string; aviso?: string }>) {
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.erro ?? "Não deu certo.");
        return;
      }
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Pronto.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
          <Numero rotulo="A conciliar" valor={contas.total} />
          <Numero rotulo="Inequívocos" valor={contas.automaticas} />
          <Numero rotulo="Ambíguos" valor={contas.ambiguas} />
          <Numero rotulo="Sem candidato" valor={contas.semCandidato} />
        </CardContent>
      </Card>

      {contas.automaticas > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {contas.automaticas} com um único candidato possível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              O nome do Loca cabe dentro de exatamente um dos {totalPeople} nomes
              do People, e nenhuma outra linha daqui aponta para a mesma pessoa.
            </p>
            <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {sugestoes
                .filter((s) => auto.has(s.funcionarioId))
                .map((s) => (
                  <li key={s.funcionarioId} className="flex flex-wrap gap-1">
                    <span className="text-muted-foreground">{s.nomeLoca}</span>
                    <span aria-hidden>→</span>
                    <span className="font-medium">{s.candidatos[0].nome}</span>
                  </li>
                ))}
            </ul>
            <Button
              type="button"
              disabled={pendente}
              onClick={() => agir(() => vincularInequivocos())}
            >
              {pendente ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wand2 className="size-4" />
              )}
              Vincular os {contas.automaticas} inequívocos
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {manuais.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {manuais.length} precisam da sua decisão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {manuais.map((s) => (
              <div key={s.funcionarioId} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.nomeLoca}</span>
                  {s.classificacao === "ambiguo" ? (
                    <Badge variant="outline">
                      {s.candidatos.length} candidatos
                    </Badge>
                  ) : s.classificacao === "sem_candidato" ? (
                    <Badge variant="outline">Sem candidato</Badge>
                  ) : (
                    <Badge variant="outline">Nome de uma palavra</Badge>
                  )}
                </div>

                {s.candidatos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <NativeSelect
                      aria-label={`Pessoa do People para ${s.nomeLoca}`}
                      value={escolhas[s.funcionarioId] ?? ""}
                      disabled={pendente}
                      onChange={(e) =>
                        setEscolhas((x) => ({
                          ...x,
                          [s.funcionarioId]: e.target.value,
                        }))
                      }
                    >
                      <option value="">Escolha a pessoa…</option>
                      {s.candidatos.map((c) => (
                        <option key={c.peopleId} value={c.peopleId}>
                          {c.nome}
                          {" · "}
                          {SITUACAO_PEOPLE_INFO[c.situacao].label}
                          {c.cargo ? ` · ${c.cargo}` : ""}
                          {c.matricula ? ` · mat. ${c.matricula}` : ""}
                        </option>
                      ))}
                    </NativeSelect>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pendente || !escolhas[s.funcionarioId]}
                      onClick={() =>
                        agir(() =>
                          vincularPessoa(
                            s.funcionarioId,
                            escolhas[s.funcionarioId],
                          ),
                        )
                      }
                    >
                      <Link2 className="size-4" />
                      Vincular
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Nenhum nome do People cabe neste. Pode ser grafia diferente,
                    pessoa fora do recorte de 2026, ou uma linha que nunca foi
                    pessoa.
                  </p>
                )}

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={pendente}
                  onClick={() => agir(() => desativarFuncionario(s.funcionarioId))}
                >
                  <UserX className="size-4" />
                  Não é pessoa — desativar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Numero({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <p className="text-2xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
