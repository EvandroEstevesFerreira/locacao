import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeExcluirCritico } from "@/lib/auth";
import {
  CADENCIA,
  STATUS_CONTRATO,
  formatarData,
  type Cadencia,
  type StatusContrato,
} from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { SecaoSkeleton } from "@/components/shared/skeletons";
import { AtividadeTimeline } from "@/components/atividade-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { excluirContrato } from "../actions";
import {
  ContratoCusto,
  ContratoCustoSkeleton,
} from "./_components/contrato-custo";
import { ContratoItens } from "./_components/contrato-itens";
import { ContratoRetirada, type VistoriaDeRetirada } from "./_components/contrato-retirada";
import { ContratoDocumentos } from "./_components/contrato-documentos";
import { ContratoDevolucoes } from "./_components/contrato-devolucoes";
import { ContratoRecebimentos } from "./_components/contrato-recebimentos";

export const metadata = { title: "Contrato — Loca" };

/**
 * Detalhe do contrato.
 *
 * A página `await`ta só a linha de contrato — identidade, obra, fornecedor,
 * cadência e status. Cada seção busca o que precisa dentro do próprio
 * `<Suspense>`, incluindo a célula de custo acumulado do resumo.
 *
 * As seções aparecem aqui na ordem em que devem ser lidas. Antes a ordem visual
 * era dada por classes `order-1..order-6` sobre uma ordem de DOM diferente, e
 * `AtividadeTimeline` — sem classe de ordem, portanto `order: 0` — acabava
 * renderizada acima do resumo do contrato.
 */
export default async function ContratoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  // Operar (operador incluso) cobre editar contrato, itens e movimentação;
  // excluir o contrato inteiro é exclusivo do master.
  const podeEditar = podeOperar(perfil?.papel);
  const podeExcluir = podeExcluirCritico(perfil?.papel);

  const { id } = await params;
  const supabase = await createClient();

  const { data: contrato } = await supabase
    .from("contrato_locacao")
    .select(
      "id, numero, cadencia, cobranca_prorata, anexo_path, data_inicio, data_fim_prevista, status, observacoes, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome), vistoria_retirada:vistoria_retirada_id(id, vistoria_foto(count))",
    )
    .eq("id", id)
    .single();

  if (!contrato) notFound();

  const cadencia = contrato.cadencia as Cadencia;
  const prorata = !!contrato.cobranca_prorata;
  const statusC = STATUS_CONTRATO[contrato.status as StatusContrato];
  const obra = contrato.obra as unknown as { codigo: string; nome: string } | null;
  const fornecedor = contrato.fornecedor as unknown as { nome: string } | null;
  const retirada = contrato.vistoria_retirada as unknown as VistoriaDeRetirada | null;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        titulo={`Contrato ${contrato.numero}`}
        descricao={obra ? `${obra.codigo} — ${obra.nome}` : undefined}
        acoes={
          <>
            <Button
              variant="outline"
              render={
                <a
                  href={`/api/contratos/${contrato.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <FileText className="size-4" />
              Gerar contrato (PDF)
            </Button>
            {podeEditar ? (
              <>
                <Button
                  variant="outline"
                  render={<Link href={`/contratos/${contrato.id}/editar`} />}
                >
                  <Pencil className="size-4" />
                  Editar
                </Button>
                {podeExcluir ? (
                  <ConfirmDelete
                    action={excluirContrato}
                    id={contrato.id}
                    rotulo="Excluir"
                    mensagem="Excluir este contrato? Ele deixa de aparecer nas listas e relatórios."
                  />
                ) : null}
              </>
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo label="Obra" valor={obra ? `${obra.codigo} — ${obra.nome}` : "—"} />
          <Campo label="Fornecedor" valor={fornecedor?.nome ?? "—"} />
          <div>
            <p className="text-xs text-muted-foreground">Cadência</p>
            <p className="flex items-center gap-2 font-medium">
              {CADENCIA[cadencia].label}
              {prorata ? (
                <Badge variant="outline" className="text-primary">
                  Pró-rata
                </Badge>
              ) : null}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusC.variant}>{statusC.label}</Badge>
          </div>
          <Campo label="Início" valor={formatarData(contrato.data_inicio)} />
          <Campo
            label="Fim previsto"
            valor={formatarData(contrato.data_fim_prevista)}
          />
          <Suspense fallback={<ContratoCustoSkeleton />}>
            <ContratoCusto
              contratoId={contrato.id}
              cadencia={cadencia}
              prorata={prorata}
            />
          </Suspense>
        </CardContent>
      </Card>

      <Suspense fallback={<SecaoSkeleton linhas={5} />}>
        <ContratoItens
          contratoId={contrato.id}
          cadencia={cadencia}
          prorata={prorata}
          podeEditar={podeEditar}
        />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ContratoRecebimentos contratoId={contrato.id} podeEditar={podeEditar} />
      </Suspense>

      <ContratoRetirada
        contratoId={contrato.id}
        retirada={retirada}
        podeMovimentar={podeEditar}
      />

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ContratoDocumentos
          contratoId={contrato.id}
          anexoPath={(contrato.anexo_path as string | null) ?? null}
          orgId={perfil?.org_id ?? ""}
          podeEditar={podeEditar}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ContratoDevolucoes
          contratoId={contrato.id}
          cadencia={cadencia}
          prorata={prorata}
        />
      </Suspense>

      <AtividadeTimeline entidade="contrato_locacao" registroId={contrato.id} />
    </div>
  );
}
