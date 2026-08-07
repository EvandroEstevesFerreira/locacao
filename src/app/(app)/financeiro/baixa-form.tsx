"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatarBRL } from "@/lib/locacao";
import { darBaixa } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/shared/form-error";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function BaixaForm({
  lancamento,
  orgId,
  encargos,
}: {
  lancamento: {
    id: string;
    descricao: string;
    valor: number;
    vencimento: string;
    nf_numero: string | null;
  };
  orgId: string;
  encargos: { diasAtraso: number; multa: number; juros: number; total: number };
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [multa, setMulta] = useState(0);
  const [juros, setJuros] = useState(0);
  const [valorPago, setValorPago] = useState(lancamento.valor);
  const [nf, setNf] = useState(lancamento.nf_numero ?? "");
  const [dataPagamento, setDataPagamento] = useState(hojeISO());
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function aplicarEncargos() {
    setMulta(encargos.multa);
    setJuros(encargos.juros);
    setValorPago(encargos.total);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      let comprovantePath: string | null = null;
      const file = fileRef.current?.files?.[0];
      if (file && file.size > 0) {
        const supabase = createClient();
        const uid = crypto.randomUUID();
        const path = `${orgId}/comprovantes/${lancamento.id}/${uid}-${nomeSeguro(file.name)}`;
        const { error } = await supabase.storage.from("contratos").upload(path, file, { upsert: false });
        if (error) {
          setErro("Falha ao enviar o comprovante.");
          return;
        }
        comprovantePath = path;
      }

      const res = await darBaixa({
        id: lancamento.id,
        valorPago,
        multa,
        juros,
        nfNumero: nf,
        dataPagamento,
        comprovantePath,
      });
      if (!res.ok) {
        setErro(res.erro);
        return;
      }
      toast.success("Baixa registrada.");
      startTransition(() => router.push("/financeiro"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <p className="font-medium">{lancamento.descricao}</p>
        <p className="text-muted-foreground">Valor original: {formatarBRL(lancamento.valor)}</p>
      </div>

      {encargos.diasAtraso > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <span>
            {encargos.diasAtraso} dia(s) em atraso — sugestão: multa {formatarBRL(encargos.multa)} + juros{" "}
            {formatarBRL(encargos.juros)} = <strong>{formatarBRL(encargos.total)}</strong>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={aplicarEncargos}>
            Aplicar encargos
          </Button>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="multa">Multa (R$)</Label>
          <Input id="multa" type="number" step="0.01" min="0" value={multa}
            onChange={(e) => setMulta(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="juros">Juros (R$)</Label>
          <Input id="juros" type="number" step="0.01" min="0" value={juros}
            onChange={(e) => setJuros(Number(e.target.value))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="valor_pago">Valor pago (R$) *</Label>
          <Input id="valor_pago" type="number" step="0.01" min="0.01" required value={valorPago}
            onChange={(e) => setValorPago(Number(e.target.value))} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="data_pagamento">Data do pagamento *</Label>
          <Input id="data_pagamento" type="date" required value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nf_numero">Nº da NF (opcional)</Label>
          <Input id="nf_numero" maxLength={60} value={nf} onChange={(e) => setNf(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Comprovante / NF (opcional)</Label>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => setNomeArquivo(e.target.files?.[0]?.name ?? null)}
        />
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" /> Anexar arquivo
          </Button>
          {nomeArquivo ? <span className="text-sm text-muted-foreground">{nomeArquivo}</span> : null}
        </div>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex gap-2">
        <Button type="submit" disabled={enviando}>
          {enviando ? "Registrando…" : "Registrar baixa"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/financeiro")}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
