"use client";

// O formulário do laudo.
//
// Dois formulários separados na mesma tela, e não um só: o LAUDO (apuração,
// responsabilidade, peça, data) e o CUSTO. Eles são preenchidos por pessoas
// diferentes em momentos diferentes — a apuração sai de quem foi a campo, o
// custo chega depois num orçamento do fornecedor. Num formulário único, quem
// salvasse o custo sobrescreveria a apuração com o que estava na tela dele.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RESPONSABILIDADES,
  RESPONSABILIDADE_INFO,
  type Responsabilidade,
} from "@/lib/avaria";
import type { PecaDoContrato } from "@/lib/data/avarias";
import { salvarLaudoAvaria, salvarCustoAvaria } from "../laudo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/shared/form-error";

export function LaudoForm({
  avariaId,
  data,
  responsabilidade,
  unidadeId,
  laudo,
  pecas,
  podeEditar,
}: {
  avariaId: string;
  data: string;
  responsabilidade: string;
  unidadeId: string | null;
  laudo: string | null;
  pecas: PecaDoContrato[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [resp, setResp] = useState<Responsabilidade>(
    (responsabilidade as Responsabilidade) ?? "indefinida",
  );
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarLaudoAvaria({
        id: avariaId,
        data: String(fd.get("data") ?? ""),
        responsabilidade: resp,
        unidade_id: String(fd.get("unidade_id") ?? ""),
        laudo: String(fd.get("laudo") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Laudo salvo.");
      router.refresh();
    });
  }

  const somenteLeitura = !podeEditar;

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="data">Constatada em</Label>
        <Input
          id="data"
          name="data"
          type="date"
          required
          disabled={somenteLeitura || pendente}
          defaultValue={data}
        />
        {/* A data separa dano anterior à locação de dano ocorrido nela — que é
            a primeira coisa que o fornecedor vai contestar. */}
        <p className="text-xs text-muted-foreground">
          A data em que o dano foi visto, não a de hoje.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="unidade_id">Peça</Label>
        <NativeSelect
          id="unidade_id"
          name="unidade_id"
          disabled={somenteLeitura || pendente}
          defaultValue={unidadeId ?? ""}
        >
          <option value="">Sem peça identificada</option>
          {pecas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.identificador} — {p.descricao}
            </option>
          ))}
        </NativeSelect>
        {pecas.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Este contrato não tem item controlado por patrimônio. Material de
            lote — andaime, escora — não tem peça a apontar.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="responsabilidade">Responsabilidade</Label>
        <NativeSelect
          id="responsabilidade"
          value={resp}
          onChange={(e) => setResp(e.target.value as Responsabilidade)}
          disabled={somenteLeitura || pendente}
        >
          {RESPONSABILIDADES.map((r) => (
            <option key={r} value={r}>
              {RESPONSABILIDADE_INFO[r].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {RESPONSABILIDADE_INFO[resp].ajuda}
        </p>
        {/* A atribuição a funcionário tem consequência trabalhista, e a tela é
            o último lugar onde dá para dizer isso antes de o nome entrar num
            documento. Desconto em salário por dano depende de dolo, ou de culpa
            com previsão em contrato (CLT art. 462, §1º) — não da opinião de
            quem preenche o laudo. */}
        {resp === "funcionario" ? (
          <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
            Descreva na apuração <strong>como</strong> se chegou a essa
            conclusão, e quem participou. Atribuir o dano a uma pessoa sem
            apuração escrita não sustenta nada — e desconto em salário depende de
            dolo, ou de culpa prevista em contrato, não do que se marca aqui.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="laudo">Apuração</Label>
        <Textarea
          id="laudo"
          name="laudo"
          rows={8}
          maxLength={4000}
          disabled={somenteLeitura || pendente}
          defaultValue={laudo ?? ""}
          placeholder="O que foi verificado, com quem se falou, como se concluiu e o que se propõe."
        />
        <p className="text-xs text-muted-foreground">
          É este texto que sai no laudo em PDF e sustenta a cobrança. Em branco,
          o PDF sai com espaço para preencher à mão em campo.
        </p>
      </div>

      <div className="sm:col-span-2">
        <FormError>{erro}</FormError>
      </div>

      {podeEditar ? (
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pendente}>
            {pendente ? "Salvando…" : "Salvar laudo"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Esta avaria já virou lançamento financeiro. O laudo que sustentou a
          cobrança não pode mais ser reescrito.
        </p>
      )}
    </form>
  );
}

export function CustoForm({
  avariaId,
  custoEstimado,
  podeEditar,
}: {
  avariaId: string;
  custoEstimado: number;
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarCustoAvaria({
        id: avariaId,
        custo_estimado: String(fd.get("custo_estimado") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success("Custo salvo.");
      router.refresh();
    });
  }

  if (!podeEditar) return null;

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="custo_estimado">Custo estimado</Label>
        <Input
          id="custo_estimado"
          name="custo_estimado"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          className="w-40"
          disabled={pendente}
          defaultValue={custoEstimado || ""}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar custo"}
      </Button>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </form>
  );
}
