// EmptyState — estado vazio padronizado.
// Substitui os blocos `<Card className="border-dashed">` com medalhão e CTA
// espalhados pelas listagens.
//
// Não é para todo lugar sem dado: quando há filtro ativo, a linha
// `<TableCell colSpan>` é melhor, porque preserva o cabeçalho e mostra ao
// usuário sobre quais colunas ele está filtrando. E dentro de um card de seção
// (imóvel, contrato), um `<p>` mudo basta — medalhão e CTA repetidos 5× numa
// página são ruído.
//
// Uso:
//   <EmptyState
//     icon={<Package />}
//     titulo="Nenhum item no catálogo"
//     descricao="Cadastre o primeiro equipamento para começar."
//     acao={{ label: "Novo item", href: "/itens/novo" }}
//   />

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?:
    | { label: string; href: string }
    | { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full border bg-background text-muted-foreground [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      {descricao ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{descricao}</p>
      ) : null}
      {acao ? (
        <div className="mt-4">
          {"href" in acao ? (
            <Button size="sm" render={<Link href={acao.href} />}>
              {acao.label}
            </Button>
          ) : (
            <Button size="sm" onClick={acao.onClick}>
              {acao.label}
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}
