"use client";

// O construtor de campos da ficha de um tipo.
//
// A LISTA INTEIRA é salva de uma vez, e não campo a campo: a ORDEM faz parte da
// definição — é a ordem em que a pessoa preenche a ficha da peça — e salvar
// campo a campo exigiria uma coluna de ordem e uma ação de reordenar. O array
// já carrega as duas coisas.
//
// Por isso o estado vive todo aqui, e o botão de salvar aparece só quando há o
// que salvar: sem isso, quem reordena um campo e sai da tela perde a mudança
// sem perceber.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_INFO,
  campoNovo,
  comRotulo,
  paraEdicao,
  paraGravar,
  type CampoEmEdicao,
  type CampoFicha,
  type TipoCampo,
} from "@/lib/catalogo";
import { salvarCamposDoTipo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function FichaEditor({
  tipoId,
  tipoNome,
  campos: iniciais,
  aoConcluir,
}: {
  tipoId: string;
  tipoNome: string;
  campos: CampoFicha[];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [campos, setCampos] = useState<CampoEmEdicao[]>(() => paraEdicao(iniciais));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const sujo = JSON.stringify(paraGravar(campos)) !== JSON.stringify(iniciais);

  function acrescentar() {
    setCampos((c) => [...c, campoNovo()]);
  }

  function alterar(i: number, mudanca: Partial<CampoEmEdicao>) {
    setCampos((c) => c.map((campo, n) => (n === i ? { ...campo, ...mudanca } : campo)));
  }

  function remover(i: number) {
    setCampos((c) => c.filter((_, n) => n !== i));
  }

  function mover(i: number, passo: -1 | 1) {
    setCampos((c) => {
      const destino = i + passo;
      if (destino < 0 || destino >= c.length) return c;
      const copia = [...c];
      [copia[i], copia[destino]] = [copia[destino], copia[i]];
      return copia;
    });
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarCamposDoTipo({ tipo_id: tipoId, campos: paraGravar(campos) });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      setErro(null);
      // `aviso` é o caso "salvou, mas um campo saiu da ficha". Toast comum
      // diria "tudo certo" e esconderia a consequência.
      if (r.aviso) toast.warning(r.aviso, { duration: 9000 });
      else toast.success("Campos salvos.");
      aoConcluir();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Ficha de {tipoNome}</p>
        <p className="text-xs text-muted-foreground">
          Os campos que cada peça deste tipo vai pedir. Um NOTEBOOK pede memória
          e disco; um ANDAIME pede altura e carga — e é por isso que eles não são
          colunas fixas.
        </p>
      </div>

      {campos.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nenhum campo. As peças deste tipo pedem só o patrimônio e os dados
          comuns a todo equipamento.
        </p>
      ) : (
        <div className="space-y-3">
          {campos.map((c, i) => (
            <LinhaCampo
              key={i}
              campo={c}
              indice={i}
              total={campos.length}
              desabilitado={pendente}
              aoAlterar={(m) => alterar(i, m)}
              aoRemover={() => remover(i)}
              aoMover={(p) => mover(i, p)}
            />
          ))}
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={pendente}
        onClick={acrescentar}
      >
        <Plus className="size-3.5" aria-hidden />
        Novo campo
      </Button>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="flex flex-wrap items-center gap-3 border-t pt-3">
        <Button size="sm" disabled={pendente || !sujo} onClick={salvar}>
          {pendente ? "Salvando…" : "Salvar ficha"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={aoConcluir}>
          <X className="size-3.5" aria-hidden />
          Fechar
        </Button>
        {/* Sem este aviso, quem reordena um campo e fecha a tela perde a
            mudança sem perceber — o estado vive no componente, não no banco. */}
        {sujo ? (
          <span className="text-xs text-muted-foreground">
            Há mudanças não salvas.
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LinhaCampo({
  campo,
  indice,
  total,
  desabilitado,
  aoAlterar,
  aoRemover,
  aoMover,
}: {
  campo: CampoEmEdicao;
  indice: number;
  total: number;
  desabilitado: boolean;
  aoAlterar: (m: Partial<CampoEmEdicao>) => void;
  aoRemover: () => void;
  aoMover: (passo: -1 | 1) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-12">
      <div className="space-y-1.5 sm:col-span-4">
        <Label htmlFor={`rot-${indice}`}>Rótulo</Label>
        <Input
          id={`rot-${indice}`}
          value={campo.rotulo}
          maxLength={60}
          disabled={desabilitado}
          placeholder="Ex.: Memória"
          onChange={(e) => aoAlterar(comRotulo(campo, e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          chave: <code>{campo.chave || "—"}</code>
          {campo.gravado ? " (fixa)" : ""}
        </p>
      </div>

      <div className="space-y-1.5 sm:col-span-3">
        <Label htmlFor={`tipo-${indice}`}>Tipo</Label>
        <NativeSelect
          id={`tipo-${indice}`}
          value={campo.tipo}
          disabled={desabilitado}
          onChange={(e) => aoAlterar({ tipo: e.target.value as TipoCampo })}
        >
          {TIPOS_CAMPO.map((t) => (
            <option key={t} value={t}>
              {TIPO_CAMPO_INFO[t].label}
            </option>
          ))}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">
          {TIPO_CAMPO_INFO[campo.tipo].ajuda}
        </p>
      </div>

      {campo.tipo === "numero" ? (
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`un-${indice}`}>Unidade</Label>
          <Input
            id={`un-${indice}`}
            value={campo.unidade ?? ""}
            maxLength={10}
            disabled={desabilitado}
            placeholder="GB"
            onChange={(e) => aoAlterar({ unidade: e.target.value || null })}
          />
        </div>
      ) : null}

      {campo.tipo === "lista" ? (
        <div className="space-y-1.5 sm:col-span-5">
          <Label htmlFor={`op-${indice}`}>Opções</Label>
          <Input
            id={`op-${indice}`}
            value={campo.opcoes.join(", ")}
            disabled={desabilitado}
            placeholder="SSD, HDD"
            onChange={(e) =>
              aoAlterar({
                opcoes: e.target.value
                  .split(",")
                  .map((o) => o.trim())
                  .filter(Boolean),
              })
            }
          />
          {/* A lista fechada é o que impede "SSD", "ssd" e "S.S.D." na mesma
              coluna — o mesmo defeito que o campo livre de unidade produzia. */}
          <p className="text-xs text-muted-foreground">
            Separadas por vírgula.
          </p>
        </div>
      ) : null}

      <div className="flex items-end gap-1 sm:col-span-3 sm:justify-end">
        <label className="mr-auto flex items-center gap-2 pb-2 text-sm sm:mr-3">
          <input
            type="checkbox"
            className="size-4"
            checked={campo.obrigatorio}
            disabled={desabilitado}
            onChange={(e) => aoAlterar({ obrigatorio: e.target.checked })}
          />
          Obrigatório
        </label>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Mover para cima"
          disabled={desabilitado || indice === 0}
          onClick={() => aoMover(-1)}
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Mover para baixo"
          disabled={desabilitado || indice === total - 1}
          onClick={() => aoMover(1)}
        >
          <ChevronDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remover campo"
          disabled={desabilitado}
          onClick={aoRemover}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
