// Conferência de uma devolução.
//
// Uma coluna, alvos grandes: a mesma tela serve o celular no portão da obra e o
// desktop do escritório dias depois. NÃO há escrita offline — o service worker
// (`public/sw.js`) só serve a página offline em navegação, sem fila de
// sincronização. Prometer mais do que ele faz produziria registro perdido no
// portão.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Download, Camera } from "lucide-react";
import { getCurrentPerfil, podeOperar, podeExcluirCritico } from "@/lib/auth";
import { buscarDevolucao, listarItensComSaldo } from "@/lib/data/devolucoes";
import { formatarData } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import {
  STATUS_DEVOLUCAO_INFO,
  CONDICAO_DEVOLUCAO_INFO,
  type StatusDevolucao,
  type CondicaoDevolucao,
} from "@/lib/devolucao";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DevolucaoCabecalhoForm } from "../devolucao-forms";
import { DevolucaoItens } from "../devolucao-itens";
import { FecharDevolucao } from "../fechar-devolucao";
import { DevolucaoFechada } from "../devolucao-fechada";

export const metadata = { title: "Devolução — Loca" };

export default async function DevolucaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dev = await buscarDevolucao(id);
  // `null` tanto para inexistente quanto para sem permissão — a policy esconde
  // a linha, e não distinguimos: um 403 confirmaria que o registro existe.
  if (!dev || !dev.contrato) notFound();

  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel) && dev.status === "rascunho";

  const disponiveis = await listarItensComSaldo(dev.contrato.id);

  const obra = dev.contrato.obra;
  const info = STATUS_DEVOLUCAO_INFO[dev.status as StatusDevolucao];
  const comRessalva = dev.itens.filter((i) => i.condicao !== "ok");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo={
          dev.numero_registro
            ? `Devolução ${dev.numero_registro}`
            : "Devolução — rascunho"
        }
        descricao={`Contrato ${formatarNumero(dev.contrato.numero_registro)} · ${
          dev.fornecedor?.nome ?? "Fornecedor"
        }`}
        acoes={
          <Button
            variant="outline"
            render={<Link href={`/contratos/${dev.contrato.id}`} />}
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao contrato
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            label="Situação"
            node={
              <Badge variant={info?.variant ?? "secondary"}>
                {info?.label ?? dev.status}
              </Badge>
            }
          />
          <Campo
            label="Número do registro"
            node={
              <span className="tabular-nums">
                {formatarNumero(dev.numero_registro)}
              </span>
            }
          />
          <Campo label="Devolvido em" valor={formatarData(dev.devolvido_em)} />
          <Campo
            label="Obra"
            valor={obra ? `${obra.codigo} — ${obra.nome}` : "—"}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da devolução</CardTitle>
          <CardDescription>
            A data é a da <strong>saída da obra</strong>, não a do lançamento —
            é ela que encerra a contagem de diárias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DevolucaoCabecalhoForm
            devolucao={{
              id: dev.id,
              contrato_id: dev.contrato.id,
              devolvido_em: dev.devolvido_em,
              responsavel: dev.responsavel,
              nota_fornecedor: dev.nota_fornecedor,
              observacoes: dev.observacoes,
            }}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que voltou</CardTitle>
          <CardDescription>
            Só itens do contrato, e só os que ainda têm saldo em aberto. O saldo
            é conferido de novo no fechamento.
            {comRessalva.length > 0 ? (
              <>
                {" "}
                <strong>
                  {comRessalva.length}{" "}
                  {comRessalva.length === 1
                    ? "item com ressalva"
                    : "itens com ressalva"}
                  .
                </strong>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DevolucaoItens
            devolucaoId={dev.id}
            itens={dev.itens}
            disponiveis={disponiveis}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>

      {/* O relatório fotográfico. Precisa estar alcançável ANTES do fechamento:
          foto que chega depois não prova nada sobre o estado em que o
          equipamento foi entregue. */}
      {dev.vistoria_id ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
            <Camera className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              Relatório fotográfico desta devolução.
              {dev.status === "rascunho"
                ? " Anexe as fotos antes de fechar."
                : null}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={<Link href={`/vistorias/${dev.vistoria_id}`} />}
            >
              Abrir fotos
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {dev.status === "fechado" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
            <PackageCheck className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              Fechada em {formatarData(dev.fechado_em?.slice(0, 10) ?? null)}.
              {dev.aviso_enviado_em
                ? " Fornecedor avisado."
                : " Fornecedor ainda não avisado."}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={
                <Link href={`/api/devolucoes/${dev.id}/pdf`} target="_blank" />
              }
            >
              <Download className="size-3.5" aria-hidden />
              Termo
            </Button>
          </CardContent>
          <CardContent className="pt-0">
            <DevolucaoFechada
              devolucaoId={dev.id}
              numero={dev.numero_registro}
              avisoEnviadoEm={dev.aviso_enviado_em}
              emailFornecedor={dev.fornecedor?.contato_email ?? null}
              totalItens={dev.itens.length}
              podeOperar={podeOperar(perfil?.papel)}
              podeReabrir={podeExcluirCritico(perfil?.papel)}
            />
          </CardContent>
        </Card>
      ) : podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fechar a devolução</CardTitle>
            <CardDescription>
              Numera o registro, baixa o saldo do contrato e avisa o fornecedor
              com o termo em PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FecharDevolucao
              devolucaoId={dev.id}
              totalItens={dev.itens.length}
              comRessalva={comRessalva.length}
              emailFornecedor={dev.fornecedor?.contato_email ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Resumo por condição — a leitura que o Encarregado faz primeiro. */}
      {dev.itens.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(CONDICAO_DEVOLUCAO_INFO) as CondicaoDevolucao[]).map((c) => {
            const n = dev.itens.filter((i) => i.condicao === c).length;
            if (n === 0) return null;
            return (
              <Badge key={c} variant={CONDICAO_DEVOLUCAO_INFO[c].variant}>
                {n} {CONDICAO_DEVOLUCAO_INFO[c].label.toLowerCase()}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
