// Primitivo de card, no modelo do Sistenge People (shadcn clássico).
//
// A versão anterior era construída para a identidade "blueprint": `bg-transparent`,
// marcas de registro (+) nos quatro cantos e um sistema de spacing próprio via
// `--card-spacing`. Tudo isso existia para funcionar com `--radius: 0`.
//
// A troca não é só estética: os call sites do Loca já estavam escritos contra o
// Card clássico. Havia 21 `<CardContent className="pt-6">` (só faz sentido se
// CardContent for `p-6 pt-0`) e 5 `<CardHeader className="flex-row space-y-0">`
// (só faz sentido se CardHeader for `flex flex-col space-y-1.5`) — inertes no
// modelo antigo. Migrar conserta 26 chamadas que eram no-ops.
//
// Saíram também `CardAction` e a prop `size`, sem nenhum call site.
//
// Efeito colateral bem-vindo: como o Card deixa de ter padding vertical
// próprio, os 12 `<CardContent className="p-0">` que embrulham tabelas ficam
// flush com a borda — que é exatamente o `<div className="rounded-md border">`
// que o People usa em volta das tabelas. O Loca ganha isso sem o wrapper.

import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "text-2xl font-semibold leading-none tracking-tight",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("p-6 pt-0", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
