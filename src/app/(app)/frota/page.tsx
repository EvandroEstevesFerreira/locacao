import Link from "next/link";
import { Boxes } from "lucide-react";

import { listarFrota, resumirFrota, listarCategorias } from "@/lib/data/frota";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  SITUACOES,
  SITUACAO_INFO,
  PROPRIEDADES,
  PROPRIEDADE_INFO,
  ESTADO_INFO,
} from "@/lib/frota";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
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

export const metadata = { title: "Frota — Loca" };

/**
 * A tela que responde "onde está minha betoneira".
 *
 * Lista de PEÇAS, não de modelos: uma linha por patrimônio, com o modelo como
 * coluna. Sem ela os campos novos ficariam cadastrados e ilegíveis — não havia
 * lugar no sistema onde essa pergunta pudesse ser feita.
 *
 * Nome `/frota`, e não `/equipamentos`: "equipamento" já é um valor de
 * `tipo_item` e uma palavra usada em `/itens`; reaproveitá-la como rota faria
 * duas coisas diferentes terem o mesmo nome.
 */
export default async function FrotaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const filtros = {
    situacao: um(sp.situacao),
    propriedade: um(sp.propriedade),
    obra: um(sp.obra),
    categoria: um(sp.categoria),
    q: um(sp.q),
  };

  const [pecas, categorias, obras] = await Promise.all([
    listarFrota(filtros),
    listarCategorias(),
    listarObrasParaFiltro(),
  ]);

  const resumo = resumirFrota(pecas);
  const temFiltro = Object.values(filtros).some((v) => v && v !== "");

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Frota"
        descricao={
          `${resumo.total} ${resumo.total === 1 ? "peça" : "peças"} · ` +
          `${resumo.disponiveis} disponíveis · ${resumo.emUso} em uso · ` +
          `${resumo.manutencao} em manutenção · ${resumo.foraDeOperacao} fora de operação`
        }
      />

      <ListFilters>
        <ListSearch
          placeholder="Buscar por patrimônio, série ou descrição…"
          ariaLabel="Buscar peça"
        />
        <SelectFilter
          param="situacao"
          label="Situação"
          placeholder="Todas as situações"
          opcoes={SITUACOES.map((s) => ({ value: s, label: SITUACAO_INFO[s].label }))}
        />
        <SelectFilter
          param="propriedade"
          label="Propriedade"
          placeholder="Própria e locada"
          opcoes={PROPRIEDADES.map((p) => ({
            value: p,
            label: PROPRIEDADE_INFO[p].label,
          }))}
        />
        <SelectFilter
          param="categoria"
          label="Categoria"
          placeholder="Todas as categorias"
          opcoes={categorias.map((c) => ({ value: c.id, label: c.nome }))}
        />
        <SelectFilter
          param="obra"
          label="Obra"
          placeholder="Todas as obras"
          opcoes={obras.map((o) => ({
            value: o.id,
            label: `${o.codigo} — ${o.nome}`,
          }))}
        />
      </ListFilters>

      {pecas.length === 0 && !temFiltro ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          titulo="Nenhuma peça cadastrada"
          descricao="A frota é o conjunto de peças individuais — cada betoneira, cada notebook, com seu patrimônio. Cadastre as peças no detalhe de cada item do catálogo."
          acao={{ label: "Ver catálogo de itens", href: "/itens" }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patrimônio</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Onde está</TableHead>
                  <TableHead>Propriedade</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pecas.length === 0 ? (
                  // Linha com colSpan, e não EmptyState: preserva o cabeçalho e
                  // mostra sobre o que se está filtrando.
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Nenhuma peça no filtro atual.
                    </TableCell>
                  </TableRow>
                ) : (
                  pecas.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {p.identificador}
                        {p.numeroSerie ? (
                          <span className="block text-xs text-muted-foreground">
                            série {p.numeroSerie}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Link href={`/itens/${p.itemId}`} className="hover:underline">
                          {p.itemDescricao}
                        </Link>
                        {p.ano ? (
                          <span className="block text-xs text-muted-foreground">
                            {p.ano}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.categoriaNome ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={SITUACAO_INFO[p.situacao].variant}>
                          {SITUACAO_INFO[p.situacao].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {/* Nulo não é dado faltando: é o almoxarifado central. */}
                        {p.obraRotulo ?? "Almoxarifado central"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {PROPRIEDADE_INFO[p.propriedade].label}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.estado ? ESTADO_INFO[p.estado].label : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
