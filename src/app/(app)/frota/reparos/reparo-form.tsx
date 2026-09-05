"use client";

// O formulário da ordem de reparo, e o de conclusão.
//
// Dois formulários, e não um `<select>` de status no meio de dez campos. A
// CONCLUSÃO é o passo que devolve a peça ao pátio — o trigger a tira de
// 'manutencao' —, e esconder isso numa opção de lista faria alguém devolver uma
// máquina que ainda está na oficina sem perceber o que fez.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  STATUS_REPARO,
  STATUS_REPARO_INFO,
  RESPONSABILIDADES,
  RESPONSABILIDADE_INFO,
  type StatusReparo,
  type Responsabilidade,
} from "@/lib/reparo";
import type { PecaParaReparo } from "@/lib/data/reparos";
import { salvarReparo, concluirReparo } from "../reparo-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormError } from "@/components/shared/form-error";

export type ReparoEditavel = {
  id?: string;
  unidade_id: string;
  avaria_id: string | null;
  status: string;
  descricao: string;
  executor: string | null;
  aberto_em: string;
  enviado_em: string | null;
  previsto_para: string | null;
  concluido_em: string | null;
  valor: number;
  responsabilidade: string;
  garantia_dias: number | null;
  observacoes: string | null;
};

export function ReparoForm({
  reparo,
  pecas,
  podeEditar,
}: {
  reparo: ReparoEditavel;
  pecas: PecaParaReparo[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusReparo>(
    (reparo.status as StatusReparo) ?? "aberto",
  );
  const [resp, setResp] = useState<Responsabilidade>(
    (reparo.responsabilidade as Responsabilidade) ?? "indefinida",
  );
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await salvarReparo({
        id: reparo.id,
        unidade_id: String(fd.get("unidade_id") ?? ""),
        avaria_id: reparo.avaria_id ?? "",
        status,
        descricao: String(fd.get("descricao") ?? ""),
        executor: String(fd.get("executor") ?? ""),
        aberto_em: String(fd.get("aberto_em") ?? ""),
        enviado_em: String(fd.get("enviado_em") ?? ""),
        previsto_para: String(fd.get("previsto_para") ?? ""),
        concluido_em: String(fd.get("concluido_em") ?? ""),
        valor: String(fd.get("valor") ?? "0"),
        responsabilidade: resp,
        garantia_dias: String(fd.get("garantia_dias") ?? ""),
        observacoes: String(fd.get("observacoes") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(reparo.id ? "Ordem salva." : "Ordem de reparo aberta.");
      if (!reparo.id && r.id) router.push(`/frota/reparos/${r.id}`);
      else router.refresh();
    });
  }

  const somenteLeitura = !podeEditar;
  // 'concluido' fica de fora do seletor: concluir é o outro formulário, porque
  // é o passo que devolve a peça ao pátio.
  const statusOferecidos = STATUS_REPARO.filter((s) => s !== "concluido");

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="unidade_id">Peça</Label>
        <NativeSelect
          id="unidade_id"
          name="unidade_id"
          required
          disabled={somenteLeitura || pendente || Boolean(reparo.id)}
          defaultValue={reparo.unidade_id}
        >
          <option value="">Selecione a peça…</option>
          {pecas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.identificador} — {p.descricao}
              {p.situacao === "manutencao" ? " (já em manutenção)" : ""}
            </option>
          ))}
        </NativeSelect>
        {reparo.id ? (
          // Trocar a peça de uma ordem já emitida deixaria o documento impresso
          // apontando para outra máquina — e é ele que viajou com a primeira.
          <p className="text-xs text-muted-foreground">
            A peça não muda depois que a ordem é aberta. Se estiver errada,
            cancele esta ordem e abra outra.
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="descricao">Serviço a executar</Label>
        <Textarea
          id="descricao"
          name="descricao"
          rows={3}
          required
          maxLength={2000}
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.descricao}
          placeholder="O que precisa ser feito. Este texto vai na ordem que segue com a máquina."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="executor">Oficina / executor</Label>
        <Input
          id="executor"
          name="executor"
          maxLength={200}
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.executor ?? ""}
          placeholder="Quem vai fazer o serviço"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="status">Situação</Label>
        <NativeSelect
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusReparo)}
          disabled={somenteLeitura || pendente}
        >
          {statusOferecidos.map((s) => (
            <option key={s} value={s}>
              {STATUS_REPARO_INFO[s].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {STATUS_REPARO_INFO[status].ajuda}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="aberto_em">Aberta em</Label>
        <Input
          id="aberto_em"
          name="aberto_em"
          type="date"
          required
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.aberto_em}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="enviado_em">Saída da obra</Label>
        <Input
          id="enviado_em"
          name="enviado_em"
          type="date"
          required={status === "em_execucao"}
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.enviado_em ?? ""}
        />
        {/* É esta data que inicia a contagem de indisponibilidade da peça — a
            resposta para "há quanto tempo esta máquina está fora". */}
        <p className="text-xs text-muted-foreground">
          Obrigatória quando a ordem passa a Em execução.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="previsto_para">Previsão de retorno</Label>
        <Input
          id="previsto_para"
          name="previsto_para"
          type="date"
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.previsto_para ?? ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="valor">Valor do serviço</Label>
        <Input
          id="valor"
          name="valor"
          type="number"
          step="0.01"
          min="0"
          inputMode="decimal"
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.valor || ""}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="garantia_dias">Garantia (dias)</Label>
        <Input
          id="garantia_dias"
          name="garantia_dias"
          type="number"
          min="0"
          step="1"
          inputMode="numeric"
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.garantia_dias ?? ""}
          placeholder="Em branco = sem garantia declarada"
        />
      </div>

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="responsabilidade">Quem paga</Label>
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
      </div>

      {/* Campo escondido: o schema exige `concluido_em` quando o status é
          'concluido', e esse caminho é do outro formulário — mas o valor
          existente precisa sobreviver a um salvamento comum. */}
      <input type="hidden" name="concluido_em" value={reparo.concluido_em ?? ""} />

      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          name="observacoes"
          rows={2}
          maxLength={2000}
          disabled={somenteLeitura || pendente}
          defaultValue={reparo.observacoes ?? ""}
          placeholder="O que saiu junto com a peça, condições combinadas, contato da oficina."
        />
      </div>

      <div className="sm:col-span-2">
        <FormError>{erro}</FormError>
      </div>

      {podeEditar ? (
        <div className="sm:col-span-2">
          <Button type="submit" size="sm" disabled={pendente}>
            {pendente ? "Salvando…" : reparo.id ? "Salvar ordem" : "Abrir ordem"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Ordem concluída: ela registra um custo pago e um serviço feito, e não é
          mais editável.
        </p>
      )}
    </form>
  );
}

