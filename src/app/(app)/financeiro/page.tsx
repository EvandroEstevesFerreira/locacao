import Link from "next/link";
import { Plus, Pencil, Check, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { PageHeader } from "@/components/page-header";
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
  searchParams: Promise<{ status?: string; obra?: string }>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeGerenciarFinanceiro(perfil?.papel);
  const { status, obra } = await searchParams;

  const supabase = await createClient();
  const [{ data: obras }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
  ]);

  let query = supabase
    .from("lancamento_financeiro")
    .select("id, descricao, competencia, valor, vencimento, status, obra:obra_id(codigo)")
    .order("vencimento");
  if (status === "pendente" || status === "pago") query = query.eq("status", status);
  if (obra) query = query.eq("obra_id", obra);

  const { data } = await query;
  const lancamentos = (data ?? []) as unknown as Row[];

  const hojeStr = new Date().toISOString().slice(0, 10);
  const totalPendente = lancamentos
    .filter((l) => l.status === "pendente")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalPago = lancamentos
    .filter((l) => l.status === "pago")
    .reduce((s, l) => s + Number(l.valor), 0);
  const totalVencido = lancamentos
    .filter((l) => l.status === "pendente" && l.vencimento < hojeStr)
    .reduce((s, l) => s + Number(l.valor), 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Financeiro"
        descricao="Contas a pagar das locações, por obra e vencimento."
      >
        {podeEditar ? (
          <Button render={<Link href="/financeiro/novo" />}>
            <Plus className="size-4" />
            Novo lançamento
          </Button>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="A pagar (pendente)" valor={formatarBRL(totalPendente)} />
        <Kpi label="Vencido" valor={formatarBRL(totalVencido)} alerta />
        <Kpi label="Pago" valor={formatarBRL(totalPago)} />
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3" method="get">
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
                <TableHead>Descrição</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
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
                            <form action={alternarPago}>
                              <input type="hidden" name="id" value={l.id} />
                              <input
                                type="hidden"
                                name="novo_status"
                                value={l.status === "pago" ? "pendente" : "pago"}
                              />
                              <Button
                                type="submit"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={l.status === "pago" ? "Reabrir" : "Marcar pago"}
                              >
                                {l.status === "pago" ? <Undo2 /> : <Check />}
                              </Button>
                            </form>
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
