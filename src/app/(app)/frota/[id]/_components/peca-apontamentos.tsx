"use client";

// Apontamento de uso da peça — a leitura do horímetro.
//
// O que se lança é a LEITURA DO MOSTRADOR, acumulada, e não "quantas horas
// trabalhou". Quem lê o horímetro copia um número; quem estima horas de memória
// inventa. E a leitura é auditável: dá para conferir contra a máquina a
// qualquer momento.
//
// As horas do período são calculadas pelo banco (trigger da 0071), porque
// "período anterior" depende da DATA e não da ordem de digitação.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Plus, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { formatarData } from "@/lib/locacao";
import type { ApontamentoLinha } from "@/lib/data/apontamentos";
import { salvarApontamento, excluirApontamento } from "../../apontamento-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PecaApontamentos({
  unidadeId,
  temHorimetro,
  apontamentos,
  obras,
  hoje,
  podeEditar,
}: {
  unidadeId: string;
  temHorimetro: boolean;
  apontamentos: ApontamentoLinha[];
  obras: { id: string; codigo: string; nome: string }[];
  hoje: string;
  podeEditar: boolean;
}) {
  const [lancando, setLancando] = useState(false);

  // A seção some por inteiro para peça sem horímetro. Mostrá-la vazia em toda
  // betoneira e escora do sistema seria ruído em cada tela de peça.
  if (!temHorimetro) return null;

  const ultima = apontamentos[0] ?? null;
  const totalHoras = apontamentos.reduce((s, a) => s + a.horas, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Uso</CardTitle>
        <CardDescription>
          {ultima ? (
            <>
              Horímetro em <strong>{ultima.leitura.toLocaleString("pt-BR")} h</strong>,
              lido em {formatarData(ultima.data)}
              {totalHoras > 0
                ? ` · ${totalHoras.toLocaleString("pt-BR")} h registradas`
                : ""}
              .
            </>
          ) : (
            "Nenhuma leitura registrada. Lance a primeira para começar a contar."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {apontamentos.length > 0 ? (
          <div className="divide-y">
            {apontamentos.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className="w-24 shrink-0 tabular-nums">
                  {formatarData(a.data)}
                </span>
                <span className="w-28 shrink-0 tabular-nums">
                  {a.leitura.toLocaleString("pt-BR")} h
                </span>
                <span className="min-w-0 flex-1 text-muted-foreground">
                  {a.reiniciado ? (
                    <Badge variant="secondary" className="gap-1">
                      <RotateCcw className="size-3" aria-hidden />
                      Horímetro trocado
                    </Badge>
                  ) : (
                    <>
                      {/* Zero hora no período é informação, não ausência: a
                          máquina não trabalhou entre uma leitura e outra. É
                          exatamente o que o relatório de ociosidade real
                          procura. */}
                      <strong className="text-foreground">
                        {a.horas.toLocaleString("pt-BR")} h
                      </strong>{" "}
                      no período
                    </>
                  )}
                  {a.obra ? ` · ${a.obra}` : ""}
                  {a.observacoes ? ` · ${a.observacoes}` : ""}
                </span>
                {podeEditar ? (
                  <ConfirmDelete
                    action={excluirApontamento}
                    id={a.id}
                    hidden={{ unidade_id: unidadeId }}
                    mensagem="Excluir esta leitura? As horas do apontamento seguinte serão recalculadas."
                  />
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {podeEditar ? (
          lancando ? (
            <div className="rounded-lg border border-dashed p-3">
              <ApontamentoForm
                unidadeId={unidadeId}
                obras={obras}
                hoje={hoje}
                ultimaLeitura={ultima?.leitura ?? null}
                aoConcluir={() => setLancando(false)}
              />
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setLancando(true)}>
              {apontamentos.length === 0 ? (
                <Gauge className="size-3.5" aria-hidden />
              ) : (
                <Plus className="size-3.5" aria-hidden />
              )}
              Lançar leitura
            </Button>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}

function ApontamentoForm({
  unidadeId,
  obras,
  hoje,
  ultimaLeitura,
  aoConcluir,
}: {
  unidadeId: string;
  obras: { id: string; codigo: string; nome: string }[];
  hoje: string;
  ultimaLeitura: number | null;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [reiniciado, setReiniciado] = useState(false);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarApontamento({
        unidade_id: unidadeId,
        obra_id: String(fd.get("obra_id") ?? ""),
        data: String(fd.get("data") ?? ""),
        leitura: String(fd.get("leitura") ?? ""),
        reiniciado,
        observacoes: String(fd.get("observacoes") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Leitura registrada.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="data">Data da leitura</Label>
        <Input
          id="data"
          name="data"
          type="date"
          required
          disabled={pendente}
          defaultValue={hoje}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="leitura">Leitura do horímetro</Label>
        <Input
          id="leitura"
          name="leitura"
          type="number"
          step="0.1"
          min="0"
          required
          inputMode="decimal"
          disabled={pendente}
          placeholder="O número que aparece no mostrador"
        />
        {/* Sem esta linha, alguém digita as horas do período em vez da leitura
            acumulada — e o sistema calcula a diferença sobre a diferença. */}
        <p className="text-xs text-muted-foreground">
          O número acumulado do mostrador, não as horas do período.
          {ultimaLeitura !== null ? (
            <>
              {" "}
              A última foi <strong>{ultimaLeitura.toLocaleString("pt-BR")} h</strong>.
            </>
          ) : null}
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="obra_id">
          Obra{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <NativeSelect id="obra_id" name="obra_id" disabled={pendente}>
          <option value="">—</option>
          {obras.map((o) => (
            <option key={o.id} value={o.id}>
              {o.codigo} — {o.nome}
            </option>
          ))}
        </NativeSelect>
        {/* Fotografada no lançamento e não derivada depois: a peça circula, e
            daqui a três meses a obra atual seria outra — o apontamento diria
            que a máquina trabalhou onde ela nem estava. */}
        <p className="text-xs text-muted-foreground">
          Onde a peça estava neste período. Fica gravado como foi lançado.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          className="mt-0.5 size-4"
          checked={reiniciado}
          disabled={pendente}
          onChange={(e) => setReiniciado(e.target.checked)}
        />
        <span>
          Horímetro trocado ou reiniciado
          <span className="block text-xs text-muted-foreground">
            Marque quando o mostrador voltou a zero. Sem isso, uma leitura menor
            que a anterior é recusada — o horímetro não anda para trás.
          </span>
        </span>
      </label>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="observacoes"
          name="observacoes"
          maxLength={300}
          disabled={pendente}
          placeholder="Parada por chuva, frente encerrada, troca de operador…"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Salvando…" : "Salvar leitura"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
          <X className="size-3.5" aria-hidden />
          Cancelar
        </Button>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
      </div>
    </form>
  );
}
