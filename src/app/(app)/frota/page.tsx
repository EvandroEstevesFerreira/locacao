import Link from "next/link";
import { Boxes, TriangleAlert, ArrowRight } from "lucide-react";

import {
  listarFrota,
  resumirFrota,
  listarTrilhoDaFrota,
  pecasComResponsavel,
} from "@/lib/data/frota";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import {
  SITUACOES,
  SITUACAO_INFO,
  PROPRIEDADES,
  PROPRIEDADE_INFO,
  ESTADO_INFO,
} from "@/lib/frota";
import { agruparPorTipo, pendenciasDaLista } from "@/lib/frota-agrupamento";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { listarPendenciasDoParque } from "@/lib/data/certificados";
import {
  piorPorPeca,
  ESTADO_CERTIFICADO_INFO,
  type EstadoCertificado,
} from "@/lib/certificado";
import { TrilhoFrota } from "./_components/trilho-frota";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Frota — Loca" };

/**
 * A frota, no MODELO D.
 *
 * Três decisões, e cada uma tem um porquê medido:
 *
 * 1. TRILHO DE CATEGORIA à esquerda, e não de obra. Obra tem 8 valores e não
 *    escala; categoria vai de 1 para 10 quando o equipamento de obra e os
 *    veículos entrarem. E é o mesmo eixo da tela de Itens — quem aprende uma
 *    sabe a outra. A obra continua como filtro, que já funcionava.
 *
 * 2. FAIXA DE PENDÊNCIA no topo, que SOME quando não há pendência. A urgência
 *    muda de assunto: hoje são 95 máquinas de TI entregues sem termo; em
 *    outubro serão inspeções de PTA; depois, CRLV vencido. Uma faixa permanente
 *    viraria moldura e deixaria de ser lida justamente no dia em que importa.
 *
 * 3. COLUNAS QUE SEGUEM O PERFIL da categoria. Um notebook mostra com quem
 *    está; uma PTA, a obra e a inspeção; um carro, a placa e o condutor. Uma
 *    tela só, com "com quem está" vazio em toda betoneira, ensina a ignorar a
 *    coluna.
 *
 * O QUE SAIU: a coluna "Categoria", que repetia a mesma palavra em todas as
 * linhas — agora ela é o trilho. As demais ficam: "Estado" está vazia hoje
 * porque a importação de TI não a preencheu, mas é onde o equipamento locado
 * volta marcado como avariado.
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
    categoria: um(sp.categoria) === "sem" ? undefined : um(sp.categoria),
    q: um(sp.q),
  };
  // Estes dois NÃO vão ao banco: a pendência vem de outras duas consultas, e o
  // cruzamento é aqui. Mandá-los para `listarFrota` faria a consulta procurar
  // colunas que a tabela não tem.
  const certificado = um(sp.certificado) ?? "";
  const pendencia = um(sp.pendencia) ?? "";
  const categoriaSel = um(sp.categoria) ?? "";

  const [todas, trilho, obras, pendenciasParque, comResponsavel] =
    await Promise.all([
      listarFrota(filtros),
      listarTrilhoDaFrota(),
      listarObrasParaFiltro(),
      listarPendenciasDoParque(),
      pecasComResponsavel(),
    ]);

  // `categoria=sem` é filtrado aqui porque `listarFrota` compara `categoriaId`
  // com um uuid — não há uuid para "nenhuma".
  const daCategoria =
    categoriaSel === "sem"
      ? todas.filter((p) => p.categoriaId === null)
      : todas;

  const selo = piorPorPeca(pendenciasParque);
  const visiveis = daCategoria
    .filter((p) => (certificado ? selo.get(p.id) === certificado : true))
    .filter((p) =>
      pendencia === "sem_responsavel"
        ? p.situacao === "em_uso" && comResponsavel !== null &&
          !comResponsavel.has(p.id)
        : true,
    );

  // O link do trilho preserva tudo o que a pessoa acabou de aplicar — trocar de
  // categoria é navegar, não recomeçar.
  const linkDaCategoria = (c: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      q: filtros.q,
      situacao: filtros.situacao,
      propriedade: filtros.propriedade,
      obra: filtros.obra,
      certificado,
      pendencia,
    })) {
      if (v) p.set(k, v);
    }
    if (c) p.set("categoria", c);
    const s = p.toString();
    return s ? `/frota?${s}` : "/frota";
  };

  const base = linkDaCategoria(categoriaSel).includes("?")
    ? `${linkDaCategoria(categoriaSel)}&`
    : `${linkDaCategoria(categoriaSel)}?`;

  // A faixa conta a CATEGORIA inteira, e não a lista já filtrada: senão, ao
  // clicar nela, ela continuaria lá com o mesmo número apontando para si mesma.
  // E some a que já está aplicada — quem está vendo as 95 peças sem termo não
  // precisa de um aviso dizendo que elas existem.
  const avisos = pendenciasDaLista(daCategoria, comResponsavel, selo, base).filter(
    (a) =>
      !(a.chave === "sem_responsavel" && pendencia === "sem_responsavel") &&
      !(a.chave === "certificado" && certificado !== ""),
  );
  const grupos = agruparPorTipo(visiveis);
  const resumo = resumirFrota(visiveis);
  const totalPecas = trilho.reduce((n, c) => n + c.pecas, 0);
  const atual = trilho.find((c) => (c.id ?? "sem") === categoriaSel);
  const perfil = atual?.perfil ?? "geral";
  const temFiltro =
    Object.values(filtros).some((v) => v && v !== "") ||
    certificado !== "" ||
    pendencia !== "" ||
    categoriaSel !== "";

  // A frota inteira vazia é diferente de "o filtro não achou nada": sem peça
  // nenhuma não há trilho a mostrar.
  if (todas.length === 0 && !temFiltro) {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Frota" descricao="As peças individuais do parque." />
        <EmptyState
          icon={<Boxes className="size-6" />}
          titulo="Nenhuma peça cadastrada"
          descricao="A frota é o conjunto de peças individuais — cada betoneira, cada notebook, cada carro, com seu patrimônio. Cadastre as peças no detalhe de cada item do catálogo."
          acao={{ label: "Ver catálogo de itens", href: "/itens" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={atual ? atual.nome : "Frota"}
        descricao={
          `${resumo.total} ${resumo.total === 1 ? "peça" : "peças"} · ` +
          `${resumo.emUso} em uso · ${resumo.disponiveis} ${
            resumo.disponiveis === 1 ? "livre" : "livres"
          }` +
          (resumo.manutencao > 0 ? ` · ${resumo.manutencao} em manutenção` : "") +
          (resumo.foraDeOperacao > 0
            ? ` · ${resumo.foraDeOperacao} fora de operação`
            : "")
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* O trilho fica FORA do bloco que depende do filtro: quando o filtro
            não acha nada, é por ele que a pessoa sai de onde está. */}
        <TrilhoFrota
          categorias={trilho}
          selecionada={categoriaSel}
          totalPecas={totalPecas}
          href={linkDaCategoria}
        />

        <div className="min-w-0 flex-1 space-y-4">
          <ListFilters>
            <ListSearch
              placeholder="Buscar por patrimônio, série ou item…"
              ariaLabel="Buscar peça"
            />
            <SelectFilter
              param="situacao"
              label="Situação"
              placeholder="Todas as situações"
              opcoes={SITUACOES.map((s) => ({
                value: s,
                label: SITUACAO_INFO[s].label,
              }))}
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
              param="obra"
              label="Obra"
              placeholder="Todas as obras"
              opcoes={obras.map((o) => ({
                value: o.id,
                label: `${o.codigo} — ${o.nome}`,
              }))}
            />
            {/* Só aparece quando algum tipo exige certificado. Antes disso o
                filtro não teria o que filtrar. */}
            {pendenciasParque.length > 0 ? (
              <SelectFilter
                param="certificado"
                label="Certificado"
                placeholder="Qualquer situação"
                opcoes={(
                  ["ausente", "vencido", "proximo", "em_dia"] as EstadoCertificado[]
                ).map((e) => ({
                  value: e,
                  label: ESTADO_CERTIFICADO_INFO[e].label,
                }))}
              />
            ) : null}
          </ListFilters>

          {/* A FAIXA. Some sozinha quando `avisos` está vazio — não existe
              versão "tudo em ordem" dela. */}
          {avisos.map((a) => (
            <Link
              key={a.chave}
              href={a.href}
              className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive hover:bg-destructive/15"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 font-medium">{a.texto}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          ))}

          {grupos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma peça com esse filtro.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {grupos.map((g) => (
                <Card key={g.chave} className="overflow-hidden">
                  {/* `<details>` nativo: abre e fecha sem JavaScript, então
                      funciona no primeiro render e na tela offline. */}
                  <details open>
                    <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="font-medium">{g.rotulo}</span>
                        <span className="text-sm text-muted-foreground">
                          {g.pecas.length}{" "}
                          {g.pecas.length === 1 ? "peça" : "peças"}
                          {` · ${g.emUso} em uso · ${g.disponivel} ${
                            g.disponivel === 1 ? "livre" : "livres"
                          }`}
                          {g.locadas > 0 ? ` · ${g.locadas} locadas` : ""}
                        </span>
                      </div>
                      {g.nota ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {g.nota}
                        </p>
                      ) : null}
                    </summary>

                    <div className="divide-y border-t">
                      {g.pecas.map((p) => {
                        const e = selo.get(p.id);
                        const semTermo =
                          p.situacao === "em_uso" &&
                          comResponsavel !== null &&
                          !comResponsavel.has(p.id);
                        return (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm"
                          >
                            <Link
                              href={`/frota/${p.id}`}
                              className="min-w-32 font-medium tabular-nums hover:underline"
                            >
                              {p.identificador}
                            </Link>

                            <span className="min-w-48 flex-1 text-muted-foreground">
                              {p.itemDescricao}
                              {p.ano ? ` · ${p.ano}` : ""}
                            </span>

                            {/* A COLUNA QUE MUDA DE PERFIL. Em TI e em veículo a
                                pergunta é quem está com a peça; em obra, onde
                                ela está. Hoje ninguém tem custódia aberta, e a
                                tela diz isso em vez de fingir. */}
                            <span className="min-w-40 text-muted-foreground">
                              {perfil === "geral"
                                ? (p.obraRotulo ?? "Almoxarifado central")
                                : semTermo
                                  ? "sem responsável"
                                  : (p.obraRotulo ?? "Almoxarifado central")}
                            </span>

                            <span className="flex flex-wrap items-center gap-1">
                              <Badge variant={SITUACAO_INFO[p.situacao].variant}>
                                {SITUACAO_INFO[p.situacao].label}
                              </Badge>
                              {p.propriedade === "locada" ? (
                                <Badge variant="outline">Locada</Badge>
                              ) : null}
                              {/* Certificado em dia não ganha selo: se toda
                                  linha mostrar um, o selo deixa de chamar
                                  atenção — e ele existe para isso. */}
                              {e && e !== "em_dia" ? (
                                <Badge variant={ESTADO_CERTIFICADO_INFO[e].variant}>
                                  {ESTADO_CERTIFICADO_INFO[e].label}
                                </Badge>
                              ) : null}
                              {p.estado ? (
                                <Badge variant="outline">
                                  {ESTADO_INFO[p.estado].label}
                                </Badge>
                              ) : null}
                            </span>
                          </div>
                        );
                      })}
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
