// Devoluções do contrato — a saída física do equipamento, como DOCUMENTO.
//
// Não confundir com `contrato-devolucoes.tsx`, logo abaixo na mesma página:
// aquela é o HISTÓRICO de saldo, lido de `movimentacao`, e mostra toda baixa
// que já houve — inclusive as anteriores a esta funcionalidade. Esta seção é o
// controle dos documentos: quais existem, quais ainda são rascunho, e é por ela
// que se cria um novo.
//
// Até ela existir, devolver cinco andaimes no mesmo caminhão produzia cinco
// registros e nenhum comprovante. Quem entregava não tinha o que assinar.

import Link from "next/link";
import { PackageOpen, ChevronRight, FileWarning } from "lucide-react";
import { listarDevolucoes } from "@/lib/data/devolucoes";
import { formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { STATUS_DEVOLUCAO_INFO, type StatusDevolucao } from "@/lib/devolucao";
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
  criarRascunhoDevolucao,
  excluirDevolucao,
} from "../../devolucao-actions";

export async function ContratoDevolucoesDoc({
  contratoId,
  podeEditar,
}: {
  contratoId: string;
  podeEditar: boolean;
}) {
  const devolucoes = await listarDevolucoes(contratoId);

  // "Hoje" de Brasília: o Vercel roda em UTC e das 21h à meia-noite a data
  // sugerida no rascunho novo sairia um dia à frente — e a data da devolução
  // encerra a contagem de diárias.
  const hoje = hojeISOSaoPaulo();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Devoluções</CardTitle>
        <CardDescription>
          A saída física do equipamento. O rascunho é editável e não mexe no
          saldo; ao fechar, a devolução ganha número, baixa o saldo do contrato e
          o fornecedor é avisado com o termo em PDF.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {devolucoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma devolução registrada neste contrato.
          </p>
        ) : (
          <div className="divide-y">
            {devolucoes.map((d) => {
              const info = STATUS_DEVOLUCAO_INFO[d.status as StatusDevolucao];
              const fechadaSemAviso =
                d.status === "fechado" && d.aviso_enviado_em === null;

              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center gap-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">
                      {formatarNumero(d.numero_registro)}
                      <span className="ml-2 font-normal text-muted-foreground">
                        {formatarData(d.devolvido_em)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {d.itens} {d.itens === 1 ? "item" : "itens"}
                      {d.responsavel ? ` · entregue por ${d.responsavel}` : ""}
                      {d.nota_fornecedor ? ` · nota ${d.nota_fornecedor}` : ""}
                    </p>
                  </div>

                  {/* Fechada sem aviso enviado é estado REAL e precisa ser
                      visível: o Resend pode ter falhado, e a devolução continua
                      válida — mas o fornecedor não sabe que o equipamento
                      voltou, e é isso que ele vai alegar ao cobrar diária. */}
                  {fechadaSemAviso ? (
                    <Badge variant="secondary" className="gap-1">
                      <FileWarning className="size-3" aria-hidden />
                      Fornecedor não avisado
                    </Badge>
                  ) : null}

                  <Badge variant={info?.variant ?? "secondary"}>
                    {info?.label ?? d.status}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/devolucoes/${d.id}`} />}
                  >
                    {d.status === "rascunho" ? "Conferir" : "Ver"}
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Button>

                  {/* Só rascunho é excluível. O RPC recusa fechada, mas esconder
                      o botão evita oferecer uma ação que sempre falharia. */}
                  {podeEditar && d.status === "rascunho" ? (
                    <ConfirmDelete
                      action={excluirDevolucao}
                      id={d.id}
                      hidden={{ contrato_id: contratoId }}
                      mensagem="Excluir este rascunho de devolução? Os itens lançados até agora são perdidos. O saldo do contrato não muda — ele só se move no fechamento."
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {podeEditar ? (
          <form action={criarRascunhoDevolucao}>
            <input type="hidden" name="contrato_id" value={contratoId} />
            <input type="hidden" name="devolvido_em" value={hoje} />
            <Button type="submit" size="sm">
              <PackageOpen className="size-3.5" aria-hidden />
              Registrar devolução
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
