"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { buscarCodigoMegaDoImovel } from "../../actions";
import { Button } from "@/components/ui/button";

/**
 * Busca no Mega o agente que tem o CPF/CNPJ do locador.
 *
 * UMA CHAMADA, SOB CLIQUE. Não é laço nem cron — é o botão de quem acabou de
 * digitar o documento. A conta de API é compartilhada com o Financeiro e já foi
 * bloqueada uma vez por chamada encadeada, então o botão fica desabilitado
 * enquanto a busca corre.
 */
export function BuscarCodigoMega({ imovelId }: { imovelId: string }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pendente}
      onClick={() =>
        startTransition(async () => {
          const r = await buscarCodigoMegaDoImovel(imovelId);
          if (!r.ok) {
            toast.error(r.erro);
            return;
          }
          toast.success("Locador vinculado ao agente do Mega.");
          router.refresh();
        })
      }
    >
      <Search className="size-4" aria-hidden />
      {pendente ? "Procurando…" : "Procurar no Mega"}
    </Button>
  );
}
