import Link from "next/link";
import { FileSignature, Users } from "lucide-react";

import { listarTermos } from "@/lib/data/termo";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { SITUACOES_TERMO, SITUACAO_TERMO_INFO } from "@/lib/termo";
import { formatarData } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { SelectFilter } from "@/components/shared/select-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Termos de responsabilidade — Loca" };

const POR_PAGINA = 25;

/**
 * Lista de termos de responsabilidade.
 *
 * O equipamento saía do almoxarifado para a mão do funcionário sem documento
 * nenhum. Quando sumia ou voltava quebrado, não havia papel que dissesse quem
 * estava com ele, em que estado saiu e quando deveria voltar — a conversa
 * virava memória contra memória.
 */
export default async function TermosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const pagina = Math.max(1, Number(um(sp.page) ?? 1) || 1);
  const from = (pagina - 1) * POR_PAGINA;

  const [{ linhas, total }, obras] = await Promise.all([
    listarTermos({
      busca: um(sp.q),
      obraId: um(sp.obra),
      situacao: um(sp.situacao),
      from,
      to: from + POR_PAGINA - 1,
      sort: um(sp.sort) ?? "data_entrega",
      ascending: um(sp.dir) === "asc",
    }),
    listarObrasParaFiltro(),
  ]);

  const temFiltro = Boolean(um(sp.q) || um(sp.obra) || um(sp.situacao));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Termos de responsabilidade"
        descricao={`${total} ${total === 1 ? "termo" : "termos"} · quem está com cada equipamento`}
        acoes={
          <>
            <Button variant="outline" render={<Link href="/termos/funcionarios" />}>
              <Users className="size-4" />
              Funcionários
            </Button>
            <Button render={<Link href="/termos/novo" />}>Novo termo</Button>
          </>
        }
      />

      <ListFilters>
        <ListSearch placeholder="Buscar por funcionário…" ariaLabel="Buscar termo" />
        <SelectFilter
          param="situacao"
          label="Situação"
          placeholder="Todas as situações"
          opcoes={SITUACOES_TERMO.map((s) => ({
            value: s,
            label: SITUACAO_TERMO_INFO[s].label,
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
      </ListFilters>

      {linhas.length === 0 && !temFiltro ? (
        <EmptyState
          icon={<FileSignature className="size-6" />}
          titulo="Nenhum termo emitido"
          descricao="O termo registra a entrega de equipamento a um funcionário: o que saiu, em que estado, até quando e com assinatura. Cadastre os funcionários primeiro."
          acao={{ label: "Cadastrar funcionários", href: "/termos/funcionarios" }}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Entrega</TableHead>
                  <TableHead>Devolução prevista</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Nenhum termo no filtro atual.
                    </TableCell>
                  </TableRow>
                ) : (
                  linhas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        <Link href={`/termos/${t.id}`} className="hover:underline">
                          {/* Rascunho não gasta número: ele só sai na emissão. */}
                          {t.numero_registro
                            ? formatarNumero(t.numero_registro)
                            : "— rascunho"}
                        </Link>
                      </TableCell>
                      <TableCell>{t.funcionario_nome}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {t.obra_codigo ?? "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatarData(t.data_entrega)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatarData(t.previsao_devolucao)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{t.itens}</TableCell>
                      <TableCell>
                        <Badge
                          variant={SITUACAO_TERMO_INFO[t.situacao].variant}
                          title={SITUACAO_TERMO_INFO[t.situacao].ajuda}
                        >
                          {SITUACAO_TERMO_INFO[t.situacao].label}
                        </Badge>
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
