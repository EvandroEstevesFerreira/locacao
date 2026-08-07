// 404 da raiz: para URLs que não casam com NENHUMA rota (/xyz, um link antigo
// que mudou de lugar).
//
// A de `(app)/not-found.tsx` não cobre este caso: ela atende só ao `notFound()`
// lançado por uma rota DE DENTRO do grupo. Um caminho que não casa com segmento
// nenhum não entra no grupo, então o Next resolve para a raiz — e sem este
// arquivo serve a própria tela padrão, em inglês e sem estilo.
//
// Fica sem shell por necessidade, não por escolha: o layout de `(app)` só se
// aplica a rotas do grupo. Na prática só usuário autenticado chega aqui — quem
// não tem sessão é desviado para /login pelo middleware antes do roteamento —,
// mas ainda assim ela não consulta o Supabase, para não depender disso.

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Endereço não encontrado — Loca" };

export default function NaoEncontradoRaiz() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Endereço não encontrado
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta página não existe. Confira o endereço ou volte ao início do
            Loca.
          </p>
        </div>
        <Button render={<Link href="/" />}>
          <Home className="size-4" />
          Ir para o Início
        </Button>
      </div>
    </div>
  );
}
