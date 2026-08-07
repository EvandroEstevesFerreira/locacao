"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Botão "Voltar" para a tela anterior. Oculto no Início.
 *
 * Fica ao lado do breadcrumb, não no lugar dele: o breadcrumb responde "onde
 * estou", este responde "como volto". Em mobile o espaço do canto esquerdo é do
 * hambúrguer, e o gesto nativo de voltar já cobre o caso — por isso o layout o
 * esconde com `hidden md:inline-flex`.
 */
export function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => router.back()}
      aria-label="Voltar para a tela anterior"
      className={className}
    >
      <ChevronLeft className="size-4" />
      Voltar
    </Button>
  );
}
