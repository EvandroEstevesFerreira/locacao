import Link from "next/link";
import { Plus, Pencil, Undo2, Coins, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { formatarBRL, formatarData } from "@/lib/locacao";
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
import { ConfirmDelete } from "@/components/confirm-delete";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, parseListParams, termoOr } from "@/lib/lista";
import { alternarPago, excluirLancamento } from "./actions";

export const metadata = { title: "Financeiro — Loca" };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm outline-none";

type Row = {
  id: string;
  descricao: string;
  competencia: string;
  valor: number;
  vencimento: string;
  status: "pendente" | "pago";
  obra: { codigo: string } | null;
};

export default async function FinanceiroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeGerenciarFinanceiro(perfil?.papel);
  const sp = await searchParams;
  const { status, obra } = sp;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["vencimento", "valor", "status", "competencia", "descricao"],
    defaultSort: "vencimento",
  });

  const supabase = await createClient();
  const [{ data: obras }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
  ]);

  let query = supabase
    .from("lancamento_financeiro")
    .select("id, descricao, competencia, valor, vencimento, status, obra:obra_id(codigo)", { count: "exact" });
  if (status === "pendente" || status === "pago") query = query.eq("status", status);
  if (obra) query = query.eq("obra_id", obra);
  if (q) query = query.or(termoOr(["descricao"], q));
  query = query.order(sort, { ascending }).range(from, to);

  const { data, count } = await query;
  const lancamentos = (data ?? []) as unknown as Row[];
  const total = count ?? 0;

  // KPIs sobre TODOS os lançamentos que casam com os filtros (não só a página).
  let kpiQuery = supabase
    .from("lancamento_financeiro")
    .select("valor, vencimento, status");
  if (status === "pendente" || status === "pago") kpiQuery = kpiQuery.eq("status", status);
  if (obra) kpiQuery = kpiQuery.eq("obra_id", obra);
  if (q) kpiQuery = kpiQuery.or(termoOr(["descricao"], q));
  const { data: kpiData } = await kpiQuery;
  const todos = (kpiData ?? []) as { valor: number; vencimento: string; status: string }[];

  const hojeStr = new Date().toISOString().slice(0, 10);
  const totalPendente = todos
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = todos
    .filter((l) => l.status === "pago")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalVencido = todos
    .filter((l) => l.status === "pendente" && l.vencimento < hojeStr)
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a pagar das locações, por obra e vencimento."
        acoes={
          <>
            <Button
              variant="secondary"
              render={<Link href="/financeiro/fluxo" />}
            >
              Fluxo de caixa
            </Button>
            {podeEditar ? (
              <>
                <Button variant="secondary" render={<Link href="/financeiro/recorrentes" />}>
                  <RefreshCw className="size-4" />
                  Gerar recorrentes
                </Button>
                <Button render={<Link href="/financeiro/novo" />}>
                  <Plus className="size-4" />
                  Novo lançamento
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="A pagar (pendente)" valor={formatarBRL(totalPendente)} />
        <Kpi label="Vencido" valor={formatarBRL(totalVencido)} alerta />
        <Kpi label="Pago" valor={formatarBRL(totalPago)} />
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-muted-foreground">Buscar</label>
          <Input name="q" defaultValue={q} placeholder="Descrição…" className="min-w-48" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Obra</label>
          <select name="obra" defaultValue={obra ?? ""} className={selectClasses}>
            <option value="">Todas</option>
            {(obras ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.codigo} — {o.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Status</label>
          <select name="status" defaultValue={status ?? ""} className={selectClasses}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
      </form>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="descricao" label="Descrição" /></TableHead>
                <TableHead>Obra</TableHead>
                <TableHead><SortHeader column="competencia" label="Competência" /></TableHead>
                <TableHead><SortHeader column="vencimento" label="Vencimento" /></TableHead>
                <TableHead className="text-right"><SortHeader column="valor" label="Valor" /></TableHead>
                <TableHead><SortHeader column="status" label="Status" /></TableHead>
                {podeEditar ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum lançamento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                lancamentos.map((l) => {
                  const vencido = l.status === "pendente" && l.vencimento < hojeStr;
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{l.descricao}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.obra?.codigo ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {l.competencia.slice(0, 7).split("-").reverse().join("/")}
                      </TableCell>
                      <TableCell className={vencido ? "font-medium text-destructive" : ""}>
                        {formatarData(l.vencimento)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatarBRL(Number(l.valor))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={l.status === "pago" ? "secondary" : vencido ? "destructive" : "default"}>
                          {l.status === "pago" ? "Pago" : vencido ? "Vencido" : "Pendente"}
                        </Badge>
                      </TableCell>
                      {podeEditar ? (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {l.status === "pago" ? (
                              <form action={alternarPago}>
                                <input type="hidden" name="id" value={l.id} />
                                <input type="hidden" name="novo_status" value="pendente" />
                                <Button
                                  type="submit"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label="Reabrir"
                                >
                                  <Undo2 />
                                </Button>
                              </form>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Dar baixa"
                                render={<Link href={`/financeiro/${l.id}/baixa`} />}
                              >
                                <Coins />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Editar"
                              render={<Link href={`/financeiro/${l.id}`} />}
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDelete action={excluirLancamento} id={l.id} />
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
    </div>
  );
}

function Kpi({
  label,
  valor,
  alerta,
}: {
  label: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-semibold ${alerta ? "text-destructive" : ""}`}>
          {valor}
        </p>
      </CardContent>
    </Card>
  );
}
