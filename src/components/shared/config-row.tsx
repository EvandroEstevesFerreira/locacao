// Linha de navegação para telas de configuração: medalhão de ícone, título,
// descrição e chevron. Vive dentro de um pai com `divide-y p-0`.
//
// Extraída de configuracoes/page.tsx, onde era local, e usada também em
// configuracoes/templates/page.tsx — que antes renderizava um Card inteiro por
// documento. Seis cards para seis linhas de "abrir para editar" era peso demais;
// o slot `extra` acomoda o badge de "Personalizado"/"Padrão" que aquela tela
// precisa mostrar.

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

export function SecaoTitulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h2>
  );
}

export function ConfigRow({
  href,
  icon: Icon,
  titulo,
  descricao,
  extra,
}: {
  href: string;
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  /** Conteúdo à direita do título — badge de estado, por exemplo. */
  extra?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{titulo}</p>
          {extra}
        </div>
        <p className="text-xs text-muted-foreground">{descricao}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
