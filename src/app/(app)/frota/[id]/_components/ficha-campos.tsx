"use client";

// Os campos da ficha da peça, desenhados a partir do que o TIPO define.
//
// Fica em componente próprio, com estado próprio, e não dentro do
// `react-hook-form` do resto do cadastro: os campos mudam por configuração, e o
// RHF precisa conhecer a forma do formulário no momento em que é criado.
// Registrar campos que nascem de um jsonb exigiria `useFieldArray` sobre um
// schema que não existe em tempo de compilação — o custo não paga.
//
// A validação de verdade é do servidor (`validarFicha`), contra a definição do
// tipo. Aqui é só a coleta.

import { useState } from "react";
import type { CampoFicha } from "@/lib/catalogo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export function useFicha(inicial: Record<string, unknown>) {
  const [ficha, setFicha] = useState<Record<string, unknown>>(inicial);
  return {
    ficha,
    definir: (chave: string, valor: unknown) =>
      setFicha((f) => ({ ...f, [chave]: valor })),
  };
}

export function FichaCampos({
  campos,
  ficha,
  definir,
  desabilitado,
}: {
  campos: CampoFicha[];
  ficha: Record<string, unknown>;
  definir: (chave: string, valor: unknown) => void;
  desabilitado: boolean;
}) {
  if (campos.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {campos.map((c) => {
        const id = `ficha-${c.chave}`;
        const valor = ficha[c.chave];

        return (
          <div key={c.chave} className="space-y-1.5">
            {c.tipo === "sim_nao" ? (
              <label className="flex items-center gap-2 pt-6 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  className="size-4"
                  disabled={desabilitado}
                  checked={valor === true}
                  onChange={(e) => definir(c.chave, e.target.checked)}
                />
                {c.rotulo}
                {c.obrigatorio ? <span aria-hidden> *</span> : null}
              </label>
            ) : (
              <>
                <Label htmlFor={id}>
                  {c.rotulo}
                  {c.unidade ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      ({c.unidade})
                    </span>
                  ) : null}
                  {!c.obrigatorio ? (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      (opcional)
                    </span>
                  ) : null}
                </Label>

                {c.tipo === "lista" ? (
                  <NativeSelect
                    id={id}
                    disabled={desabilitado}
                    value={typeof valor === "string" ? valor : ""}
                    onChange={(e) => definir(c.chave, e.target.value)}
                  >
                    <option value="">—</option>
                    {c.opcoes.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id={id}
                    type={
                      c.tipo === "numero"
                        ? "number"
                        : c.tipo === "data"
                          ? "date"
                          : "text"
                    }
                    // `step="any"` porque altura e carga têm decimal, e o
                    // padrão do `type=number` é 1 — o navegador recusaria 1,5
                    // sem dizer por quê.
                    step={c.tipo === "numero" ? "any" : undefined}
                    inputMode={c.tipo === "numero" ? "decimal" : undefined}
                    maxLength={c.tipo === "texto" ? 200 : undefined}
                    disabled={desabilitado}
                    value={valor == null ? "" : String(valor)}
                    onChange={(e) => definir(c.chave, e.target.value)}
                  />
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
