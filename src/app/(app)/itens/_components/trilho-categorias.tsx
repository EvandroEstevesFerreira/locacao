import Link from "next/link";
import type { CategoriaTrilho } from "@/lib/data/itens";

/**
 * O trilho de categorias da tela de Itens.
 *
 * É NAVEGAÇÃO, não filtro — e a diferença aparece nos números: cada linha mostra
 * o total DAQUELA categoria mesmo quando outra está selecionada. Quem está em
 * "Acesso e altura" precisa ver que TI tem 27 modelos para decidir ir até lá; um
 * trilho que espelha o filtro corrente só repete o que a lista já diz.
 *
 * Server component: são links, não estado. Trocar de categoria é navegar, o
 * botão "voltar" funciona, e a URL pode ser colada para alguém.
 *
 * No celular ele vira uma faixa que rola na horizontal. Uma coluna fixa de
 * 180 px num telefone de 360 px comeria metade da tela para mostrar o que não
 * se está olhando.
 */
export function TrilhoCategorias({
  categorias,
  selecionada,
  totalModelos,
  href,
}: {
  categorias: CategoriaTrilho[];
  /** `""` = todas; `"sem"` = itens sem categoria; senão o id. */
  selecionada: string;
  totalModelos: number;
  /** Monta a URL preservando busca e filtro de tipo. */
  href: (categoria: string) => string;
}) {
  const linhas = [
    { chave: "", nome: "Todas", modelos: totalModelos, pecas: 0, emUso: 0 },
    ...categorias.map((c) => ({
      chave: c.id ?? "sem",
      nome: c.nome,
      modelos: c.modelos,
      pecas: c.pecas,
      emUso: c.emUso,
    })),
  ];

  return (
    <nav
      aria-label="Categorias"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1 lg:mx-0 lg:w-52 lg:shrink-0 lg:flex-col lg:overflow-visible lg:pb-0"
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
            {/* Categoria vazia mostra travessão e não zero: "0" convida a
                clicar para ver nada, o travessão diz que não há o que ver. */}
            <span className="tabular-nums text-xs text-muted-foreground">
              {l.modelos > 0 ? l.modelos : "—"}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
