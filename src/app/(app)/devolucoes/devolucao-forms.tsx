"use client";

// Cabeçalho da devolução: data, responsável, nota do fornecedor, observações.
//
// `useTransition` + chamada direta da action, e não `useActionState`: o padrão
// do projeto para formulário que precisa reagir ao resultado no mesmo escopo.
// Aqui o resultado dispara o toast e o refresh.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { salvarDevolucao } from "../contratos/devolucao-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/shared/form-error";

export type CabecalhoDevolucao = {
  id: string;
  contrato_id: string;
  devolvido_em: string;
  responsavel: string | null;
  nota_fornecedor: string | null;
  observacoes: string | null;
};

export function DevolucaoCabecalhoForm({
  devolucao,
  podeEditar,
}: {
  devolucao: CabecalhoDevolucao;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarDevolucao({
        id: devolucao.id,
        contrato_id: devolucao.contrato_id,
        devolvido_em: String(fd.get("devolvido_em") ?? ""),
        responsavel: String(fd.get("responsavel") ?? ""),
        nota_fornecedor: String(fd.get("nota_fornecedor") ?? ""),
        observacoes: String(fd.get("observacoes") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Devolução salva.");
      router.refresh();
    });
  }

  const somenteLeitura = !podeEditar;

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="devolvido_em">Data da devolução</Label>
        <Input
          id="devolvido_em"
          name="devolvido_em"
          type="date"
          required
          disabled={somenteLeitura || pendente}
          defaultValue={devolucao.devolvido_em}
        />
        {/* A data manda no saldo e no custo: é ela que encerra a contagem de
            diárias do item. Lançar com a data de hoje uma retirada de três dias
            atrás cobra três diárias a mais. */}
        <p className="text-xs text-muted-foreground">
          É a data em que o equipamento saiu da obra — ela encerra a contagem de
          diárias.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="responsavel">Quem entregou</Label>
        <Input
          id="responsavel"
          name="responsavel"
          maxLength={200}
          disabled={somenteLeitura || pendente}
          defaultValue={devolucao.responsavel ?? ""}
          placeholder="Nome de quem entregou ao fornecedor"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nota_fornecedor">Nota / contra-nota do fornecedor</Label>
        <Input
          id="nota_fornecedor"
          name="nota_fornecedor"
          maxLength={60}
          disabled={somenteLeitura || pendente}
          defaultValue={devolucao.nota_fornecedor ?? ""}
          placeholder="O número do documento DELES"
        />
        {/* Sem esta linha, o campo parece ser o número da devolução no Loca — e
            alguém digitaria DEV-2026-0009 aqui. */}
        <p className="text-xs text-muted-foreground">
          O número do documento do fornecedor. O número deste registro no Loca é
          gerado pelo sistema.
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">Observações da devolução</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={3}
          maxLength={2000}
          disabled={somenteLeitura || pendente}
          defaultValue={devolucao.observacoes ?? ""}
          placeholder="Como saiu da obra, quem retirou, o que ficou pendente."
        />
      </div>

      <div className="sm:col-span-2">
        <FormError>{erro}</FormError>
      </div>

      {podeEditar ? (
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar devolução"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Devolução fechada: os dados não são mais editáveis.
        </p>
      )}
    </form>
  );
}
