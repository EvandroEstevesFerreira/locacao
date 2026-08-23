// PageHeader — cabeçalho padrão de página interna.
// Padroniza spacing, tipografia e slot de ações. Wrap responsivo em mobile.
//
// A prop `eyebrow` (rótulo em maiúsculas no vermelho da marca) saiu na v0.20:
// era o único uso da classe .eyebrow, um motivo visual que não existe na
// identidade Sistenge 2026. Em 24 dos 26 casos ela repetia literalmente o pai
// que o breadcrumb passa a mostrar ("Locação", "Configurações", "Imóveis") —
// contexto agora vem da navegação, não de um rótulo em cada página.
//
// `children` virou `acoes` (nome do Sistenge People) para deixar explícito que
// o slot é de botões, não de conteúdo. `descricao` aceita ReactNode para as
// listas poderem usar a frase de estatística ao vivo.
//
// Uso:
//   <PageHeader
//     titulo="Contratos"
//     descricao="12 contratos no filtro · 8 ativos"
//     acoes={<Button render={<Link href="/contratos/novo" />}>Novo</Button>}
//   />

import { cn } from "@/lib/utils";

export function PageHeader({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {titulo}
        </h1>
        {descricao ? (
          <div className="mt-1 text-sm text-muted-foreground">{descricao}</div>
        ) : null}
      </div>
      {acoes ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>
      ) : null}
    </div>
  );
}
