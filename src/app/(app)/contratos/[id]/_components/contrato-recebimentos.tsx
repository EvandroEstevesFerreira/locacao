// Recebimentos do contrato — a entrada física do equipamento na obra.
//
// Até esta seção existir, o recebimento não era registrado em lugar nenhum:
// `movimentacao` só grava devolução, e a retirada ficava implícita em
// `item_locado.data_retirada`. O papel que circulava na obra era o do
// fornecedor.
//
// A seção mostra o CONTROLE — quais recebimentos existem, quais ainda são
// rascunho — e leva ao detalhe, onde os itens são conferidos.

import Link from "next/link";
import { PackagePlus, ChevronRight, FileWarning } from "lucide-react";
import { listarRecebimentos } from "@/lib/data/recebimentos";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { STATUS_RECEBIMENTO_INFO, type StatusRecebimento } from "@/lib/recebimento";
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
  criarRascunhoRecebimento,
  excluirRecebimento,
} from "../../recebimento-actions";

export async function ContratoRecebimentos({
  contratoId,
  podeEditar,
}: {
  contratoId: string;
  podeEditar: boolean;
}) {
  const recebimentos = await listarRecebimentos(contratoId);

  // "Hoje" de Brasília: o Vercel roda em UTC e das 21h à meia-noite a data
  // sugerida no rascunho novo sairia um dia à frente.
  const hoje = hojeISOSaoPaulo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recebimentos</CardTitle>
        <CardDescription>
          A entrada física do equipamento na obra. O rascunho é editável; ao
          fechar, o recebimento ganha número e o fornecedor é avisado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recebimentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum recebimento registrado neste contrato.
          </p>
        ) : (
          <div className="divide-y">
            {recebimentos.map((r) => {
              const info =
                STATUS_RECEBIMENTO_INFO[r.status as StatusRecebimento];
              const fechadoSemAviso =
                r.status === "fechado" && r.aviso_enviado_em === null;

              return (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatarNumero(r.numero_registro)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatarData(r.recebido_em)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.itens} {r.itens === 1 ? "item" : "itens"}
                      {r.conferente ? ` · conferido por ${r.conferente}` : ""}
                      {r.nota_fornecedor ? ` · nota ${r.nota_fornecedor}` : ""}
                    </p>
                  </div>

                  {/* Fechado sem aviso enviado é estado REAL e precisa ser
                      visível: o Resend pode ter falhado, e o recebimento
                      continua válido — mas o fornecedor não sabe dele. */}
                  {fechadoSemAviso ? (
                    <Badge variant="secondary" className="gap-1">
                      <FileWarning className="size-3" aria-hidden />
                      Fornecedor não avisado
                    </Badge>
                  ) : null}

                  <Badge variant={info?.variant ?? "secondary"}>
                    {info?.label ?? r.status}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/recebimentos/${r.id}`} />}
                  >
                    {r.status === "rascunho" ? "Conferir" : "Ver"}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>

                  {/* Só rascunho é excluível. O RPC recusa fechado, mas esconder
                      o botão evita oferecer uma ação que sempre falharia. */}
                  {podeEditar && r.status === "rascunho" ? (
                    <ConfirmDelete
                      action={excluirRecebimento}
                      id={r.id}
                      hidden={{ contrato_id: contratoId }}
                      mensagem="Excluir este rascunho de recebimento? Os itens conferidos até agora são perdidos."
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {podeEditar ? (
          <form action={criarRascunhoRecebimento}>
            <input type="hidden" name="contrato_id" value={contratoId} />
            <input type="hidden" name="recebido_em" value={hoje} />
            <Button type="submit" size="sm">
              <PackagePlus className="size-3.5" aria-hidden />
              Registrar recebimento
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
