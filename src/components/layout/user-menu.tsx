"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PAPEL_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  financeiro: "Financeiro",
  operacional: "Operacional",
  visualizador: "Visualizador",
};

export function UserMenu({
  nome,
  email,
  papel,
}: {
  nome: string;
  email: string;
  papel: string;
}) {
  const iniciais = (nome || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar className="size-8">
          <AvatarFallback>{iniciais}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="font-medium">{nome || email}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {email}
          </span>
          <span className="mt-1 text-xs font-normal text-muted-foreground">
            {PAPEL_LABEL[papel] ?? papel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" className="w-full" />}
          >
            <LogOut className="size-4" />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
