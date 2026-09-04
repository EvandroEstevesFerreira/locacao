import { Boxes, TriangleAlert, Snowflake, CircleAlert } from "lucide-react";

import {
  saldosDeEstoque,
  movimentosDeEstoque,
  itensDeEstoque,
} from "@/lib/data/estoque";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import {
  curvaABC,
  resumirEstoque,
  emRuptura,
  semGiro,
  saldoNegativo,
  TIPO_MOVIMENTO_INFO,
} from "@/lib/estoque";
import { formatarData } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MovimentoForm } from "./_components/movimento-form";
import { MovimentoEstornar } from "./_components/movimento-estornar";

export const metadata = { title: "Estoque — Loca" };

const num = (v: number) =>
  v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function Kpi({
  icon,
  label,
  valor,
  detalhe,
  alerta,
}: {
  icon: React.ReactNode;
  label: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </CardTitle>
        <span className={alerta ? "text-destructive" : "text-primary"}>{icon}</span>
      </CardHeader>
      <CardContent>
        <div
          className={
            alerta
              ? "text-2xl font-semibold tabular-nums text-destructive"
              : "text-2xl font-semibold tabular-nums"
          }
        >
          {valor}
        </div>
        {detalhe ? (
          <p className="text-xs text-muted-foreground">{detalhe}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Estoque: saldo por quantidade, com o BI que a diretoria pediu.
 *
 * Só itens `controle = 'quantidade'`. Peça de equipamento tem tela própria em
 * `/frota` — trazê-la para cá daria ao sistema duas verdades sobre onde ela
 * está.
 */
export default async function EstoquePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const filtros = { obra: um(sp.obra), q: um(sp.q) };

  const [linhas, movimentos, itens, obras, perfil] = await Promise.all([
    saldosDeEstoque(filtros),
    movimentosDeEstoque({ ...filtros, limite: 50 }),
    itensDeEstoque(),
    listarObrasParaFiltro(),
    getCurrentPerfil(),
  ]);

  // Lançar e estornar são a mesma permissão (`podeOperar`), e é a mesma que as
  // duas actions exigem. Mostrar o formulário a quem não pode lançar é um
  // beco: a pessoa preenche seis campos e leva "sem permissão" no fim.
  const podeLancar = podeOperar(perfil?.papel);

  const resumo = resumirEstoque(linhas);
  const abc = curvaABC(linhas);
  const ruptura = emRuptura(linhas);
  const parados = semGiro(linhas);
  const negativos = saldoNegativo(linhas);

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Estoque"
        descricao={`Saldo dos itens controlados por quantidade · consumo dos últimos 90 dias`}
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" />}
          titulo="Nenhum item controlado por quantidade"
          descricao="O estoque acompanha itens com controle por quantidade — cimento, escora, EPI, consumível. Equipamento controlado por peça tem tela própria em Frota."
          acao={{ label: "Ver catálogo de itens", href: "/itens" }}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={<Boxes className="size-4" />}
              label="Itens em estoque"
              valor={String(resumo.itens)}
              detalhe={`${num(resumo.saidaPeriodo)} consumidos no período`}
            />
            <Kpi
              icon={<TriangleAlert className="size-4" />}
              label="Em ruptura"
              valor={String(resumo.emRuptura)}
              detalhe="abaixo do ponto de pedido"
              alerta={resumo.emRuptura > 0}
            />
            <Kpi
              icon={<Snowflake className="size-4" />}
              label="Sem giro"
              valor={String(resumo.semGiro)}
              detalhe="com saldo e parados há 90 dias"
            />
            <Kpi
              icon={<CircleAlert className="size-4" />}
              label="Saldo negativo"
              valor={String(resumo.negativos)}
              detalhe="saiu mais do que entrou"
              alerta={resumo.negativos > 0}
            />
          </div>

          {/* Os saldos negativos vêm PRIMEIRO quando existem: é erro de
              lançamento, e erro de lançamento contamina todo o resto do painel. */}
          {negativos.length > 0 ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-destructive">
                  Saldo negativo — corrija antes de ler o resto
                </CardTitle>
                <CardDescription>
                  Saiu mais do que entrou. Ou falta lançar uma entrada, ou uma saída
                  foi lançada a mais. Enquanto isso não fechar, o consumo e a curva
                  ABC ficam distorcidos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-md border text-sm">
                  {negativos.map((l) => (
                    <div key={l.itemId} className="flex justify-between px-3 py-2">
                      <span>{l.descricao}</span>
                      <span className="font-medium text-destructive tabular-nums">
                        {num(l.saldo)} {l.unidade ?? ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          <ListFilters>
            <ListSearch placeholder="Buscar item…" ariaLabel="Buscar item no estoque" />
            <SelectFilter
              param="obra"
              label="Local"
              placeholder="Todos os locais"
              opcoes={obras.map((o) => ({
                value: o.id,
                label: `${o.codigo} — ${o.nome}`,
              }))}
            />
          </ListFilters>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Saldo por item</CardTitle>
              <CardDescription>
                Classe ABC pelo consumo do período: A são os itens que somam 80% do
                que saiu, B até 95%, C o resto. Ordenado por consumo, não por saldo —
                item parado com saldo alto é capital empatado, não item importante.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left font-medium">Item</th>
                      <th className="py-2 text-center font-medium">Classe</th>
                      <th className="py-2 text-right font-medium">Saldo</th>
                      <th className="py-2 text-right font-medium">Mínimo</th>
                      <th className="py-2 text-right font-medium">Consumo</th>
                      <th className="py-2 text-right font-medium">Parado há</th>
                    </tr>
                  </thead>
                  <tbody>
                    {abc.map((l) => {
                      const faltando = l.minimo !== null && l.saldo < l.minimo;
                      return (
                        <tr key={l.itemId} className="border-b last:border-0">
                          <td className="py-2">
                            {l.descricao}
                            {l.unidade ? (
                              <span className="ml-1 text-xs text-muted-foreground">
                                ({l.unidade})
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 text-center">
                            <Badge
                              variant={
                                l.classe === "A"
                                  ? "default"
                                  : l.classe === "B"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {l.classe}
                            </Badge>
                          </td>
                          <td
                            className={
                              faltando || l.saldo < 0
                                ? "py-2 text-right font-semibold tabular-nums text-destructive"
                                : "py-2 text-right tabular-nums"
                            }
                          >
                            {num(l.saldo)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {l.minimo === null ? "—" : num(l.minimo)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {num(l.saidaPeriodo)}
                          </td>
                          <td className="py-2 text-right tabular-nums text-muted-foreground">
                            {l.diasSemMovimento === null
                              ? "nunca movido"
                              : `${l.diasSemMovimento} d`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {ruptura.length === 0 && parados.length === 0 ? null : (
                <p className="mt-3 text-xs text-muted-foreground">
                  {ruptura.length > 0
                    ? `${ruptura.length} em ruptura. `
                    : null}
                  {parados.length > 0
                    ? `${parados.length} com saldo parado há mais de 90 dias.`
                    : null}
                </p>
              )}
            </CardContent>
          </Card>

          {podeLancar ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Lançar movimento</CardTitle>
                <CardDescription>
                  Entrada, saída, ajuste de inventário ou baixa. O lançamento não
                  pode ser editado nem apagado depois — correção é estorno, pelo
                  botão na lista abaixo, e as duas linhas ficam visíveis no razão.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MovimentoForm itens={itens} obras={obras} />
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Últimos movimentos</CardTitle>
            </CardHeader>
            <CardContent>
              {movimentos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum movimento lançado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="py-2 text-left font-medium">Data</th>
                        <th className="py-2 text-left font-medium">Item</th>
                        <th className="py-2 text-left font-medium">Tipo</th>
                        <th className="py-2 text-right font-medium">Qtd.</th>
                        <th className="py-2 text-left font-medium">Local</th>
                        <th className="py-2 text-left font-medium">Documento</th>
                        {podeLancar ? (
                          <th className="w-12 py-2 text-right font-medium">
                            <span className="sr-only">Ações</span>
                          </th>
                        ) : null}
                      </tr>
                    </thead>
                    <tbody>
                      {movimentos.map((m) => (
                        <tr
                          key={m.id}
                          className={
                            // As duas pontas de um estorno ficam esmaecidas: sem
                            // isso o leitor vê duas linhas contrárias e não sabe
                            // que uma anula a outra.
                            m.estornado || m.estornaId
                              ? "border-b text-muted-foreground line-through last:border-0"
                              : "border-b last:border-0"
                          }
                        >
                          <td className="py-2 tabular-nums">{formatarData(m.data)}</td>
                          <td className="py-2">{m.itemDescricao}</td>
                          <td className="py-2">
                            <Badge variant={TIPO_MOVIMENTO_INFO[m.tipo].variant}>
                              {TIPO_MOVIMENTO_INFO[m.tipo].label}
                            </Badge>
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {num(m.quantidade)} {m.unidade ?? ""}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {m.obraRotulo ?? "Almoxarifado central"}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {m.documento ?? "—"}
                          </td>
                          {podeLancar ? (
                            <td className="py-2 text-right">
                              {/* Nem a ponta já estornada, nem o próprio
                                  estorno: estornar um estorno é confundir o
                                  razão em vez de corrigi-lo, e o índice
                                  parcial do banco recusaria de todo modo.

                                  O `estornado` é calculado sobre os 50
                                  movimentos lidos, então um estorno antigo
                                  pode não ser visto aqui — quem garante de
                                  verdade é o índice, e a action devolve
                                  "já foi estornado". */}
                              {m.estornado || m.estornaId ? null : (
                                <MovimentoEstornar
                                  movimentoId={m.id}
                                  descricao={m.itemDescricao}
                                />
                              )}
                            </td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
