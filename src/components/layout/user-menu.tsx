"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const PAPEL_LABEL: Record<string, string> = {
  master: "Master",
  administrador: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
};

/**
 * Menu do usuário (canto superior). Dropdown próprio (sem Base UI Menu),
 * fecha ao clicar fora ou apertar Esc. Espelha os atalhos do rodapé da sidebar.
 */
export function UserMenu({
  nome,
  email,
  papel,
}: {
  nome: string;
  email: string;
  papel: string;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const iniciais = (nome || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  useEffect(() => {
    if (!aberto) return;
    function onClickFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", onClickFora);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickFora);
      document.removeEventListener("keydown", onEsc);
    };
  }, [aberto]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8">
          <AvatarFallback>{iniciais}</AvatarFallback>
        </Avatar>
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
        >
          <div className="flex flex-col px-2 py-1.5">
            <span className="text-sm font-medium">{nome || email}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
            <span className="mt-1 text-xs text-primary">
              {PAPEL_LABEL[papel] ?? papel}
            </span>
          </div>
          <div className="-mx-1 my-1 h-px bg-border" />
          <Link
            href="/perfil"
            role="menuitem"
            onClick={() => setAberto(false)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <UserRound className="size-4" />
            Meu perfil
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-4" />
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
