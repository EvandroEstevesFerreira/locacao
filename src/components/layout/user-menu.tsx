"use client";

// Menu do usuário, no canto superior direito.
//
// Duas mudanças na v0.21:
//
// 1. Deixou de ser um dropdown feito à mão (useState + listeners de mousedown e
//    Esc) e passou a usar ui/dropdown-menu.tsx, que já estava no projeto com 268
//    linhas e zero imports. De graça vêm navegação por setas, trap e restauração
//    de foco, e portal — este último é essencial agora, porque o header tem
//    backdrop-blur e um popup `absolute` declarado dentro dele ficaria preso no
//    containing block criado pelo filtro.
// 2. Absorveu o rodapé rico que a sidebar tinha (avatar, nome, papel, "Meu
//    perfil" e "Sair"). Com a sidebar em 72px aquele bloco não caberia — o
//    conteúdo não foi cortado, foi movido para onde já existia um menu.

import Link from "next/link";
import { LogOut, Sparkles, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAPEL_INFO, type Papel } from "@/lib/permissoes";

export function UserMenu({
  nome,
  email,
  papel,
  versao,
}: {
  nome: string;
  email: string;
  papel: string;
  versao: string;
}) {
  const iniciais = (nome || email)
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const papelLabel = PAPEL_INFO[papel as Papel]?.label ?? papel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Abrir menu do usuário"
        className="flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar className="size-8">
          <AvatarFallback>{iniciais}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      {/* w-64 é obrigatório: o Content do primitivo usa w-(--anchor-width),
          ou seja, dimensiona pela largura do gatilho — que aqui é um avatar
          de 32px. */}
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex flex-col px-2 py-1.5">
          <span className="truncate text-sm font-medium">{nome || email}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
          <span className="mt-1 text-xs text-muted-foreground">{papelLabel}</span>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<Link href="/perfil" />}>
          <UserRound />
          Meu perfil
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/novidades" />}>
          <Sparkles />
          Novidades
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            v{versao}
          </span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Sair continua sendo um POST para /auth/signout — o item do menu só
            envia o formulário, para não trocar uma mutação por um GET. */}
        <form action="/auth/signout" method="post">
          <DropdownMenuItem
            variant="destructive"
            render={<button type="submit" className="w-full" />}
            closeOnClick={false}
          >
            <LogOut />
            Sair
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
