import Link from "next/link";
import { Package, Plus, Pencil, TriangleAlert } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { agruparPorTipo, type LinhaCatalogo } from "@/lib/itens";
import {
  listarCatalogo,
  listarTiposParaFiltro,
  listarTrilhoDeCategorias,
  TETO_CATALOGO,
} from "@/lib/data/itens";
import { TrilhoCategorias } from "./_components/trilho-categorias";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ListSearch } from "@/components/shared/list-search";
import { ListFilters } from "@/components/shared/list-filters";
import { SelectFilter } from "@/components/shared/select-filter";
import { EmptyState } from "@/components/shared/empty-state";
import { excluirItem } from "./actions";

export const metadata = { title: "Itens — Loca" };

/**
 * O catálogo, agrupado por TIPO.
 *
 * A tela plana anterior tinha seis colunas, e QUATRO delas repetiam a mesma
 * palavra em todas as 27 linhas: natureza ("Equipamento"), unidade ("un"),
 * status ("Ativo") e categoria ("TI"). Metade da largura não carregava
 * informação nenhuma — a tela não estava cheia, estava vazia com aparência de
 * cheia.
 *
 * E a coluna rotulada "Tipo" mostrava a NATUREZA. O tipo de verdade — NOTEBOOK,
 * DESKTOP, SERVIDOR, o nível 2 do catálogo de quatro níveis — estava preenchido
 * em todos os itens e não aparecia em lugar nenhum. Justamente a dimensão que
 * varia.
 *
 * Agora a tela tem a forma do catálogo: Categoria → Tipo → Item → Peça. O que
 * se repetia virou filtro; o que varia virou seção.
 */
