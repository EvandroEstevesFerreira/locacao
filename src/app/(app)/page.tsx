import Link from "next/link";
import { addDays, format } from "date-fns";
import {
  FileText,
  PackageOpen,
  AlertTriangle,
  CalendarClock,
  Wallet,
  Building2,
  LineChart,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData, hojeSaoPaulo } from "@/lib/locacao";
import { gerarFluxoCaixa } from "@/lib/fluxo";
import { entradasPainel } from "@/lib/data/painel";
import { montarPainel, resumirPainel } from "@/lib/painel";
import { SituacaoObras } from "./_components/situacao-obras";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { BarChart } from "@/components/bar-chart";
import { SelectFilter } from "@/components/shared/select-filter";
import { listarObrasParaFiltro } from "@/lib/data/obras";

type Devolucao = {
  id: string;
  data_devolucao_prevista: string | null;
  contrato: { numero: string } | null;
  item: { descricao: string } | null;
};

type ImovelKpi = {
  contrato_imovel: {
    valor_aluguel: number;
    valor_condominio: number;
    valor_iptu: number;
    seguro_fianca: number | null;
    seguro_fianca_mensal: boolean | null;
    vigente: boolean;
  }[] | null;
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const obra = sp.obra;
  const hoje = hojeSaoPaulo();
  const em7 = format(addDays(hoje, 7), "yyyy-MM-dd");

  const contratosQ = supabase
    .from("contrato_locacao")
    .select("*", { count: "exact", head: true })
    .eq("status", "ativo");
  const itensQ = obra
    ? supabase
        .from("item_locado")
        .select("*, contrato:contrato_id!inner(obra_id)", { count: "exact", head: true })
        .eq("status", "em_aberto")
        .eq("contrato.obra_id", obra)
    : supabase
        .from("item_locado")
        .select("*", { count: "exact", head: true })
        .eq("status", "em_aberto");
  const avariasQ = obra
    ? supabase
        .from("avaria")
        .select("*, vistoria:vistoria_id!inner(contrato:contrato_id!inner(obra_id))", { count: "exact", head: true })
        .eq("status", "aberta")
        .eq("vistoria.contrato.obra_id", obra)
    : supabase.from("avaria").select("*", { count: "exact", head: true }).eq("status", "aberta");
  const imoveisQ = (() => {
    let q = supabase
      .from("imovel")
      .select(
        "id, contrato_imovel(valor_aluguel, valor_condominio, valor_iptu, seguro_fianca, seguro_fianca_mensal, vigente)",
        { count: "exact" },
      )
      .is("deleted_at", null);
    if (obra) q = q.eq("obra_id", obra);
    return q;
  })();
  const pendentesQ = (() => {
    let q = supabase.from("lancamento_financeiro").select("valor, vencimento").eq("status", "pendente");
    if (obra) q = q.eq("obra_id", obra);
    return q;
  })();
  const devolucoesQ = (() => {
    let q = supabase
      .from("item_locado")
      .select("id, data_devolucao_prevista, contrato:contrato_id!inner(numero, obra_id), item:item_id(descricao)")
      .eq("status", "em_aberto")
      .not("data_devolucao_prevista", "is", null)
      .lte("data_devolucao_prevista", em7)
      .order("data_devolucao_prevista");
    if (obra) q = q.eq("contrato.obra_id", obra);
    return q;
  })();

  const [
    obrasLista,
    contratosAtivos,
    itensEmAberto,
    avariasAbertas,
    imoveisRes,
    pendentesRes,
    devolucoesRes,
    fluxo,
    entradas,
  ] = await Promise.all([
    listarObrasParaFiltro(),
    obra ? contratosQ.eq("obra_id", obra) : contratosQ,
    itensQ,
    avariasQ,
    imoveisQ,
    pendentesQ,
    devolucoesQ,
    gerarFluxoCaixa(supabase, obra ? { obra_id: obra } : {}),
    entradasPainel(format(hoje, "yyyy-MM-dd")),
  ]);

  const hojeStr = format(hoje, "yyyy-MM-dd");

  // O painel respeita o filtro de obra da própria tela: filtrar aqui, e não na
  // leitura, mantém `entradasPainel` com uma assinatura só — ela também serve
  // ao cron, que nunca filtra por obra.
  const linhasPainel = montarPainel(
    obra ? entradas.filter((e) => e.obra.id === obra) : entradas,
    hojeStr,
  );
  const resumoPainel = resumirPainel(linhasPainel);
  const pendentes = pendentesRes.data ?? [];
  const totalPendente = pendentes.reduce((s, l) => s + Number(l.valor), 0);
  const totalVencido = pendentes
    .filter((l) => l.vencimento < hojeStr)
    .reduce((s, l) => s + Number(l.valor), 0);
  const devolucoes = (devolucoesRes.data ?? []) as unknown as Devolucao[];

  const imoveis = (imoveisRes.data ?? []) as unknown as ImovelKpi[];
  const custoImoveis = imoveis.reduce((s, r) => {
    const v = (r.contrato_imovel ?? []).find((c) => c.vigente);
    if (!v) return s;
    return (
      s +
      Number(v.valor_aluguel) +
      Number(v.valor_condominio) +
      Number(v.valor_iptu) +
      (v.seguro_fianca_mensal ? Number(v.seguro_fianca ?? 0) : 0)
    );
  }, 0);

  const kpis = [
    { href: "/contratos", icon: FileText, label: "Contratos ativos", valor: contratosAtivos.count ?? 0 },
    { href: "/contratos", icon: PackageOpen, label: "Itens em aberto", valor: itensEmAberto.count ?? 0 },
    { href: "/imoveis", icon: Building2, label: "Imóveis", valor: imoveisRes.count ?? 0 },
    { href: "/vistorias", icon: AlertTriangle, label: "Avarias abertas", valor: avariasAbertas.count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        titulo="Início"
        descricao={`Visão geral das locações ativas, custos e devoluções · ${formatarData(hojeStr)}`}
        acoes={
          <SelectFilter
            param="obra"
            label="Obra"
            placeholder="Todas as obras"
            opcoes={obrasLista.map((o) => ({ value: o.id, label: `${o.codigo} — ${o.nome}` }))}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className="group">
              <Card className="transition-colors group-hover:border-primary/50">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {k.label}
                  </CardTitle>
                  <Icon className="size-4 text-primary" strokeWidth={1.5} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    {k.valor}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <SituacaoObras linhas={linhasPainel} resumo={resumoPainel} />

      {/* Série temporal: desembolso previsto por mês */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <LineChart className="size-4" /> Desembolso previsto (12 meses)
          </CardTitle>
          <CardDescription>
            Clique num mês para ver os lançamentos dele. Total previsto:{" "}
            <strong>{formatarBRL(fluxo.totalPrevisto)}</strong>
            {custoImoveis > 0 ? (
              <> · imóveis vigentes: {formatarBRL(custoImoveis)}/mês</>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            data={fluxo.meses.map((m, i) => ({
              label: m.label.replace(/\/\d{2}(\d{2})$/, "/$1"),
              value: m.total,
              destaque: i === 0,
              // `m.chave` já é 'yyyy-MM', o formato do filtro. O recorte por
              // obra viaja junto: sem ele, clicar na barra de uma obra abriria
              // a lista de todas, e o total não bateria com a barra clicada.
              href: `/financeiro?mes=${m.chave}${obra ? `&obra=${obra}` : ""}`,
            }))}
            formatValue={(n) =>
              n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n))
            }
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="size-4" /> Contas a pagar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pendente</span>
              <span className="text-lg font-semibold">
                {formatarBRL(totalPendente)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vencido</span>
              <span className="text-lg font-semibold text-destructive">
                {formatarBRL(totalVencido)}
              </span>
            </div>
            <Link
              href="/financeiro"
              className="inline-block pt-2 text-sm text-primary hover:underline"
            >
              Ver financeiro →
            </Link>
          </CardContent>
        </Card>

        {/* Vencimentos próximos (devoluções) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="size-4" /> Devoluções nos próximos 7 dias
            </CardTitle>
            <CardDescription>
              Itens em aberto com devolução prevista chegando.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {devolucoes.length > 0 ? (
              <ul className="space-y-2">
                {devolucoes.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span>
                      {d.item?.descricao ?? "Item"}{" "}
                      <span className="text-muted-foreground">
                        · {d.contrato?.numero ?? ""}
                      </span>
                    </span>
                    <span className="font-medium">
                      {formatarData(d.data_devolucao_prevista)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma devolução prevista para os próximos 7 dias.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
