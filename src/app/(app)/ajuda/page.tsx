import Link from "next/link";
import { BookOpen } from "lucide-react";

import { manualPorRota } from "@/lib/treinamento";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Ajuda — Loca" };

/**
 * O manual: as mesmas aulas do treinamento, indexadas por tela.
 *
 * A trilha percorre na ordem em que se aprende; o manual atende quem já sabe e
 * travou. Uma fonte, duas ordens — e nenhum dos dois desatualiza sem o outro.
 *
 * Não é módulo liberável, como `/treinamento`: esconder o manual de alguém não
 * protege nada e atrapalha tudo.
 */
export default async function AjudaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().toLowerCase() ?? "";

  const indice = manualPorRota().filter((r) => {
    if (!busca) return true;
    if (r.rota.toLowerCase().includes(busca)) return true;
    return r.aulas.some(
      (a) =>
        a.aula.titulo.toLowerCase().includes(busca) ||
        a.aula.resumo.toLowerCase().includes(busca),
    );
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Ajuda"
        descricao="O que cada tela faz, indexado por tela. É o mesmo conteúdo do treinamento, na ordem de quem já sabe e travou."
      />

      <ListFilters>
        <ListSearch
          placeholder="Buscar por tela ou assunto…"
          ariaLabel="Buscar no manual"
        />
      </ListFilters>

      {indice.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Nada encontrado para “{busca}”. Tente o nome da tela, como
              “frota”, ou o assunto, como “filtro”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {indice.map((r) => (
            <Card key={r.rota}>
              <CardContent className="pt-6">
                <p className="font-mono text-sm font-medium">{r.rota}</p>
                <ul className="mt-2 space-y-2">
                  {r.aulas.map(({ trilha, aula }) => (
                    <li key={`${trilha}-${aula.id}`} className="text-sm">
                      <Link
                        href={`/treinamento/${trilha}#aula-${aula.id}`}
                        className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      >
                        <BookOpen className="size-3.5 text-muted-foreground" />
                        {aula.titulo}
                      </Link>
                      <p className="text-muted-foreground">{aula.resumo}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
