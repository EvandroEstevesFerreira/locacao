"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { ESTADOS, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { SignaturePad } from "@/components/shared/signature-pad";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { salvarTermo, emitirTermo } from "./actions";

export type OpcaoFuncionario = { id: string; nome: string; cpf: string | null };
export type OpcaoItem = {
  id: string;
  descricao: string;
  unidade: string | null;
  controle: "peca" | "quantidade";
};
export type OpcaoPeca = { id: string; identificador: string; itemId: string };
export type OpcaoObra = { id: string; codigo: string; nome: string };

type LinhaItem = {
  item_id: string;
  unidade_id: string;
  quantidade: string;
  estado_entrega: string;
  observacoes: string;
};

const PASSOS = ["Quem e quando", "O que sai", "Assinatura"] as const;

/**
 * Emissão do termo em três passos.
 *
 * Passo a passo, e não formulário único, porque as três perguntas são de
 * naturezas diferentes — quem recebe, o que sai, quem assina — e num formulário
 * corrido a assinatura fica embaixo de uma lista de tamanho variável, onde
 * ninguém a vê.
 *
 * O rascunho é salvo ao sair do passo 2. Assim, se a assinatura na tela der
 * errado (tela suja, dedo escorregando, celular travando), o trabalho de montar
 * a lista não se perde.
 */
