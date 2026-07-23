"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const disponivel = item.implementado;
        const ativo =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        const Icon = item.icon;

        if (!disponivel) {
          return (
            <span
              key={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/60"
              title="Disponível em uma fase futura"
            >
              <Icon className="size-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
                em breve
              </span>
            </span>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              ativo
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
