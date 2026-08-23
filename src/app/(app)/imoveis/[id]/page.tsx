import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { tipoImovelLabel } from "@/lib/imoveis";
import { PageHeader } from "@/components/shared/page-header";
import { SecaoSkeleton } from "@/components/shared/skeletons";
import { AtividadeTimeline } from "@/components/atividade-timeline";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/confirm-delete";
import { excluirImovel } from "../actions";
import {
  ImovelIdentificacao,
  type ImovelDetalhe,
} from "./_components/imovel-identificacao";
import { ImovelContratos } from "./_components/imovel-contratos";
import { ImovelConsumo } from "./_components/imovel-consumo";
import { ImovelReparos } from "./_components/imovel-reparos";
import { ImovelVistorias } from "./_components/imovel-vistorias";
import { ImovelOcupantes } from "./_components/imovel-ocupantes";
import { ImovelAlojamento } from "./_components/imovel-alojamento";
import { ImovelLimpeza } from "./_components/imovel-limpeza";

export const metadata = { title: "Imóvel — Loca" };

/**
 * Detalhe do imóvel — a tela mais densa do sistema.
 *
 * Eram 684 linhas e nove consultas, boa parte delas em série, antes de qualquer
 * HTML: contratos, histórico, contas de consumo, reparos, ocorrências,
 * vistorias, ocupantes e dois lotes de URLs assinadas. Agora a página `await`ta
 * só a linha de `imovel` e cada seção busca o que precisa dentro do próprio
 * `<Suspense>`.
 *
 * Assinar URLs passou a acontecer por seção — três lotes em vez de um. Trocamos
 * uma requisição a menos por paralelismo: os lotes agora correm ao mesmo tempo,
 * em vez de esperar todas as consultas terminarem. O que importava era não
 * voltar a assinar uma URL por arquivo, e cada seção continua assinando em lote.
 */
export default async function ImovelDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const podeGerirCadastros = podeEditarCadastros(perfil?.papel);
  const orgId = perfil?.org_id ?? "";

  const supabase = await createClient();
  const { data: imovel } = await supabase
    .from("imovel")
    .select("*, obra:obra_id(codigo, nome)")
    .is("deleted_at", null)
    .eq("id", id)
    .single();

  if (!imovel) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo={imovel.apelido}
        descricao={tipoImovelLabel(imovel.tipo)}
        acoes={
          <>
            <Button
              variant="outline"
              render={<a href={`/api/imoveis/${id}/contrato-pdf`} />}
            >
              <FileText className="size-4" /> Gerar contrato
            </Button>
            {podeEditar ? (
              <>
                <Button
                  variant="outline"
                  render={<Link href={`/imoveis/${id}/editar`} />}
                >
                  <Pencil className="size-4" /> Editar
                </Button>
                <ConfirmDelete
                  action={excluirImovel}
                  id={id}
                  mensagem="Excluir este imóvel e todos os seus contratos? Esta ação não pode ser desfeita."
                />
              </>
            ) : null}
          </>
        }
      />

      <ImovelIdentificacao imovel={imovel as ImovelDetalhe} />

      <Suspense fallback={<SecaoSkeleton linhas={4} />}>
        <ImovelContratos imovelId={id} orgId={orgId} podeEditar={podeEditar} />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={4} />}>
        <ImovelConsumo imovelId={id} podeEditar={podeEditar} />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ImovelReparos imovelId={id} orgId={orgId} podeEditar={podeEditar} />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ImovelVistorias imovelId={id} orgId={orgId} podeEditar={podeEditar} />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ImovelOcupantes
          imovelId={id}
          podeEditar={podeEditar}
          podeGerirCadastros={podeGerirCadastros}
        />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ImovelAlojamento imovelId={id} orgId={orgId} podeEditar={podeEditar} />
      </Suspense>

      <Suspense fallback={<SecaoSkeleton linhas={3} />}>
        <ImovelLimpeza imovelId={id} orgId={orgId} podeEditar={podeEditar} />
      </Suspense>

      <AtividadeTimeline entidade="imovel" registroId={id} />
    </div>
  );
}
