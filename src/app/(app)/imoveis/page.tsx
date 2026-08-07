import Link from "next/link";
import { Plus, Pencil, FileText, Building2, Coins } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { formatarBRL } from "@/lib/locacao";
import {
  TIPOS_IMOVEL,
  TIPO_IMOVEL_INFO,
  STATUS_IMOVEL_INFO,
  tipoImovelLabel,
  type StatusImovel,
} from "@/lib/imoveis";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/pagination";
import { SortHeader } from "@/components/sort-header";
import { PAGE_SIZE, parseListParams, termoOr } from "@/lib/lista";
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
import { KpiCard } from "@/components/shared/kpi-card";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";

export const metadata = { title: "Imóveis — Loca" };


type Contrato = { valor_aluguel: number; valor_condominio: number; vigente: boolean };
type Row = {
  id: string;
  tipo: string;
  apelido: string;
  cidade: string | null;
  uf: string | null;
  status: StatusImovel;
  obra: { codigo: string } | null;
  contrato_imovel: Contrato[] | null;
};

export default async function ImoveisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const sp = await searchParams;
  const { tipo, status, obra } = sp;
  const { q, sort, ascending, from, to, page } = parseListParams(sp, {
    sortCols: ["apelido", "tipo", "cidade", "status"],
    defaultSort: "apelido",
  });

  const supabase = await createClient();
  const [{ data: obras }, imoveisRes, kpiRes] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
    (() => {
      let qq = supabase
        .from("imovel")
        .select(
          "id, tipo, apelido, cidade, uf, status, obra:obra_id(codigo), contrato_imovel(valor_aluguel, valor_condominio, vigente)",
          { count: "exact" },
        )
        .is("deleted_at", null);
      if (tipo) qq = qq.eq("tipo", tipo);
      if (status) qq = qq.eq("status", status);
      if (obra) qq = qq.eq("obra_id", obra);
      if (q) qq = qq.or(termoOr(["apelido", "cidade"], q));
      return qq.order(sort, { ascending }).range(from, to);
    })(),
    (() => {
      let qq = supabase
        .from("imovel")
        .select("contrato_imovel(valor_aluguel, valor_condominio, vigente)")
        .is("deleted_at", null);
      if (tipo) qq = qq.eq("tipo", tipo);
      if (status) qq = qq.eq("status", status);
      if (obra) qq = qq.eq("obra_id", obra);
      if (q) qq = qq.or(termoOr(["apelido", "cidade"], q));
      return qq;
    })(),
  ]);

  const imoveis = (imoveisRes.data ?? []) as unknown as Row[];
  const total = imoveisRes.count ?? 0;

  const vigenteDe = (r: Row) =>
    (r.contrato_imovel ?? []).find((c) => c.vigente) ?? null;

  const aluguelTotal = ((kpiRes.data ?? []) as unknown as Row[]).reduce((s, r) => {
    const v = vigenteDe(r);
    return s + (v ? Number(v.valor_aluguel) + Number(v.valor_condominio) : 0);
  }, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        titulo="Imóveis"
        descricao="Kitnets, apartamentos, casas, galpões e escritórios locados pela Sistenge."
        acoes={
          <>
            <Button variant="outline" render={<Link href="/imoveis/documentos" />}>
              <FileText className="size-4" />
              Documentos
            </Button>
            {podeEditar ? (
              <Button render={<Link href="/imoveis/novo" />}>
                <Plus className="size-4" />
                Novo imóvel
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <KpiCard icon={<Building2 />} label="Imóveis no filtro" value={String(total)} />
        <KpiCard
          icon={<Coins />}
          label="Custo mensal"
          value={formatarBRL(aluguelTotal)}
          detail="Aluguel + condomínio dos contratos vigentes"
          variant="info"
        />
      </div>

      <ListFilters>
        <ListSearch placeholder="Buscar por apelido ou cidade…" ariaLabel="Buscar imóvel" />
        <SelectFilter
          param="tipo"
          label="Tipo"
          opcoes={TIPOS_IMOVEL.map((t) => ({ value: t, label: TIPO_IMOVEL_INFO[t] }))}
        />
        <SelectFilter
          param="status"
          label="Status"
          opcoes={(Object.keys(STATUS_IMOVEL_INFO) as StatusImovel[]).map((s) => ({
            value: s,
            label: STATUS_IMOVEL_INFO[s].label,
          }))}
        />
        <SelectFilter
          param="obra"
          label="Obra"
          placeholder="Todas as obras"
          opcoes={(obras ?? []).map((o) => ({ value: o.id, label: `${o.codigo} — ${o.nome}` }))}
        />
      </ListFilters>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortHeader column="apelido" label="Imóvel" /></TableHead>
                <TableHead><SortHeader column="tipo" label="Tipo" /></TableHead>
                <TableHead><SortHeader column="cidade" label="Cidade/UF" /></TableHead>
                <TableHead>Obra</TableHead>
                <TableHead><SortHeader column="status" label="Status" /></TableHead>
                <TableHead className="text-right">Aluguel + cond.</TableHead>
                {podeEditar ? <TableHead className="text-right">Ações</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {imoveis.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhum imóvel cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                imoveis.map((r) => {
                  const v = vigenteDe(r);
                  const st = STATUS_IMOVEL_INFO[r.status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link href={`/imoveis/${r.id}`} className="hover:underline">
                          {r.apelido}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tipoImovelLabel(r.tipo)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {[r.cidade, r.uf].filter(Boolean).join("/") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.obra?.codigo ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={st?.variant ?? "secondary"}>
                          {st?.label ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v
                          ? formatarBRL(Number(v.valor_aluguel) + Number(v.valor_condominio))
                          : "—"}
                      </TableCell>
                      {podeEditar ? (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Editar"
                              render={<Link href={`/imoveis/${r.id}/editar`} />}
                            >
                              <Pencil />
                            </Button>
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

