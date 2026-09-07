"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { sincronizarComPeople } from "./actions";

/**
 * "Sincronizar agora".
 *
 * O cron roda às 7h30. Este botão existe porque contratar de manhã e entregar o
 * notebook à tarde é caso real — e mandar a pessoa esperar até o dia seguinte
 * por causa disso seria limitação nossa, não do contrato com o People.
 */
export function SincronizarPeople({ ultimoSync }: { ultimoSync: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();

  function sincronizar() {
    iniciar(async () => {
      const r = await sincronizarComPeople();
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      // A contagem aparece na tela, vinda de `people_sync`, depois do refresh.
      toast.success("Base de pessoas sincronizada com o Sistenge People.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      onClick={sincronizar}
      disabled={pendente}
      title={
        ultimoSync
          ? `Última sincronização: ${ultimoSync}`
          : "Nunca sincronizado com o People"
      }
    >
      {pendente ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <RefreshCw className="size-4" />
      )}
      Sincronizar agora
    </Button>
  );
}