export function TermoWizard({
  funcionarios,
  itens,
  pecas,
  obras,
  nomeEmpresa,
}: {
  funcionarios: OpcaoFuncionario[];
  itens: OpcaoItem[];
  pecas: OpcaoPeca[];
  obras: OpcaoObra[];
  nomeEmpresa: string;
}) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  // Passo 1
  const [funcionarioId, setFuncionarioId] = useState("");
  const [obraId, setObraId] = useState("");
  const [dataEntrega, setDataEntrega] = useState(hojeISOSaoPaulo());
  const [previsao, setPrevisao] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Passo 2
  const [linhas, setLinhas] = useState<LinhaItem[]>([]);

  // Passo 3
  const [termoId, setTermoId] = useState<string | null>(null);
  const [assinaturaFunc, setAssinaturaFunc] = useState("");
  const [assinaturaEmpresa, setAssinaturaEmpresa] = useState("");

  const funcionario = funcionarios.find((f) => f.id === funcionarioId);

  function acrescentar() {
    setLinhas((l) => [
      ...l,
      { item_id: "", unidade_id: "", quantidade: "1", estado_entrega: "bom", observacoes: "" },
    ]);
  }

  function alterar(i: number, campo: keyof LinhaItem, valor: string) {
    setLinhas((l) =>
      l.map((linha, idx) => {
        if (idx !== i) return linha;
        // Trocar de item zera o patrimônio: uma peça pertence a UM item do
        // catálogo, e manter a escolha anterior gravaria a betoneira sob o
        // gerador.
        if (campo === "item_id") return { ...linha, item_id: valor, unidade_id: "" };
        return { ...linha, [campo]: valor };
      }),
    );
  }

  function avancarDoPasso1() {
    setErro(null);
    if (!funcionarioId) return setErro("Selecione o funcionário que vai receber.");
    if (!dataEntrega) return setErro("Informe a data da entrega.");
    if (previsao && previsao < dataEntrega) {
      return setErro("A previsão de devolução não pode ser anterior à entrega.");
    }
    setPasso(1);
  }

  /** Salva o rascunho e avança. O número só sai na emissão. */
  function avancarDoPasso2() {
    setErro(null);
    if (linhas.length === 0) return setErro("Adicione ao menos um item ao termo.");

    for (const [i, l] of linhas.entries()) {
      if (!l.item_id) return setErro(`Selecione o item da linha ${i + 1}.`);
      const item = itens.find((x) => x.id === l.item_id);
      if (item?.controle === "peca" && !l.unidade_id) {
        return setErro(
          `A linha ${i + 1} é controlada por peça: informe o patrimônio.`,
        );
      }
    }

    iniciar(async () => {
      const r = await salvarTermo({
        termo: {
          funcionario_id: funcionarioId,
          obra_id: obraId || null,
          data_entrega: dataEntrega,
          previsao_devolucao: previsao || null,
          observacoes: observacoes || null,
        },
        itens: linhas.map((l) => {
          const item = itens.find((x) => x.id === l.item_id);
          return {
            item_id: l.item_id,
            controle: item?.controle ?? "quantidade",
            unidade_id: l.unidade_id || null,
            quantidade: l.quantidade,
            estado_entrega: l.estado_entrega,
            observacoes: l.observacoes || null,
          };
        }),
      });
      if (!r.ok) return setErro(r.erro);
      setTermoId(r.id ?? null);
      setPasso(2);
      toast.success("Rascunho salvo. Agora é só assinar.");
    });
  }

  function emitir() {
    setErro(null);
    if (!termoId) return setErro("O rascunho não foi salvo. Volte e tente de novo.");
    if (!assinaturaFunc) {
      return setErro("O funcionário precisa assinar para o termo valer.");
    }

    iniciar(async () => {
      const r = await emitirTermo(termoId, {
        funcionario: {
          nome: funcionario?.nome ?? "",
          cpf: funcionario?.cpf ?? null,
          imagem: assinaturaFunc,
        },
        empresa: { nome: nomeEmpresa, imagem: assinaturaEmpresa || null },
      });
      if (!r.ok) return setErro(r.erro);
      toast.success("Termo emitido e numerado.");
      router.push(`/termos/${termoId}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Trilha dos passos: quem está no meio de um processo precisa saber
          quantos faltam, senão desiste no primeiro que parece longo. */}
      <ol className="flex gap-2 text-sm">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            className={
              i === passo
                ? "flex-1 border-b-2 border-primary pb-2 font-medium"
                : i < passo
                  ? "flex-1 border-b-2 border-primary/40 pb-2 text-muted-foreground"
                  : "flex-1 border-b-2 border-border pb-2 text-muted-foreground"
            }
          >
            {i + 1}. {p}
          </li>
        ))}
      </ol>

      {passo === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="funcionario">Funcionário</Label>
            <NativeSelect
              id="funcionario"
              value={funcionarioId}
              disabled={pendente}
              onChange={(e) => setFuncionarioId(e.target.value)}
            >
              <option value="">Selecione quem vai receber…</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                  {f.cpf ? ` — ${f.cpf}` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obra">
              Obra <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <NativeSelect
              id="obra"
              value={obraId}
              disabled={pendente}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Sem obra vinculada</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo} — {o.nome}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data_entrega">Data da entrega</Label>
            <Input
              id="data_entrega"
              type="date"
              value={dataEntrega}
              disabled={pendente}
              onChange={(e) => setDataEntrega(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="previsao">
              Previsão de devolução{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="previsao"
              type="date"
              value={previsao}
              disabled={pendente}
              onChange={(e) => setPrevisao(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="observacoes">
              Observações{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="observacoes"
              rows={2}
              value={observacoes}
              disabled={pendente}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {passo === 1 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              O estado na entrega é o que protege os dois lados quando o
              equipamento voltar.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={acrescentar}>
              <Plus className="size-4" />
              Acrescentar item
            </Button>
          </div>

          {linhas.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum item ainda. Acrescente o que está saindo com o funcionário.
            </p>
          ) : null}

          {linhas.map((l, i) => {
            const item = itens.find((x) => x.id === l.item_id);
            const porPeca = item?.controle === "peca";
            const pecasDoItem = pecas.filter((p) => p.itemId === l.item_id);
            return (
              <div
                key={i}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-[minmax(0,1fr)_10rem_6rem_9rem_auto]"
              >
                <NativeSelect
                  aria-label={`Item ${i + 1}`}
                  value={l.item_id}
                  disabled={pendente}
                  onChange={(e) => alterar(i, "item_id", e.target.value)}
                >
                  <option value="">Selecione o item…</option>
                  {itens.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.descricao}
                    </option>
                  ))}
                </NativeSelect>

                {/* Patrimônio só aparece para item por peça: para consumível
                    seria um campo vazio pedindo um dado que não existe. */}
                {porPeca ? (
                  <NativeSelect
                    aria-label={`Patrimônio do item ${i + 1}`}
                    value={l.unidade_id}
                    disabled={pendente}
                    onChange={(e) => alterar(i, "unidade_id", e.target.value)}
                  >
                    <option value="">Patrimônio…</option>
                    {pecasDoItem.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.identificador}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <span className="self-center text-xs text-muted-foreground">
                    por quantidade
                  </span>
                )}

                <Input
                  inputMode="decimal"
                  aria-label={`Quantidade do item ${i + 1}`}
                  value={l.quantidade}
                  disabled={pendente || porPeca}
                  onChange={(e) => alterar(i, "quantidade", e.target.value)}
                />

                <NativeSelect
                  aria-label={`Estado na entrega do item ${i + 1}`}
                  value={l.estado_entrega}
                  disabled={pendente}
                  onChange={(e) => alterar(i, "estado_entrega", e.target.value)}
                >
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_INFO[e].label}
                    </option>
                  ))}
                </NativeSelect>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Remover item ${i + 1}`}
                  disabled={pendente}
                  onClick={() => setLinhas((ls) => ls.filter((_, idx) => idx !== i))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O rascunho já está salvo. Assinar é o que numera o termo e passa as
            peças para “em uso”.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{funcionario?.nome}</p>
              <SignaturePad
                name="assinatura_funcionario"
                label="Assinatura do funcionário"
                onChange={setAssinaturaFunc}
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">{nomeEmpresa}</p>
              <SignaturePad
                name="assinatura_empresa"
                label="Assinatura da empresa (opcional)"
                onChange={setAssinaturaEmpresa}
              />
            </div>
          </div>
        </div>
      ) : null}

      <FormError>{erro}</FormError>

      <div className="flex justify-between">
        <Button
          type="button"
          variant="outline"
          disabled={passo === 0 || pendente}
          onClick={() => {
            setErro(null);
            setPasso((p) => p - 1);
          }}
        >
          <ChevronLeft className="size-4" />
          Voltar
        </Button>

        {passo === 0 ? (
          <Button type="button" disabled={pendente} onClick={avancarDoPasso1}>
            Continuar
            <ChevronRight className="size-4" />
          </Button>
        ) : passo === 1 ? (
          <Button type="button" disabled={pendente} onClick={avancarDoPasso2}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
            {pendente ? "Salvando rascunho…" : "Salvar e assinar"}
          </Button>
        ) : (
          <Button type="button" disabled={pendente} onClick={emitir}>
            {pendente ? <Loader2 className="size-4 animate-spin" /> : null}
            {pendente ? "Emitindo…" : "Emitir termo"}
          </Button>
        )}
      </div>
    </div>
  );
}
