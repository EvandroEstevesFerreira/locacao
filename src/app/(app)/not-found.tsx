// Tela de endereço inexistente dentro do app.
//
// Não existia: `notFound()` é chamado em imoveis/[id], contratos/[id],
// vistorias/[id] e outras, e caía no 404 padrão do Next — uma página branca sem
// sidebar, sem header e em inglês. Estando aqui, dentro do grupo (app), ela
// herda o shell e o usuário continua navegando.

import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Endereço não encontrado — Loca" };

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <FileQuestion className="size-6" aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Endereço não encontrado
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta página não existe, ou o registro que você procurava foi
            excluído. Confira o endereço ou volte ao Início.
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
