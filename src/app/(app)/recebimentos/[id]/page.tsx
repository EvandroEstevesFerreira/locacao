// Conferência de um recebimento.
//
// Uma coluna, alvos grandes: a mesma tela serve o celular no portão da obra e o
// desktop do escritório dias depois. NÃO há escrita offline — o service worker
// (`public/sw.js`) só serve a página offline em navegação, sem fila de
// sincronização. Prometer mais do que ele faz produziria registro perdido no
// portão.

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PackageCheck, Download } from "lucide-react";
import { getCurrentPerfil, podeOperar, podeExcluirCritico } from "@/lib/auth";
import {
  buscarRecebimento,
  listarItensDoContrato,
  listarUnidades,
} from "@/lib/data/recebimentos";
import { formatarData } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import {
  STATUS_RECEBIMENTO_INFO,
  CONDICAO_INFO,
  type StatusRecebimento,
  type Condicao,
} from "@/lib/recebimento";
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
import { RecebimentoCabecalhoForm } from "../recebimento-forms";
import { RecebimentoItens } from "../recebimento-itens";
import { FecharRecebimento } from "../fechar-recebimento";
import { RecebimentoFechado } from "../recebimento-fechado";

export const metadata = { title: "Recebimento — Loca" };

export default async function RecebimentoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const rec = await buscarRecebimento(id);
  // `null` tanto para inexistente quanto para sem permissão — a policy esconde
  // a linha, e não distinguimos: um 403 confirmaria que o registro existe.
  if (!rec || !rec.contrato) notFound();

  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel) && rec.status === "rascunho";

  const [contratados, unidades] = await Promise.all([
    listarItensDoContrato(rec.contrato.id),
    listarUnidades(),
  ]);

  const obra = rec.contrato.obra;
  const info = STATUS_RECEBIMENTO_INFO[rec.status as StatusRecebimento];

  const comProblema = rec.itens.filter((i) => i.condicao !== "ok");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo={
          rec.numero_registro
            ? `Recebimento ${rec.numero_registro}`
            : "Recebimento — rascunho"
        }
        descricao={`Contrato ${formatarNumero(rec.contrato.numero_registro)} · ${
          rec.fornecedor?.nome ?? "Fornecedor"
        }`}
        acoes={
          <Button
            variant="outline"
            render={<Link href={`/contratos/${rec.contrato.id}`} />}
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
                {info?.label ?? rec.status}
              </Badge>
            }
          />
          <Campo
            label="Número do registro"
            node={
              <span className="tabular-nums">
                {formatarNumero(rec.numero_registro)}
              </span>
            }
          />
          <Campo label="Recebido em" valor={formatarData(rec.recebido_em)} />
          <Campo
            label="Obra"
            valor={obra ? `${obra.codigo} — ${obra.nome}` : "—"}
          />
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da conferência</CardTitle>
          <CardDescription>
            A data é a da <strong>entrega</strong>, não a do lançamento — quem
            digita dias depois precisa corrigi-la.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecebimentoCabecalhoForm
            recebimento={{
              id: rec.id,
              contrato_id: rec.contrato.id,
              recebido_em: rec.recebido_em,
              conferente: rec.conferente,
              nota_fornecedor: rec.nota_fornecedor,
              observacoes: rec.observacoes,
            }}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que chegou</CardTitle>
          <CardDescription>
            Confirme o que o contrato prevê e registre o que veio diferente. Item
            controlado por patrimônio exige a peça.
            {comProblema.length > 0 ? (
              <>
                {" "}
                <strong>
                  {comProblema.length}{" "}
                  {comProblema.length === 1
                    ? "item com ressalva"
                    : "itens com ressalva"}
                  .
                </strong>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecebimentoItens
            recebimentoId={rec.id}
            itens={rec.itens}
            contratados={contratados}
            unidades={unidades}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>

      {rec.status === "fechado" ? (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
            <PackageCheck className="size-4 text-muted-foreground" aria-hidden />
            <span className="text-muted-foreground">
              Fechado em {formatarData(rec.fechado_em?.slice(0, 10) ?? null)}.
              {rec.aviso_enviado_em
                ? " Fornecedor avisado."
                : " Fornecedor ainda não avisado."}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              render={
                <Link href={`/api/recebimentos/${rec.id}/pdf`} target="_blank" />
              }
            >
              <Download className="size-3.5" aria-hidden />
              Romaneio
            </Button>
          </CardContent>
          <CardContent className="pt-0">
            <RecebimentoFechado
              recebimentoId={rec.id}
              numero={rec.numero_registro}
              avisoEnviadoEm={rec.aviso_enviado_em}
              emailFornecedor={rec.fornecedor?.contato_email ?? null}
              podeOperar={podeOperar(perfil?.papel)}
              podeReabrir={podeExcluirCritico(perfil?.papel)}
            />
          </CardContent>
        </Card>
      ) : podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fechar o recebimento</CardTitle>
            <CardDescription>
              Numera o registro, carimba a retirada no contrato e avisa o
              fornecedor com o romaneio em PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FecharRecebimento
              recebimentoId={rec.id}
              totalItens={rec.itens.length}
              comRessalva={comProblema.length}
              emailFornecedor={rec.fornecedor?.contato_email ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Resumo por condição — a leitura que o Encarregado faz primeiro. */}
      {rec.itens.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.keys(CONDICAO_INFO) as Condicao[]).map((c) => {
            const n = rec.itens.filter((i) => i.condicao === c).length;
            if (n === 0) return null;
            return (
              <Badge key={c} variant={CONDICAO_INFO[c].variant}>
                {n} {CONDICAO_INFO[c].label.toLowerCase()}
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
