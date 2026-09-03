"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { hojeISOSaoPaulo } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { moverPeca } from "../../actions";

type Destino = "almoxarifado" | "obra" | "fornecedor";

/**
 * Mover a peça. NÃO oferece "entregar a funcionário": esse caminho é
 * `/termos/novo`, com assinatura — decisão de projeto, não limitação de tela.
 */
export function PecaMover({
  unidadeId,
  obras,
  fornecedores,
}: {
  unidadeId: string;
  obras: { id: string; rotulo: string }[];
  fornecedores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Destino>("obra");
  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [data, setData] = useState(hojeISOSaoPaulo());
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function mover() {
    setErro(null);
    iniciar(async () => {
      const r = await moverPeca({
        unidade_id: unidadeId,
        tipo,
        obra_id: obraId || null,
        fornecedor_id: fornecedorId || null,
        data,
        observacoes: observacoes || null,
      });
      if (!r.ok) return setErro(r.erro);
      setObservacoes("");
      // A data volta para hoje: mantida, o segundo movimento sairia com a data
      // do primeiro e seria recusado pelo check `fim >= inicio` do livro.
      setData(hojeISOSaoPaulo());
      toast.success("Movimentação registrada no histórico da peça.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="destino">Para onde vai</Label>
          <NativeSelect
            id="destino"
            value={tipo}
            disabled={pendente}
            onChange={(e) => setTipo(e.target.value as Destino)}
          >
            <option value="obra">Obra</option>
            <option value="almoxarifado">Almoxarifado central</option>
            <option value="fornecedor">Manutenção em fornecedor</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_movimentacao">Data</Label>
          <Input
            id="data_movimentacao"
            type="date"
            value={data}
            disabled={pendente}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        {tipo === "obra" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obra_destino">Obra</Label>
            <NativeSelect
              id="obra_destino"
              value={obraId}
              disabled={pendente}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Selecione a obra…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {tipo === "fornecedor" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fornecedor_destino">Fornecedor</Label>
            <NativeSelect
              id="fornecedor_destino"
              value={fornecedorId}
              disabled={pendente}
              onChange={(e) => setFornecedorId(e.target.value)}
            >
              <option value="">Selecione o fornecedor…</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="obs_movimentacao">Observações (opcional)</Label>
          <Input
            id="obs_movimentacao"
            maxLength={300}
            placeholder="Quem levou, em que veículo, o que foi combinado…"
            value={observacoes}
            disabled={pendente}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={mover}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Truck className="size-4" />
          )}
          {pendente ? "Registrando…" : "Registrar movimentação"}
        </Button>
      </div>
    </div>
  );
}
