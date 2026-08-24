"use client";

// Cabeçalho da conferência: data, conferente, nota do fornecedor, observações.
//
// `useTransition` + chamada direta da action, e não `useActionState`: o padrão
// do projeto para formulário que precisa reagir ao resultado no mesmo escopo
// (ver o comentário em `salvarFechamentoLimpeza`). Aqui o resultado dispara o
// toast e o refresh.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarRecebimento } from "../contratos/recebimento-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/shared/form-error";

export type CabecalhoRecebimento = {
  id: string;
  contrato_id: string;
  recebido_em: string;
  conferente: string | null;
  nota_fornecedor: string | null;
  observacoes: string | null;
};

export function RecebimentoCabecalhoForm({
  recebimento,
  podeEditar,
}: {
  recebimento: CabecalhoRecebimento;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarRecebimento({
        id: recebimento.id,
        contrato_id: recebimento.contrato_id,
        recebido_em: String(fd.get("recebido_em") ?? ""),
        conferente: String(fd.get("conferente") ?? ""),
        nota_fornecedor: String(fd.get("nota_fornecedor") ?? ""),
        observacoes: String(fd.get("observacoes") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Conferência salva.");
      router.refresh();
    });
  }

  const somenteLeitura = !podeEditar;

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="recebido_em">Data do recebimento</Label>
        <Input
          id="recebido_em"
          name="recebido_em"
          type="date"
          required
          disabled={somenteLeitura || pendente}
          defaultValue={recebimento.recebido_em}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="conferente">Quem conferiu</Label>
        <Input
          id="conferente"
          name="conferente"
          maxLength={200}
          disabled={somenteLeitura || pendente}
          defaultValue={recebimento.conferente ?? ""}
          placeholder="Nome de quem recebeu na obra"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nota_fornecedor">Nota / romaneio do fornecedor</Label>
        <Input
          id="nota_fornecedor"
          name="nota_fornecedor"
          maxLength={60}
          disabled={somenteLeitura || pendente}
          defaultValue={recebimento.nota_fornecedor ?? ""}
          placeholder="O número do documento DELES"
        />
        {/* Sem esta linha, o campo parece ser o número do recebimento no Loca —
            e alguém digitaria REC-2026-0014 aqui. */}
        <p className="text-xs text-muted-foreground">
          O número do documento do fornecedor. O número deste registro no Loca é
          gerado pelo sistema.
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">Observações da conferência</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          maxLength={2000}
          disabled={somenteLeitura || pendente}
          defaultValue={recebimento.observacoes ?? ""}
          placeholder="Condições da entrega, quem entregou, o que ficou pendente."
        />
      </div>

      <div className="sm:col-span-2">
        <FormError>{erro}</FormError>
      </div>

      {podeEditar ? (
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar conferência"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Recebimento fechado: os dados da conferência não são mais editáveis.
        </p>
      )}
    </form>
  );
}
