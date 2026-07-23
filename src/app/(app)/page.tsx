import Link from "next/link";
import { addDays, format } from "date-fns";
import {
  HardHat,
  FileText,
  PackageOpen,
  AlertTriangle,
  CalendarClock,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

type Devolucao = {
  id: string;
  data_devolucao_prevista: string | null;
  contrato: { numero: string } | null;
  item: { descricao: string } | null;
};

export default async function HomePage() {
  const supabase = await createClient();
  const hoje = new Date();
  const em7 = format(addDays(hoje, 7), "yyyy-MM-dd");

  const [
    obrasAtivas,
    contratosAtivos,
    itensEmAberto,
    avariasAbertas,
    pendentesRes,
    devolucoesRes,
  ] = await Promise.all([
    supabase.from("obra").select("*", { count: "exact", head: true }).eq("status", "ativa"),
    supabase
      .from("contrato_locacao")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("item_locado")
      .select("*", { count: "exact", head: true })
      .eq("status", "em_aberto"),
    supabase.from("avaria").select("*", { count: "exact", head: true }).eq("status", "aberta"),
    supabase
      .from("lancamento_financeiro")
      .select("valor, vencimento")
      .eq("status", "pendente"),
    supabase
      .from("item_locado")
      .select("id, data_devolucao_prevista, contrato:contrato_id(numero), item:item_id(descricao)")
      .eq("status", "em_aberto")
      .not("data_devolucao_prevista", "is", null)
      .lte("data_devolucao_prevista", em7)
      .order("data_devolucao_prevista"),
  ]);

  const hojeStr = format(hoje, "yyyy-MM-dd");
  const pendentes = pendentesRes.data ?? [];
  const totalPendente = pendentes.reduce((s, l) => s + Number(l.valor), 0);
  const totalVencido = pendentes
    .filter((l) => l.vencimento < hojeStr)
    .reduce((s, l) => s + Number(l.valor), 0);
  const devolucoes = (devolucoesRes.data ?? []) as unknown as Devolucao[];

  const kpis = [
    { href: "/obras", icon: HardHat, label: "Obras ativas", valor: obrasAtivas.count ?? 0 },
    {
      href: "/contratos",
      icon: FileText,
      label: "Contratos ativos",
      valor: contratosAtivos.count ?? 0,
    },
    {
      href: "/contratos",
      icon: PackageOpen,
      label: "Itens em aberto",
      valor: itensEmAberto.count ?? 0,
    },
    {
      href: "/vistorias",
      icon: AlertTriangle,
      label: "Avarias abertas",
      valor: avariasAbertas.count ?? 0,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titulo="Início" descricao="Visão geral das locações." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} href={k.href} className="group">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {k.label}
                  </CardTitle>
                  <Icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold">{k.valor}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

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
