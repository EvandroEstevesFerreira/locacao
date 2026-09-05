// Manutenção da peça — as ordens de reparo dela.
//
// Responde à pergunta que a tela da peça não respondia: esta máquina já quebrou
// antes? Quantas vezes, quanto custou e quem consertou. É o histórico que
// decide se vale a pena consertar de novo ou substituir.

import Link from "next/link";
import { Wrench, Plus, ChevronRight } from "lucide-react";
import { listarReparosDaPeca } from "@/lib/data/reparos";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { STATUS_REPARO_INFO, type StatusReparo } from "@/lib/reparo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export async function PecaReparos({
  unidadeId,
  podeEditar,
}: {
  unidadeId: string;
  podeEditar: boolean;
}) {
  const reparos = await listarReparosDaPeca(unidadeId);

  const gasto = reparos
    .filter((r) => r.status === "concluido")
    .reduce((s, r) => s + r.valor, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manutenção</CardTitle>
        <CardDescription>
          {reparos.length === 0
            ? "Nenhuma ordem de reparo para esta peça."
            : `${reparos.length} ${reparos.length === 1 ? "ordem" : "ordens"}${
                gasto > 0 ? ` — ${formatarBRL(gasto)} já gastos em conserto` : ""
              }.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reparos.length > 0 ? (
          <div className="divide-y">
            {reparos.map((r) => {
              const info = STATUS_REPARO_INFO[r.status as StatusReparo];
              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatarNumero(r.numero_registro)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatarData(r.aberto_em)}
                      </span>
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.descricao}
                      {r.executor ? ` — ${r.executor}` : ""}
                      {r.valor > 0 ? ` — ${formatarBRL(r.valor)}` : ""}
                    </p>
                  </div>
                  <Badge variant={info?.variant ?? "secondary"}>
                    {info?.label ?? r.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Abrir ordem"
                    render={<Link href={`/frota/reparos/${r.id}`} />}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}

        {podeEditar ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/frota/reparos/nova?peca=${unidadeId}`} />}
          >
            {reparos.length === 0 ? (
              <Wrench className="size-3.5" aria-hidden />
            ) : (
              <Plus className="size-3.5" aria-hidden />
            )}
            Abrir ordem de reparo
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
