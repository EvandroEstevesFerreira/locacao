"use client";

// O que as PEÇAS deste tipo precisam ter em dia.
//
// Irmão do `ficha-editor`, e de propósito: a ficha diz o que a peça É, a
// exigência diz o que ela precisa TER — e as duas são declaradas no tipo porque
// valem para a família inteira. Toda PTA precisa de inspeção; nenhuma delas
// precisa que alguém lembre disso peça a peça.
//
// Diferente da ficha, aqui NÃO há reordenar: a ordem dos campos da ficha é a
// ordem em que a pessoa preenche, e carrega significado. A ordem das exigências
// não — a tela da peça já as reordena pela gravidade.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  ESPECIES_CERTIFICADO,
  ESPECIE_INFO,
  type EspecieCertificado,
  type Exigencia,
} from "@/lib/certificado";
import { salvarExigenciasDoTipo } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/** Uma exigência enquanto está sendo editada: a periodicidade é texto no input. */
type EmEdicao = { especie: EspecieCertificado; periodicidade: string };

const paraEdicao = (e: Exigencia[]): EmEdicao[] =>
  e.map((x) => ({
    especie: x.especie,
    periodicidade: x.periodicidade_meses === null ? "" : String(x.periodicidade_meses),
  }));

const paraGravar = (e: EmEdicao[]) =>
  e.map((x) => ({
    especie: x.especie,
    periodicidade_meses: x.periodicidade.trim() === "" ? null : x.periodicidade.trim(),
  }));

export function ExigenciasEditor({
  tipoId,
  tipoNome,
  exigencias: iniciais,
  aoConcluir,
}: {
  tipoId: string;
  tipoNome: string;
  exigencias: Exigencia[];
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const [lista, setLista] = useState<EmEdicao[]>(() => paraEdicao(iniciais));
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const sujo =
    JSON.stringify(paraGravar(lista)) !==
    JSON.stringify(paraGravar(paraEdicao(iniciais)));

  // A espécie que ainda não foi usada — a lista não aceita repetida, e oferecer
  // uma que vai ser recusada no salvar é fazer a pessoa descobrir tarde.
  const disponivel = ESPECIES_CERTIFICADO.find(
    (e) => !lista.some((x) => x.especie === e),
  );

  function acrescentar() {
    if (!disponivel) return;
    setLista((l) => [...l, { especie: disponivel, periodicidade: "12" }]);
  }

  function alterar(i: number, mudanca: Partial<EmEdicao>) {
    setLista((l) => l.map((x, n) => (n === i ? { ...x, ...mudanca } : x)));
  }

  function remover(i: number) {
    setLista((l) => l.filter((_, n) => n !== i));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarExigenciasDoTipo({
        tipo_id: tipoId,
        exigencias: paraGravar(lista),
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      // O aviso de exigência removida é longo e importa: vai de toast com
      // duração maior, porque quem tira uma exigência precisa ler que o alerta
      // para de chegar.
      if (r.aviso) toast.warning(r.aviso, { duration: 12_000 });
      else toast.success("Exigências salvas.");
      router.refresh();
      aoConcluir();
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">
          O que as peças de {tipoNome} precisam ter em dia
        </p>
        <p className="text-xs text-muted-foreground">
          Cada exigência aparece na tela da peça — inclusive quando não há
          certificado nenhum, que é o caso que interdita máquina.
        </p>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Este tipo não exige certificado. É o normal para notebook e ferramenta
          manual; PTA, talha e ar-condicionado exigem.
        </p>
      ) : (
        <div className="space-y-2">
          {lista.map((x, i) => (
            <div
              key={`${x.especie}-${i}`}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            >
              <div className="space-y-1">
                <Label htmlFor={`especie-${i}`}>Exigência</Label>
                <NativeSelect
                  id={`especie-${i}`}
                  value={x.especie}
                  onChange={(e) =>
                    alterar(i, { especie: e.target.value as EspecieCertificado })
                  }
                >
                  {ESPECIES_CERTIFICADO.map((e) => (
                    <option
                      key={e}
                      value={e}
                      // Espécie já usada em outra linha fica desabilitada, e não
                      // escondida: escondê-la faria a linha atual perder a
                      // própria opção selecionada.
                      disabled={e !== x.especie && lista.some((y) => y.especie === e)}
                    >
                      {ESPECIE_INFO[e].label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">
                  {ESPECIE_INFO[x.especie].ajuda}
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor={`periodicidade-${i}`}>Renova a cada</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`periodicidade-${i}`}
                    type="number"
                    min={1}
                    max={120}
                    inputMode="numeric"
                    className="w-24"
                    value={x.periodicidade}
                    onChange={(e) => alterar(i, { periodicidade: e.target.value })}
                    placeholder="12"
                  />
                  <span className="text-sm text-muted-foreground">meses</span>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remover ${ESPECIE_INFO[x.especie].label}`}
                onClick={() => remover(i)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Deixe a periodicidade em branco quando o documento não se renova por
        calendário — a ART vale enquanto o profissional responde pelo
        equipamento. A tela só deixa de propor o vencimento; a exigência continua
        valendo.
      </p>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={acrescentar}
          disabled={!disponivel}
        >
          <Plus className="size-3.5" aria-hidden />
          Acrescentar exigência
        </Button>
        {sujo ? (
          <Button size="sm" onClick={salvar} disabled={pendente}>
            <ShieldCheck className="size-3.5" aria-hidden />
            {pendente ? "Salvando…" : "Salvar exigências"}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={aoConcluir} disabled={pendente}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
