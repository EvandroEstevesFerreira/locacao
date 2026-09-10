import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TransferirForm } from "./transferir-form";

export const metadata = { title: "Transferir custódia — Loca" };

/**
 * A primeira metade da transferência: a devolução de quem está com a peça.
 *
 * A segunda metade é a emissão do termo novo, e acontece depois — as duas
 * assinaturas podem ser em dias diferentes. Entre elas a peça fica disponível,
 * e o que liga uma ponta à outra é o lembrete de entrega pendente.
 */
export default async function TransferirPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getCurrentPerfil();
  if (!podeOperar(perfil?.papel)) redirect(`/frota/${id}`);

  const supabase = await createClient();

  const [{ data: peca }, { data: posse }, { data: funcionarios }] =
    await Promise.all([
      supabase
        .from("equipamento_unidade")
        .select("id, identificador, situacao, item:item_id(descricao)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("custodia_peca")
        .select("inicio, termo_id, funcionario:funcionario_id(id, nome)")
        .eq("unidade_id", id)
        .is("fim", null)
        .eq("tipo", "funcionario")
        .maybeSingle(),
      supabase
        .from("funcionario")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
    ]);

  if (!peca) notFound();

  const p = peca as unknown as {
    id: string;
    identificador: string;
    situacao: string;
    item: { descricao: string } | null;
  };
  const atual = posse as unknown as {
    inicio: string;
    termo_id: string | null;
    funcionario: { id: string; nome: string } | null;
  } | null;

  const voltar = (
    <Button variant="outline" render={<Link href={`/frota/${id}`} />}>
      <ArrowLeft className="size-4" aria-hidden />
      Voltar à peça
    </Button>
  );

  // Sem posse aberta não há o que devolver. Dizer isso é melhor que um
  // formulário que só falha quando alguém termina de preenchê-lo.
  if (!atual?.funcionario) {
    return (
      <div className="pagina-form space-y-6">
        <PageHeader
          titulo={`Transferir ${p.identificador}`}
          descricao={p.item?.descricao ?? ""}
          acoes={voltar}
        />
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium">Esta peça não está com ninguém.</p>
            <p className="mt-1 text-muted-foreground">
              Transferir custódia é passar de uma pessoa para outra. Como não há
              posse aberta, o caminho é entregar direto, pela própria peça.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="pagina-form space-y-6">
      <PageHeader
        titulo={`Transferir ${p.identificador}`}
        descricao={p.item?.descricao ?? ""}
        acoes={voltar}
      />
      <Card>
        <CardContent className="pt-6">
          <TransferirForm
            unidadeId={p.id}
            identificador={p.identificador}
            quemEntrega={atual.funcionario}
            desde={atual.inicio}
            // Quem devolve não pode aparecer como quem recebe: transferir para
            // a mesma pessoa é encerrar e reabrir o mesmo vínculo, com dois
            // documentos e nenhuma mudança.
            candidatos={(
              (funcionarios ?? []) as unknown as { id: string; nome: string }[]
            ).filter((f) => f.id !== atual.funcionario!.id)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
