import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AlertTriangle, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPerfil,
  podeOperar,
  podeGerenciarFinanceiro,
} from "@/lib/auth";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { TIPO_VISTORIA, type TipoVistoria } from "@/lib/vistoria";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { SecaoSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { excluirVistoria } from "../actions";
import { VistoriaFotos, contarFotos } from "./_components/vistoria-fotos";
import { VistoriaAvarias, somarAvarias } from "./_components/vistoria-avarias";
import { VistoriaAssinaturas } from "./_components/vistoria-assinaturas";

export const metadata = { title: "Vistoria — Loca" };

/**
 * Detalhe da vistoria.
 *
 * A página `await`ta apenas a consulta de identidade (a linha de `vistoria`) mais
 * os dois agregados curtos que o cabeçalho mostra. Cada seção busca os próprios
 * dados dentro de um `<Suspense>`, então o cabeçalho e o resumo aparecem de
 * imediato em vez de esperar as fotos — que são a parte lenta, porque exigem
 * assinar URLs de Storage.
 *
 * Era um único componente de 410 linhas que carregava tudo antes de renderizar
 * qualquer coisa.
 */
export default async function VistoriaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const podeCobrar = podeGerenciarFinanceiro(perfil?.papel);

  const supabase = await createClient();
  const { data: vistoria } = await supabase
    .from("vistoria")
    .select(
      "id, tipo, data, responsavel, observacoes, assinatura_empresa_nome, assinatura_empresa_img, assinatura_empresa_em, assinatura_retirante_nome, assinatura_retirante_img, assinatura_retirante_em, contrato:contrato_id(numero, obra:obra_id(codigo,nome))",
    )
    .eq("id", id)
    .single();

  if (!vistoria) notFound();

  const contrato = vistoria.contrato as unknown as {
    numero: string;
    obra: { codigo: string; nome: string } | null;
  } | null;

  // Contexto: esta vistoria é o relatório de uma devolução?
  const { data: movs } = await supabase
    .from("movimentacao")
    .select("quantidade, item_locado:item_locado_id(item:item_id(descricao))")
    .eq("vistoria_id", id);
  const mov = (movs ?? [])[0] as unknown as
    | {
        quantidade: number;
        item_locado: { item: { descricao: string } | null } | null;
      }
    | undefined;
  const contextoDevolucao = mov
    ? `Devolução de ${mov.quantidade} un. de ${mov.item_locado?.item?.descricao ?? "item"}`
    : null;

  // Agregados curtos do cabeçalho — `head: true` na contagem, sem trazer linhas.
  const [qtdFotos, totalAvarias] = await Promise.all([
    contarFotos(id),
    somarAvarias(id),
  ]);
  const empresaAssinado = !!vistoria.assinatura_empresa_img;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Vistoria"
        descricao={
          contrato
            ? `Contrato ${contrato.numero}${contrato.obra ? ` · ${contrato.obra.codigo}` : ""}`
            : undefined
        }
        acoes={
          <>
            <Button
              variant="secondary"
              render={
                <a
                  href={`/api/vistorias/${vistoria.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <FileDown className="size-4" />
              Gerar PDF
            </Button>
            {podeEditar ? (
              <ConfirmDelete
                action={excluirVistoria}
                id={vistoria.id}
                rotulo="Excluir vistoria"
                mensagem="Excluir esta vistoria, com as fotos e avarias registradas?"
              />
            ) : null}
          </>
        }
      />

      {contextoDevolucao ? (
        <p className="text-sm text-muted-foreground">{contextoDevolucao}</p>
      ) : null}

      {qtdFotos === 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Relatório pendente: adicione ao menos uma foto para concluí-lo.
        </div>
      ) : null}

      {!empresaAssinado ? (
        <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-strong">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Relatório <strong>não assinado</strong> pelo representante da empresa. A
          assinatura é opcional, mas recomendada antes de finalizar.
        </div>
      ) : null}

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Tipo</p>
            <Badge variant={TIPO_VISTORIA[vistoria.tipo as TipoVistoria].variant}>
              {TIPO_VISTORIA[vistoria.tipo as TipoVistoria].label}
            </Badge>
          </div>
          <Campo label="Data" valor={formatarData(vistoria.data)} />
          <Campo label="Responsável" valor={vistoria.responsavel} />
          <Campo label="Avarias (custo est.)" valor={formatarBRL(totalAvarias)} />
        </CardContent>
      </Card>

      <Suspense fallback={<SecaoSkeleton linhas={4} />}>
        <VistoriaFotos
          vistoriaId={id}
          orgId={perfil?.org_id ?? ""}
          podeEditar={podeEditar}
        />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <VistoriaAvarias
          vistoriaId={id}
          podeEditar={podeEditar}
          podeCobrar={podeCobrar}
        />
      </Suspense>

      <VistoriaAssinaturas
        vistoria={vistoria}
        usuarioNome={perfil?.nome ?? ""}
        podeEditar={podeEditar}
      />
    </div>
  );
}
