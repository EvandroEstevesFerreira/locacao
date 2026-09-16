"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { formatarBRL, formatarData } from "@/lib/locacao";
import type { ItemFila } from "@/lib/data/conciliacao";
import { confirmarSugestao, recusarSugestao, desfazerRecusa } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { FormError } from "@/components/shared/form-error";

/**
 * Uma linha da fila de conciliação.
 *
 * O `motivo` fica visível junto dos campos, e não escondido atrás de um ícone:
 * quem confirma está movendo dinheiro, e precisa ler POR QUE o sistema propôs
 * aquele casamento antes de dizer sim.
 */

const CONFIANCA: Record<ItemFila["confianca"], { label: string; variant: "secondary" | "outline" | "destructive" }> = {
  alta: { label: "Alta", variant: "secondary" },
  media: { label: "Média", variant: "outline" },
  baixa: { label: "Baixa", variant: "destructive" },
};

export function LinhaSugestao({ item }: { item: ItemFila }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [valorPago, setValorPago] = useState(item.valorPago);
  const [multa, setMulta] = useState(0);
  const [juros, setJuros] = useState(0);
  // `ItemFila.dataPagamento` é `string | null`, mas o zod de `confirmarSugestao`
  // exige `YYYY-MM-DD` e rejeita nulo. Na prática a fila só tem título já pago,
  // então `dataDePagamento()` nunca devolve nulo aqui — mas o tipo permite, e um
  // campo editável (em vez de repassar o valor cru) fecha esse buraco e ainda
  // deixa corrigir a data antes de confirmar.
  const [dataPagamento, setDataPagamento] = useState(item.dataPagamento ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const conf = CONFIANCA[item.confianca];
  const diferenca =
    item.lancamentoValor === null ? 0 : item.valorPago - item.lancamentoValor;

  function confirmar() {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarSugestao({
        id: item.id,
        lancamentoId: item.lancamentoId,
        valorPago,
        multa,
        juros,
        nfNumero: item.numeroDocumento || null,
        dataPagamento,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // O `aviso` existe para quando a baixa ACONTECEU mas um passo acessório
      // falhou. Mostrar isso como sucesso esconderia um problema real.
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Baixa registrada.");
      router.refresh();
    });
  }

  function decidir(acao: typeof recusarSugestao, mensagem: string) {
    setErro(null);
    startTransition(async () => {
      const r = await acao({ id: item.id });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success(mensagem);
      router.refresh();
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{item.agenteNome}</TableCell>
        <TableCell>
          {item.tipoDocumento} {item.numeroDocumento}
        </TableCell>
        <TableCell>
          {item.dataPagamento ? formatarData(item.dataPagamento) : "—"}
        </TableCell>
        <TableCell>{formatarBRL(item.valorPago)}</TableCell>
        <TableCell>
          {item.lancamentoId ? (
            <span>
              {item.lancamentoDescricao}{" "}
              <span className="text-muted-foreground">
                ({formatarBRL(item.lancamentoValor ?? 0)})
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Sem casamento</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={conf.variant}>{conf.label}</Badge>
        </TableCell>
        <TableCell className="text-right">
          {item.status === "recusada" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pendente}
              onClick={() => decidir(desfazerRecusa, "Sugestão devolvida à fila.")}
            >
              Devolver à fila
            </Button>
          ) : (
            <div className="flex justify-end gap-2">
              {item.lancamentoId && (
                <Button size="sm" disabled={pendente} onClick={() => setAberto((v) => !v)}>
                  {aberto ? "Fechar" : "Confirmar baixa"}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={pendente}
                onClick={() => decidir(recusarSugestao, "Sugestão recusada.")}
              >
                Recusar
              </Button>
            </div>
          )}
        </TableCell>
      </TableRow>

      <TableRow>
        <TableCell colSpan={7} className="pt-0 text-xs text-muted-foreground">
          {item.motivo}
        </TableCell>
      </TableRow>

      {aberto && item.lancamentoId && (
        <TableRow>
          <TableCell colSpan={7}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label htmlFor={`data-${item.id}`}>Pago em</Label>
                <Input
                  id={`data-${item.id}`}
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`valor-${item.id}`}>Valor pago</Label>
                <Input
                  id={`valor-${item.id}`}
                  type="number"
                  step="0.01"
                  value={valorPago}
                  onChange={(e) => setValorPago(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`multa-${item.id}`}>Multa</Label>
                <Input
                  id={`multa-${item.id}`}
                  type="number"
                  step="0.01"
                  value={multa}
                  onChange={(e) => setMulta(Number(e.target.value))}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`juros-${item.id}`}>Juros</Label>
                <Input
                  id={`juros-${item.id}`}
                  type="number"
                  step="0.01"
                  value={juros}
                  onChange={(e) => setJuros(Number(e.target.value))}
                />
              </div>
              <Button disabled={pendente || !dataPagamento} onClick={confirmar}>
                {pendente ? "Registrando..." : "Registrar baixa"}
              </Button>
            </div>

            {diferenca !== 0 && (
              // A DIFERENÇA É O QUE INTERESSA: ela é a multa, o juro ou o
              // desconto. Escondê-la esconderia exatamente o que o financeiro
              // precisa atribuir.
              <p className="mt-2 text-sm font-medium">
                Diferença de {formatarBRL(Math.abs(diferenca))} — informe multa
                ou juros, se for o caso.
              </p>
            )}

            <FormError>{erro}</FormError>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
