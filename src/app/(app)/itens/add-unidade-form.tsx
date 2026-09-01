"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { adicionarUnidade, type UnidadeFormState } from "./actions";
import {
  PROPRIEDADES,
  PROPRIEDADE_INFO,
  ESTADOS,
  ESTADO_INFO,
  transicoesManuais,
  SITUACAO_INFO,
} from "@/lib/frota";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Cadastro de uma peça do equipamento.
 *
 * Continua em `useActionState`, e não em `react-hook-form`: são 7 campos mas
 * NENHUMA validação cruzada, e a regra do AGENTS.md pede resolver só a partir de
 * ≥3 campos COM validação cruzada. `react-hook-form` aqui seria peso sem ganho.
 *
 * Nenhum campo além de patrimônio é obrigatório. É a mitigação deliberada do
 * risco da fatia: uma peça vale a pena com patrimônio, situação e obra; série,
 * ano e estado podem entrar depois, peça por peça, sem bloquear o cadastro.
 */
export function AddUnidadeForm({
  itemId,
  obras,
}: {
  itemId: string;
  obras: { id: string; codigo: string; nome: string }[];
}) {
  const [state, formAction, isPending] = useActionState<UnidadeFormState, FormData>(
    adicionarUnidade,
    {},
  );

  // Peça nova nasce disponível, então os destinos oferecidos são os que a matriz
  // permite a partir dali — "em uso" fica fora, porque quem define isso é o
  // termo de responsabilidade.
  const situacoes = transicoesManuais("disponivel");

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="item_id" value={itemId} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="identificador">Patrimônio</Label>
          <Input
            id="identificador"
            name="identificador"
            required
            maxLength={80}
            placeholder="PAT-0431"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="numero_serie">
            Número de série{" "}
            <span className="font-normal text-muted-foreground">(opcional)</span>
          </Label>
          <Input id="numero_serie" name="numero_serie" maxLength={80} placeholder="8891/22" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="propriedade">Propriedade</Label>
          <NativeSelect id="propriedade" name="propriedade" defaultValue="locada">
            {PROPRIEDADES.map((p) => (
              <option key={p} value={p}>
                {PROPRIEDADE_INFO[p].label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="situacao">Situação</Label>
          <NativeSelect id="situacao" name="situacao" defaultValue="disponivel">
            {situacoes.map((s) => (
              <option key={s} value={s}>
                {SITUACAO_INFO[s].label}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="obra_id">Onde está</Label>
          <NativeSelect id="obra_id" name="obra_id" defaultValue="">
            {/* Vazio não é ausência de dado: é o almoxarifado central. */}
            <option value="">Almoxarifado central</option>
            {obras.map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ano">
              Ano <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="ano"
              name="ano"
              type="number"
              min={1950}
              max={2100}
              placeholder="2026"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="estado">
              Estado{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <NativeSelect id="estado" name="estado" defaultValue="">
              <option value="">Não informado</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_INFO[e].label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="observacoes">
          Observações{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Input
          id="observacoes"
          name="observacoes"
          maxLength={300}
          placeholder="Acessórios, avarias conhecidas, quem entregou…"
        />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          <Plus className="size-4" />
          {isPending ? "Adicionando…" : "Adicionar peça"}
        </Button>
      </div>
    </form>
  );
}