export function ConcluirReparo({
  reparoId,
  peca,
  valor,
  hoje,
}: {
  reparoId: string;
  peca: string | null;
  valor: number;
  hoje: string;
}) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fd = new FormData(evento.currentTarget);
    startTransition(async () => {
      const r = await concluirReparo({
        id: reparoId,
        concluido_em: String(fd.get("concluido_em") ?? ""),
        valor: String(fd.get("valor") ?? ""),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      toast.success(r.aviso ?? "Ordem concluída.");
      router.refresh();
    });
  }

  return (
    <form onSubmit={enviar} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Concluir devolve a peça <strong>{peca ?? ""}</strong> ao pátio: ela sai de
        manutenção e volta a aparecer como disponível em todas as telas.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="concluido_em">Concluída em</Label>
          <Input
            id="concluido_em"
            name="concluido_em"
            type="date"
            required
            className="w-44"
            disabled={pendente}
            defaultValue={hoje}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="valor_final">Valor final</Label>
          <Input
            id="valor_final"
            name="valor"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            className="w-40"
            disabled={pendente}
            defaultValue={valor || ""}
          />
        </div>
        <Button type="submit" size="sm" disabled={pendente}>
          {pendente ? "Concluindo…" : "Concluir ordem"}
        </Button>
      </div>
      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
    </form>
  );
}
