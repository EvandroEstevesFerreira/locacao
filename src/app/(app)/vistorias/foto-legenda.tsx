"use client";

import { useState, useTransition } from "react";
import { salvarLegendaFoto } from "./actions";

/** Campo de legenda por foto; salva ao sair do campo (onBlur). */
export function FotoLegenda({
  fotoId,
  vistoriaId,
  defaultValue = "",
}: {
  fotoId: string;
  vistoriaId: string;
  defaultValue?: string;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [salvo, setSalvo] = useState(false);
  const [, startTransition] = useTransition();

  function salvar() {
    if (valor === defaultValue) return;
    startTransition(async () => {
      await salvarLegendaFoto(fotoId, vistoriaId, valor);
      setSalvo(true);
    });
  }

  return (
    <input
      value={valor}
      onChange={(e) => {
        setValor(e.target.value);
        setSalvo(false);
      }}
      onBlur={salvar}
      placeholder="Legenda…"
      title={salvo ? "Legenda salva" : "Digite e clique fora para salvar"}
      maxLength={200}
      className="mt-1 w-full border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:border-ring"
    />
  );
}
