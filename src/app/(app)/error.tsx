"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Passa pelo logger em vez de console.error direto: ele emite JSON por
    // linha, que é o que os logs da Vercel indexam.
    logger.error("app.error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="size-5" aria-hidden />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-destructive">
            Algo deu errado
          </h1>
        </div>

        <p className="text-sm text-muted-foreground">
          {error.message || "Ocorreu um erro ao carregar esta tela."} Tente
          novamente; se continuar, informe o código abaixo ao suporte.
        </p>

        {error.digest ? (
          <p className="font-mono text-xs text-muted-foreground">
            ID do erro: {error.digest}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => reset()}>
            <RefreshCcw className="size-4" />
            Tentar novamente
          </Button>
          {/* render={<Link/>} porque Base UI não tem asChild. Antes era
              window.location.href, que descartava o estado do roteador. */}
          <Button variant="outline" render={<Link href="/" />}>
            <Home className="size-4" />
            Ir para o Início
          </Button>
        </div>
      </div>
    </div>
  );
}
