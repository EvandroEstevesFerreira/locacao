import Link from "next/link";
import type { CategoriaTrilhoFrota } from "@/lib/data/frota";

/**
 * O trilho de categorias da Frota.
 *
 * Gêmeo do trilho de Itens, de propósito: as duas telas passam a ter a mesma
 * gramática — categoria navega à esquerda, tipo agrupa à direita. Quem aprende
 * uma sabe a outra.
 *
 * A diferença está no que se conta. Em Itens a categoria diz quantos MODELOS o
 * catálogo tem; aqui, quantas PEÇAS existem no pátio — e quantas estão em uso,
 * porque é a folga que decide se dá para remanejar.
 *
 * É NAVEGAÇÃO e não filtro: cada linha mostra o total DAQUELA categoria mesmo
 * quando outra está selecionada. Quem está em Veículos precisa ver que TI tem
 * 128 peças para decidir ir até lá.
 *
 * Server component: são links. O botão "voltar" funciona e a URL pode ser
 * colada para alguém.
 */
export function TrilhoFrota({
  categorias,
  selecionada,
  totalPecas,
  href,
}: {
  categorias: CategoriaTrilhoFrota[];
  /** `""` = todas; `"sem"` = peças sem categoria; senão o id. */
  selecionada: string;
  totalPecas: number;
  /** Monta a URL preservando busca, obra e os demais filtros. */
  href: (categoria: string) => string;
}) {
  const linhas = [
    { chave: "", nome: "Todas", pecas: totalPecas, emUso: -1 },
    ...categorias.map((c) => ({
      chave: c.id ?? "sem",
      nome: c.nome,
      pecas: c.pecas,
      emUso: c.emUso,
    })),
  ];

  return (
    <nav
      aria-label="Categorias"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
    >
      <p className="hidden px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground lg:block">
        Categorias
      </p>

      {linhas.map((l) => {
        const ativa = selecionada === l.chave;
        return (
          <Link
            key={l.chave || "todas"}
            href={href(l.chave)}
            aria-current={ativa ? "page" : undefined}
            className={[
              "flex shrink-0 items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap",
              "hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              ativa
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground",
            ].join(" ")}
          >
            <span>{l.nome}</span>
            {/* Categoria sem peça mostra travessão e não zero: "0" convida a
                clicar para ver nada, o travessão diz que não há o que ver. */}
            <span className="tabular-nums text-xs text-muted-foreground">
              {l.pecas > 0 ? l.pecas : "—"}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
