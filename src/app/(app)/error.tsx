"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na aplicação:", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
      <div className="flex size-12 items-center justify-center border border-destructive/40 text-destructive">
        <AlertTriangle className="size-6" />
      </div>
      <div>
        <h1 className="font-heading text-2xl font-semibold">
          Algo deu errado
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ocorreu um erro ao carregar esta tela. Tente novamente.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Tentar novamente</Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Ir para o Início
        </Button>
      </div>
    </div>
  );
}
