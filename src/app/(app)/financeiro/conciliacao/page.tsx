import { redirect } from "next/navigation";
import { Handshake } from "lucide-react";

import { getCurrentPerfil, podeGerenciarFinanceiro } from "@/lib/auth";
import { listarFilaConciliacao } from "@/lib/data/conciliacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { LinhaSugestao } from "./_components/linha-sugestao";

export const metadata = { title: "Conciliação com o Mega — Loca" };

export default async function ConciliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const perfil = await getCurrentPerfil();
  if (!podeGerenciarFinanceiro(perfil?.papel)) redirect("/financeiro");

  const { status } = await searchParams;
  const recusadas = status === "recusada";
  const itens = await listarFilaConciliacao(recusadas ? "recusada" : "sugerida");

  return (
    <div className="pagina-lista space-y-6">
      <PageHeader
        titulo="Conciliação com o Mega"
        descricao="O que o ERP já pagou e ainda não tem baixa no Loca."
        acoes={
          <Button variant="outline" render={
            <a href={recusadas ? "/financeiro/conciliacao" : "/financeiro/conciliacao?status=recusada"} />
          }>
            {recusadas ? "Ver a fila" : "Ver recusadas"}
          </Button>
        }
      />

      {itens.length === 0 ? (
        <EmptyState
          icon={<Handshake />}
          titulo={recusadas ? "Nenhuma sugestão recusada" : "Nada a conciliar"}
          descricao={
            recusadas
              ? "Tudo que o sistema propôs foi confirmado ou continua na fila."
              : "O Mega não tem pagamento sem baixa no Loca."
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Valor pago</TableHead>
                  <TableHead>Lançamento</TableHead>
                  <TableHead>Confiança</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map((item) => (
                  <LinhaSugestao key={item.id} item={item} />
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
