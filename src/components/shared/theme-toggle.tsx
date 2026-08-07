"use client";

// Alterna entre tema claro e escuro.
//
// O guard de hidratação é obrigatório, não zelo excessivo: no servidor não se
// sabe qual tema o script do next-themes vai escolher, então renderizar o ícone
// final causaria hydration mismatch. O placeholder tem exatamente o tamanho do
// botão, para não haver salto de layout.
//
// Usamos `useSyncExternalStore` com snapshots diferentes por ambiente em vez do
// par `useState(false)` + `useEffect(() => setMontado(true))` do Sistenge
// People. Além de ser o padrão idiomático do React 19 (o lint
// react-hooks/set-state-in-effect reprova o outro, com razão), evita o render
// extra que o efeito provoca.

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

const semInscricao = () => () => {};
const noCliente = () => true;
const noServidor = () => false;

export function ThemeToggle() {
  const montado = useSyncExternalStore(semInscricao, noCliente, noServidor);
  const { resolvedTheme, setTheme } = useTheme();

  if (!montado) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-hidden
        tabIndex={-1}
        className="opacity-50"
      >
        <Sun />
      </Button>
    );
  }

  const escuro = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(escuro ? "light" : "dark")}
      aria-label={escuro ? "Usar tema claro" : "Usar tema escuro"}
      title={escuro ? "Usar tema claro" : "Usar tema escuro"}
    >
      {escuro ? <Sun /> : <Moon />}
    </Button>
  );
}
