"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * COLUNA FIXA — como usar.
 *
 * A tabela rola na horizontal (`overflow-x-auto`) e toda célula é
 * `whitespace-nowrap`, então em listas largas (fornecedores, com nome de 40+
 * caracteres mais CNPJ, contato, obras, status e ações) a linha estoura o card.
 * Sem coluna fixa, rolar para a direita até a lixeira empurra o NOME para fora
 * da tela, e ficar à esquerda esconde as AÇÕES — o usuário nunca vê os dois.
 *
 * Marque a primeira coluna com `fixa` e a de ações com `fixaFim`, no
 * `TableHead` e no `TableCell`. O fundo opaco é obrigatório: sem ele o conteúdo
 * que rola aparece por baixo da coluna fixa.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // `group/row` existe para as colunas fixas: elas têm fundo próprio
        // (senão o conteúdo rolando aparece por baixo) e precisam acompanhar o
        // hover da linha, o que `hover:` no <tr> não alcança.
        "group/row border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

/** Classes da coluna fixa à esquerda (primeira) e à direita (ações). */
export const colunaFixa =
  "sticky left-0 z-20 bg-card group-hover/row:bg-muted/50 border-r"
export const colunaFixaFim =
  "sticky right-0 z-20 bg-card group-hover/row:bg-muted/50 border-l"

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 px-4 text-left align-middle font-medium whitespace-nowrap text-muted-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
