"use client";

// Marca "eu li esta aula", só no navegador.
//
// Não é registro de conclusão — é conveniência de quem lê em duas sessões. O
// que precisa provar a conclusão é o questionário, corrigido no servidor; uma
// tabela para "aula lida" seria uma linha por aula por pessoa por versão que
// ninguém nunca consulta. Ver o comentário em `../../actions.ts`.
//
// `useSyncExternalStore`, não `useState` + `useEffect`, pelo mesmo motivo do
// `ThemeToggle`: o servidor não sabe o que está no `localStorage` do
// navegador, então o snapshot do servidor é sempre "não lida" e o do cliente
// lê o valor real — sem o vaivém de estado que o lint
// `react-hooks/set-state-in-effect` reprova.

import { useSyncExternalStore } from "react";
import { Check } from "lucide-react";

const ouvintes = new Set<() => void>();

function avisar() {
  for (const ouvinte of ouvintes) ouvinte();
}

function inscrever(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function chave(trilhaChave: string, aulaId: string): string {
  return `loca-aula-${trilhaChave}-${aulaId}`;
}

/**
 * Lê o `localStorage`. Em aba privada ou com dados de site bloqueados, o
 * próprio acessador estoura — a página tem de renderizar certo mesmo assim.
 */
function lida(trilhaChave: string, aulaId: string): boolean {
  try {
    return window.localStorage.getItem(chave(trilhaChave, aulaId)) === "1";
  } catch {
    return false;
  }
}

function marcar(trilhaChave: string, aulaId: string) {
  try {
    window.localStorage.setItem(chave(trilhaChave, aulaId), "1");
  } catch {
    // Sem storage disponível: a marcação simplesmente não persiste.
  }
  avisar();
}

function desmarcar(trilhaChave: string, aulaId: string) {
  try {
    window.localStorage.removeItem(chave(trilhaChave, aulaId));
  } catch {
    // Idem.
  }
  avisar();
}

const snapshotServidor = () => false;

export function AulaLida({
  trilhaChave,
  aulaId,
}: {
  trilhaChave: string;
  aulaId: string;
}) {
  const marcada = useSyncExternalStore(
    inscrever,
    () => lida(trilhaChave, aulaId),
    snapshotServidor,
  );

  function alternar() {
    if (marcada) desmarcar(trilhaChave, aulaId);
    else marcar(trilhaChave, aulaId);
  }

  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground select-none">
      <input
        type="checkbox"
        className="size-4"
        checked={marcada}
        onChange={alternar}
      />
      {marcada ? (
        <span className="flex items-center gap-1 text-foreground">
          <Check className="size-3.5" />
          Aula lida
        </span>
      ) : (
        "Marcar esta aula como lida"
      )}
    </label>
  );
}
