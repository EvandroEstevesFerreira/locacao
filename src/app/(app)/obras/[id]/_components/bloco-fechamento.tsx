"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";

import { formatarBRL, formatarData } from "@/lib/locacao";
import { competenciaAnterior, variacao, montarFechamento } from "@/lib/fechamento";
import type { FechamentoLinha } from "@/lib/data/orcamento";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fecharCompetencia, reabrirCompetencia } from "../fechamento-actions";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/** Reconstrói o `Fechamento` puro a partir da linha lida, para comparar meses. */
function comoFechamento(l: FechamentoLinha) {
  return montarFechamento(l.competencia, {
    orcado: l.orcado,
    realizadoAcumulado: l.realizadoAcumulado,
    realizadoMes: l.realizadoMes,
    avancoFisico: l.avancoFisico,
  });
}

/**
 * Fechamento mensal: a fotografia de cada competência.
 *
 * Os valores exibidos vêm GRAVADOS do banco, não recalculados. É o ponto do
 * subprojeto: mês fechado não muda quando um preço muda depois.
 */
export function BlocoFechamento({
  obraId,
  fechamentos,
  competenciaSugerida,
}: {
  obraId: string;
  fechamentos: FechamentoLinha[];
  /** Mês anterior ao atual, em AAAA-MM — o candidato natural a fechar. */
  competenciaSugerida: string;
}) {
  const router = useRouter();
  const [competencia, setCompetencia] = useState(competenciaSugerida);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function fechar() {
    setErro(null);
    startTransition(async () => {
      const r = await fecharCompetencia({ obra_id: obraId, competencia });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success("Competência fechada.");
      router.refresh();
    });
  }

  function reabrir(comp: string) {
    setErro(null);
    startTransition(async () => {
      const r = await reabrirCompetencia({ obra_id: obraId, competencia: comp });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success("Competência reaberta. A correção fica registrada.");
      router.refresh();
    });
  }

  const porCompetencia = new Map(fechamentos.map((f) => [f.competencia, f]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" /> Fechamento mensal
        </CardTitle>
        <CardDescription>
          Cada competência fechada é uma fotografia: os valores ficam gravados e
          não mudam quando um preço muda depois. Reabrir é possível, e fica
          registrado.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {fechamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma competência fechada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Competência</th>
                  <th className="py-2 text-right font-medium">Orçado</th>
                  <th className="py-2 text-right font-medium">No mês</th>
                  <th className="py-2 text-right font-medium">Acumulado</th>
                  <th className="py-2 text-right font-medium">Saldo</th>
                  <th className="py-2 text-right font-medium">Consumido</th>
                  <th className="py-2 text-right font-medium">Avanço</th>
                  <th className="py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {fechamentos.map((f) => {
                  const anterior = porCompetencia.get(
                    competenciaAnterior(f.competencia),
                  );
                  const v = variacao(
                    comoFechamento(f),
                    anterior ? comoFechamento(anterior) : null,
                  );
                  return (
                    <tr key={f.competencia} className="border-b last:border-0">
                      <td className="py-2">
                        {formatarData(f.competencia).slice(3)}
                        {f.reabertoEm ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (reaberta)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatarBRL(f.orcado)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatarBRL(f.realizadoMes)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatarBRL(f.realizadoAcumulado)}
                      </td>
                      <td
                        className={
                          f.saldo < 0
                            ? "py-2 text-right font-semibold tabular-nums text-destructive"
                            : "py-2 text-right tabular-nums"
                        }
                      >
                        {formatarBRL(f.saldo)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {pct(f.consumido)}
                        {/* A variação é o que faz o número do mês significar
                            algo: 62% sozinho não diz se piorou. */}
                        {v.consumido !== null ? (
                          <span className="block text-xs text-muted-foreground">
                            {v.consumido > 0 ? "+" : ""}
                            {v.consumido.toFixed(0)} pts
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {pct(f.avancoFisico)}
                        {v.avanco !== null ? (
                          <span className="block text-xs text-muted-foreground">
                            {v.avanco > 0 ? "+" : ""}
                            {v.avanco.toFixed(0)} pts
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right">
                        {f.reabertoEm ? null : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={pendente}
                            onClick={() => reabrir(f.competencia)}
                          >
                            <Unlock className="size-4" />
                            Reabrir
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <FormError>{erro}</FormError>

        <div className="flex items-end gap-3 border-t pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="competencia-fechar">Competência a fechar</Label>
            <Input
              id="competencia-fechar"
              type="month"
              className="max-w-44"
              value={competencia}
              disabled={pendente}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </div>
          <Button onClick={fechar} disabled={pendente || !competencia}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            {pendente ? "Fechando…" : "Fechar competência"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
