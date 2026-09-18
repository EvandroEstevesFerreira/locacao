import Link from "next/link";
import { KeyRound, Plus, Pencil, TriangleAlert } from "lucide-react";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PAGE_SIZE, contagem, parseListParams } from "@/lib/lista";
import { formatarBRL, formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { listarServicos } from "@/lib/data/servicos";
import {
  CATEGORIA_SERVICO,
  CATEGORIA_SERVICO_INFO,
  conferenciaVencida,
  type CategoriaServico,
} from "@/lib/servicos";

export const metadata = { title: "Serviços e licenças — Loca" };

export default async function ServicosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const sp = await searchParams;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["nome", "categoria", "quantidade", "conferido_em", "status"],
    defaultSort: "nome",
  });

  // A querystring é entrada do usuário: um `?categoria=x` qualquer viraria
  // `.eq("categoria","x")`, consulta recusada pelo PostgREST, lista vazia e
  // nada na tela explicando o porquê.
  const categoria = (CATEGORIA_SERVICO as readonly string[]).includes(
    sp.categoria ?? "",
  )
    ? (sp.categoria as CategoriaServico)
    : undefined;

  const { itens, total } = await listarServicos(
    { q, sort, ascending, from, to },
    categoria,
  );

  // `hojeISOSaoPaulo()`, nunca `new Date()`: a Vercel roda em UTC e das 21h à
  // meia-noite em Brasília a contagem de dias sairia um dia maior.
  const hoje = hojeISOSaoPaulo();
  const tem = itens.length > 0;
  const filtrando = q.length > 0 || !!categoria;

  return (
    <div className="pagina-lista space-y-6">
      <PageHeader
        titulo="Serviços e licenças"
        descricao={`Assinaturas e serviços recorrentes de TI. · ${contagem(total, "contrato", "contratos")} no filtro`}
        acoes={
          podeEditar ? (
            <Button render={<Link href="/servicos/novo" />}>
              <Plus className="size-4" />
              Novo serviço
            </Button>
          ) : null
        }
      />

      {tem || filtrando ? (
        <>
          <ListFilters>
            <ListSearch
              placeholder="Buscar por nome do serviço…"
              ariaLabel="Buscar serviço"
            />
            <SelectFilter
              param="categoria"
              label="Categoria"
              placeholder="Todas as categorias"
              opcoes={CATEGORIA_SERVICO.map((c) => ({
                value: c,
                label: CATEGORIA_SERVICO_INFO[c].label,
              }))}
            />
          </ListFilters>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortHeader column="nome" label="Serviço" />
                    </TableHead>
                    <TableHead>
                      <SortHeader column="categoria" label="Categoria" />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortHeader column="quantidade" label="Contratadas" />
                    </TableHead>
                    <TableHead className="text-right">Em uso</TableHead>
                    <TableHead className="text-right">Ociosas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>
                      <SortHeader column="conferido_em" label="Conferido em" />
                    </TableHead>
                    <TableHead className="w-16 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!tem ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="py-10 text-center text-muted-foreground"
                      >
                        {q
                          ? `Nenhum serviço encontrado para “${q}”.`
                          : "Nenhum serviço nesta categoria."}
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {itens.map((s) => {
                    const cat =
                      CATEGORIA_SERVICO_INFO[s.categoria] ??
                      CATEGORIA_SERVICO_INFO.outro;
                    const ociosas = s.quantidade - s.atribuidas;
                    const vencida = conferenciaVencida(s.conferido_em, hoje);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nome}</TableCell>
                        <TableCell>
                          <Badge variant={cat.variant}>{cat.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.quantidade}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {s.atribuidas}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {/* O número da tela inteira: é em cima dele que
                              alguém decide cancelar assinatura. Zero não é
                              destaque — é o estado saudável. */}
                          {ociosas > 0 ? (
                            <span className="font-semibold text-destructive">
                              {ociosas}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatarBRL(s.totalCentavos / 100)}
                        </TableCell>
                        <TableCell
                          className={
                            vencida
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        >
                          <span className="inline-flex items-center gap-1">
                            {vencida ? (
                              <TriangleAlert
                                className="size-3.5"
                                aria-label="Conferência vencida"
                              />
                            ) : null}
                            {s.conferido_em
                              ? formatarData(s.conferido_em)
                              : "Nunca conferido"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Abrir"
                              render={<Link href={`/servicos/${s.id}`} />}
                            >
                              <Pencil />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      ) : (
        <EmptyState
          icon={<KeyRound />}
          titulo="Nenhum serviço cadastrado ainda"
          descricao="Assinaturas, licenças e serviços recorrentes de TI — o custo de cada um é rateado entre os centros de custo das pessoas que os usam."
          acao={
            podeEditar
              ? { label: "Novo serviço", href: "/servicos/novo" }
              : undefined
          }
        />
      )}
    </div>
  );
}
