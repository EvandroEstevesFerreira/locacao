import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, ShieldAlert, Boxes, CalendarClock } from "lucide-react";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { buscarReparo, listarPecasParaReparo } from "@/lib/data/reparos";
import { formatarBRL, formatarData, hojeISOSaoPaulo } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import {
  STATUS_REPARO_INFO,
  RESPONSABILIDADE_INFO,
  type StatusReparo,
  type Responsabilidade,
} from "@/lib/reparo";
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
import { ReparoForm, ConcluirReparo } from "../reparo-form";

export const metadata = { title: "Ordem de reparo — Loca" };

export default async function OrdemReparoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const reparo = await buscarReparo(id);
  // `null` tanto para inexistente quanto para sem permissão — a policy esconde
  // a linha, e não distinguimos: um 403 confirmaria que o registro existe.
  if (!reparo) notFound();

  const perfil = await getCurrentPerfil();
  // Ordem concluída registra um custo pago e um serviço feito. Para desfazer,
  // cancele — o que devolve a peça e deixa o rastro.
  const podeEditar = podeOperar(perfil?.papel) && reparo.status !== "concluido";
  const podeConcluir =
    podeOperar(perfil?.papel) &&
    (reparo.status === "aberto" || reparo.status === "em_execucao");

  const pecas = await listarPecasParaReparo();

  const info = STATUS_REPARO_INFO[reparo.status as StatusReparo];
  const resp = RESPONSABILIDADE_INFO[reparo.responsabilidade as Responsabilidade];

  // "Hoje" de Brasília: o Vercel roda em UTC e das 21h à meia-noite uma ordem
  // que vence hoje apareceria como atrasada.
  const hoje = hojeISOSaoPaulo();
  const atrasada =
    reparo.status === "em_execucao" &&
    reparo.previsto_para !== null &&
    reparo.previsto_para < hoje;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo={`Ordem ${formatarNumero(reparo.numero_registro)}`}
        descricao={`${reparo.unidadeIdentificador ?? "Peça"} · ${
          reparo.itemDescricao ?? "Equipamento"
        }`}
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/frota/reparos" />}>
              <ArrowLeft className="size-4" aria-hidden />
              Ordens
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/api/reparos/${reparo.id}/pdf`} target="_blank" />}
            >
              <Download className="size-4" aria-hidden />
              Ordem em PDF
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            label="Situação"
            node={
              <Badge variant={info?.variant ?? "secondary"} title={info?.ajuda}>
                {info?.label ?? reparo.status}
              </Badge>
            }
          />
          <Campo
            label="Quem paga"
            node={
              <Badge variant={resp?.variant ?? "secondary"} title={resp?.ajuda}>
                {resp?.label ?? reparo.responsabilidade}
              </Badge>
            }
          />
          <Campo
            label="Valor"
            valor={reparo.valor > 0 ? formatarBRL(reparo.valor) : "—"}
          />
          <Campo
            label="Retorno"
            node={
              reparo.concluido_em ? (
                <span className="tabular-nums">
                  {formatarData(reparo.concluido_em)}
                </span>
              ) : reparo.previsto_para ? (
                <span
                  className={
                    atrasada
                      ? "inline-flex items-center gap-1 font-medium tabular-nums"
                      : "tabular-nums text-muted-foreground"
                  }
                >
                  {atrasada ? <CalendarClock className="size-3.5" aria-hidden /> : null}
                  {formatarData(reparo.previsto_para)}
                  {atrasada ? " (vencido)" : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
        </CardContent>
      </Card>

      {/* A peça e a avaria de origem. A avaria é nula na manutenção preventiva,
          e a distinção decide se há responsável a apurar ou se é custo previsto
          da operação. */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/frota/${reparo.unidade_id}`} />}
          >
            <Boxes className="size-3.5" aria-hidden />
            {reparo.unidadeIdentificador ?? "Peça"}
          </Button>
          {reparo.avaria_id ? (
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/vistorias/avarias/${reparo.avaria_id}`} />}
            >
              <ShieldAlert className="size-3.5" aria-hidden />
              Avaria {reparo.avariaNumero ?? ""}
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">
              Manutenção preventiva — não veio de avaria.
            </span>
          )}
        </CardContent>
      </Card>

      {podeConcluir ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Concluir</CardTitle>
            <CardDescription>
              O passo que devolve a peça ao pátio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConcluirReparo
              reparoId={reparo.id}
              peca={reparo.unidadeIdentificador}
              valor={reparo.valor}
              hoje={hoje}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da ordem</CardTitle>
          <CardDescription>
            Aberta em {formatarData(reparo.aberto_em)}
            {reparo.enviado_em
              ? ` · saiu da obra em ${formatarData(reparo.enviado_em)}`
              : " · a peça ainda está na obra"}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReparoForm
            reparo={{
              id: reparo.id,
              unidade_id: reparo.unidade_id,
              avaria_id: reparo.avaria_id,
              status: reparo.status,
              descricao: reparo.descricao,
              executor: reparo.executor,
              aberto_em: reparo.aberto_em,
              enviado_em: reparo.enviado_em,
              previsto_para: reparo.previsto_para,
              concluido_em: reparo.concluido_em,
              valor: reparo.valor,
              responsabilidade: reparo.responsabilidade,
              garantia_dias: reparo.garantia_dias,
              observacoes: reparo.observacoes,
            }}
            pecas={pecas}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>
    </div>
  );
}