export default async function ItensPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();
  const categoria = sp.categoria ?? "";
  const tipo = sp.tipo ?? "";

  const [{ linhas, total, truncado }, categorias, tipos] = await Promise.all([
    listarCatalogo({ q, categoria, tipo }),
    listarTrilhoDeCategorias(),
    listarTiposParaFiltro(),
  ]);

  // O trilho é navegação: trocar de categoria NÃO pode perder a busca nem o
  // filtro de tipo que a pessoa acabou de aplicar.
  const linkDaCategoria = (c: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (tipo) p.set("tipo", tipo);
    if (c) p.set("categoria", c);
    const s = p.toString();
    return s ? `/itens?${s}` : "/itens";
  };

  const categoriaAtual = categorias.find((c) => (c.id ?? "sem") === categoria);
  const totalDeModelos = categorias.reduce((n, c) => n + c.modelos, 0);

  const grupos = agruparPorTipo(linhas as LinhaCatalogo[]);
  const buscando = q.length > 0 || categoria.length > 0 || tipo.length > 0;
  const parque = linhas.reduce(
    (a, l) => ({
      pecas: a.pecas + l.pecas,
      emUso: a.emUso + l.emUso,
      locadas: a.locadas + l.locadas,
    }),
    { pecas: 0, emUso: 0, locadas: 0 },
  );

  // O catálogo inteiro está vazio — não há nem trilho a mostrar. Diferente de
  // "o filtro não achou nada", que precisa do trilho para a pessoa sair de lá.
  if (totalDeModelos === 0 && !buscando) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <PageHeader
          titulo="Itens"
          descricao="Catálogo de equipamentos e materiais — próprios e locados."
          acoes={
            podeEditar ? (
              <Button render={<Link href="/itens/novo" />}>
                <Plus className="size-4" />
                Novo item
              </Button>
            ) : null
          }
        />
        <EmptyState
          icon={<Package />}
          titulo="Nenhum item cadastrado ainda"
          descricao="O catálogo alimenta os contratos: cadastre os equipamentos e materiais que a organização aluga."
          acao={podeEditar ? { label: "Novo item", href: "/itens/novo" } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo={categoriaAtual ? categoriaAtual.nome : "Itens"}
        descricao={
          total === 0
            ? "Catálogo de equipamentos e materiais — próprios e locados."
            : `${total} ${total === 1 ? "modelo" : "modelos"} · ${parque.pecas} ${
                parque.pecas === 1 ? "peça" : "peças"
              } · ${parque.emUso} em uso${
                parque.locadas > 0 ? ` · ${parque.locadas} alugadas` : ""
              }`
        }
        acoes={
          podeEditar ? (
            <Button render={<Link href="/itens/novo" />}>
              <Plus className="size-4" />
              Novo item
            </Button>
          ) : null
        }
      />

      {/* Trilho à esquerda, lista à direita. O trilho fica FORA do bloco que
          depende do filtro: quando o filtro não acha nada, é por ele que a
          pessoa sai de onde está. */}
      <div className="flex flex-col gap-6 lg:flex-row">
        <TrilhoCategorias
          categorias={categorias}
          selecionada={categoria}
          totalModelos={totalDeModelos}
          href={linkDaCategoria}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <ListFilters>
            <ListSearch
              placeholder="Buscar por descrição ou unidade…"
              ariaLabel="Buscar item"
            />
            <SelectFilter
              param="tipo"
              label="Tipo"
              placeholder="Todos os tipos"
              opcoes={[
                ...tipos.map((t) => ({ value: t.id, label: t.nome })),
                { value: "sem", label: "Sem tipo" },
              ]}
            />
          </ListFilters>

          {/* O teto existe porque agrupar e paginar brigam: uma seção partida
              entre duas páginas mostra o total do tipo com metade dos modelos
              embaixo, e quem lê não sabe se o resto existe. */}
          {truncado ? (
            <p className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              São {total} modelos e a tela mostra os {TETO_CATALOGO} primeiros.
              Use a busca ou os filtros para chegar ao que procura.
            </p>
          ) : null}

          {grupos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhum item encontrado com esse filtro.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {grupos.map((g) => (
                <Card key={g.chave} className="overflow-hidden">
                  {/* `<details>` nativo: a seção abre e fecha sem JavaScript,
                      então funciona no primeiro render e na tela offline. */}
                  <details open>
                    <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium">{g.rotulo}</span>
                        <span className="text-sm text-muted-foreground">
                          {g.modelos} {g.modelos === 1 ? "modelo" : "modelos"}
                          {g.pecas > 0 ? (
                            <>
                              {" · "}
                              {g.pecas} {g.pecas === 1 ? "peça" : "peças"}
                              {" · "}
                              {g.emUso} em uso
                              {" · "}
                              {g.disponivel} {g.disponivel === 1 ? "livre" : "livres"}
                            </>
                          ) : null}
                          {g.locadas > 0 ? ` · ${g.locadas} alugadas` : ""}
                        </span>
                      </div>
                      {/* A nota só existe no grupo que é LACUNA, e diz a
                          consequência — não o rótulo. */}
                      {g.nota ? (
                        <p className="mt-1 text-xs text-muted-foreground">{g.nota}</p>
                      ) : null}
                    </summary>

                    <div className="divide-y border-t">
                      {g.itens.map((i) => (
                        <div
                          key={i.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
                        >
                          <Link
                            href={`/itens/${i.id}`}
                            className={`min-w-48 flex-1 font-medium hover:underline ${
                              i.ativo ? "" : "text-muted-foreground"
                            }`}
                          >
                            {i.descricao}
                            {!i.ativo ? (
                              <Badge variant="outline" className="ml-2">
                                Inativo
                              </Badge>
                            ) : null}
                          </Link>

                          {/* Item controlado por quantidade não tem peça para
                              contar; mostrar "0 peças" nele seria dizer que
                              falta alguma coisa. */}
                          {i.natureza === "equipamento" ? (
                            <span className="tabular-nums text-muted-foreground">
                              {i.pecas} {i.pecas === 1 ? "peça" : "peças"}
                              {i.pecas > 0 ? ` · ${i.emUso} em uso` : ""}
                              {i.locadas > 0 ? ` · ${i.locadas} alugadas` : ""}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              por quantidade{i.unidade ? ` · ${i.unidade}` : ""}
                            </span>
                          )}

                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar ${i.descricao}`}
                              render={<Link href={`/itens/${i.id}`} />}
                            >
                              <Pencil />
                            </Button>
                            {podeEditar ? (
                              <ConfirmDelete action={excluirItem} id={i.id} />
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
