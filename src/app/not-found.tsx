// 404 da raiz: para URLs que não casam com NENHUMA rota (/xyz, um link antigo
// que mudou de lugar).
//
// A de `(app)/not-found.tsx` não cobre este caso: ela vive dentro do grupo e só
// atende ao `notFound()` lançado por uma rota do grupo, herdando o shell — que
// exige sessão. Uma URL inexistente pode ser aberta por quem não está logado,
// então esta é autônoma: sem sidebar, sem header, sem consulta ao Supabase.
//
// Sem este arquivo o Next serve a própria tela padrão, em inglês e sem estilo.

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
