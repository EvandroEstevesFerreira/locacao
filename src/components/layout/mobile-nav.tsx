"use client";

// Gaveta de navegação em mobile — substitui a barra inferior.
//
// A barra anterior reaproveitava a lista VERTICAL da sidebar dentro de um
// `overflow-x-auto`, então em telas pequenas os 11 itens ficavam empilhados num
// scroll horizontal: o pior canto do layout antigo.
//
// Por que Base UI Dialog e não um overlay `fixed` declarado aqui: o header tem
// `backdrop-blur`, e `backdrop-filter` cria um novo containing block para
// descendentes `position: fixed` (Filter Effects spec) — um overlay declarado
// dentro do header ficaria preso a ele. O Dialog.Portal move o conteúdo para o
// body e resolve isso, além de dar trap e restauração de foco, Esc e trava de
// scroll, que a versão do Sistenge People (createPortal à mão) não tem.
//
// Não dá para usar ui/dialog.tsx: o DialogContent dele embute
// `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`, e o tailwind-merge não
// considera `top-1/2` conflitante com `inset-y-0` — as duas viriam e o painel
// ficaria torto.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronsRight, Menu, X } from "lucide-react";
import { SistengeLogo } from "@/components/sistenge-logo";
import { Button } from "@/components/ui/button";
import { NavIcon } from "./nav-icon";
import type { NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function MobileNav({
  itens,
  versao,
}: {
  itens: readonly NavItem[];
  versao: string;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const [rotaAnterior, setRotaAnterior] = useState(pathname);

  // Fecha ao trocar de rota — o Link não fecha o Dialog sozinho.
  // Ajuste de estado durante o render, o padrão que o React documenta para
  // reagir à mudança de uma prop. Um useEffect aqui seria reprovado pelo lint
  // react-hooks/set-state-in-effect e provocaria um render a mais; um onClick
  // no Link resolveria o caso comum mas deixaria a gaveta aberta quando a
  // navegação vem do botão voltar do navegador.
  if (rotaAnterior !== pathname) {
    setRotaAnterior(pathname);
    setAberto(false);
  }

  return (
    <Dialog.Root open={aberto} onOpenChange={setAberto}>
      <Dialog.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Abrir menu de navegação"
          />
        }
      >
        <Menu />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r bg-card shadow-xl outline-none md:hidden",
            "duration-300 data-open:animate-in data-open:slide-in-from-left-full",
            "data-closed:animate-out data-closed:slide-out-to-left-full",
          )}
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b px-5">
            <Dialog.Title className="sr-only">Navegação</Dialog.Title>
            <Link href="/" aria-label="Loca — início" className="flex items-center">
              <SistengeLogo className="h-6.5 w-auto" />
            </Link>
            <Dialog.Close
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Fechar menu" />
              }
            >
              <X />
            </Dialog.Close>
          </div>

          <div className="scrollbar-sutil flex-1 overflow-y-auto p-3">
            <nav aria-label="Navegação principal" className="flex flex-col gap-0.5">
              {itens.map((item, i) => {
                const ativo =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <div key={item.href} className="contents">
                    {item.separadorAntes ? (
                      <div className="my-1.5 h-px bg-border" aria-hidden />
                    ) : null}
                    {/* Mesmo agrupamento da sidebar. No celular ele importa
                        mais: a lista inteira não cabe na tela. */}
                    {item.grupo && item.grupo !== itens[i - 1]?.grupo ? (
                      <p className="mt-3 mb-1 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                        {item.grupo}
                      </p>
                    ) : null}
                    <Link
                      href={item.href}
                      aria-current={ativo ? "page" : undefined}
                      className={cn(
                        "flex h-11 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        ativo
                          ? "bg-primary font-medium text-primary-foreground"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <NavIcon name={item.icon} className="size-5 shrink-0" />
                      {item.label}
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>

          <Link
            href="/novidades"
            className="flex h-12 shrink-0 items-center gap-3.5 border-t px-5 font-mono text-[11px] text-muted-foreground"
          >
            <ChevronsRight className="size-4.5 shrink-0 opacity-70" aria-hidden />
            Loca · v{versao}
          </Link>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
