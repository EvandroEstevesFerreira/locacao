"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botão "Voltar" para a tela anterior. Oculto no Início. */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      aria-label="Voltar para a tela anterior"
    >
      <ChevronLeft className="size-4" />
      Voltar
    </Button>
  );
}
