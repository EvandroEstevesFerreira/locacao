"use client";

// Item de navegação da sidebar.
//
// A sidebar tem dois estados: 72px (só ícone) e 240px (ícone + rótulo). A
// transição é CSS puro, via `group-hover/sidebar` e `group-focus-within/sidebar`
// na <aside> pai — sem estado em React e sem botão de recolher.
//
// O `group-focus-within` é acréscimo nosso: no Sistenge People, quem navega por
// Tab percorre 11 ícones sem rótulo nenhum. Aqui a sidebar expande ao receber
// foco, então o teclado vê o mesmo que o mouse.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "./nav-icon";
import type { NavIconName } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: NavIconName;
}) {
  const pathname = usePathname();
  const ativo =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      title={label}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "flex h-10 items-center rounded-md text-sm whitespace-nowrap transition-[background-color,color,padding]",
        // Foco inset: a <aside> tem overflow-hidden, então um ring com offset
        // seria cortado na borda de 72px.
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
        // Colapsado
        "justify-center px-0",
        // Expandido (hover ou foco na sidebar)
        "group-hover/sidebar:justify-start group-hover/sidebar:gap-3 group-hover/sidebar:px-2.5",
        "group-focus-within/sidebar:justify-start group-focus-within/sidebar:gap-3 group-focus-within/sidebar:px-2.5",
        ativo
          ? "bg-primary font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <NavIcon name={icon} className="size-5 shrink-0" />
      <span className="hidden group-hover/sidebar:inline group-focus-within/sidebar:inline">
        {label}
      </span>
    </Link>
  );
}
