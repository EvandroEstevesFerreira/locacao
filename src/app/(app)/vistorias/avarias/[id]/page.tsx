import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Camera, PackageOpen, Wallet } from "lucide-react";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { buscarAvaria, listarPecasDoContrato } from "@/lib/data/avarias";
import { formatarBRL } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import {
  STATUS_AVARIA_INFO,
  RESPONSABILIDADE_INFO,
  type StatusAvaria,
  type Responsabilidade,
} from "@/lib/avaria";
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
import { LaudoForm, CustoForm } from "../laudo-form";

export const metadata = { title: "Laudo de avaria — Loca" };

export default async function AvariaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const avaria = await buscarAvaria(id);
  // `null` tanto para inexistente quanto para sem permissão — a policy esconde
  // a linha, e não distinguimos: um 403 confirmaria que o registro existe.
  if (!avaria) notFound();

  const perfil = await getCurrentPerfil();
  // Avaria já cobrada não recebe laudo novo: o lançamento financeiro nasceu
  // apoiado no texto que está ali, e é esse texto que alguém vai ler se a
  // cobrança for contestada.
  const podeEditar = podeOperar(perfil?.papel) && avaria.status !== "cobrada";

  const pecas = avaria.contrato
    ? await listarPecasDoContrato(avaria.contrato.id)
    : [];

  const info = STATUS_AVARIA_INFO[avaria.status as StatusAvaria];
  const resp = RESPONSABILIDADE_INFO[avaria.responsabilidade as Responsabilidade];
  const obra = avaria.contrato?.obra;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo={`Avaria ${formatarNumero(avaria.numero_registro)}`}
        descricao={
          avaria.contrato
            ? `Contrato ${formatarNumero(avaria.contrato.numero_registro)} · ${
                avaria.fornecedor?.nome ?? "Fornecedor"
              }`
            : "Sem contrato vinculado"
        }
        acoes={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              render={<Link href="/vistorias/avarias" />}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Avarias
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/api/avarias/${avaria.id}/pdf`} target="_blank" />}
            >
              <Download className="size-4" aria-hidden />
              Laudo
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
                {info?.label ?? avaria.status}
              </Badge>
            }
          />
          <Campo
            label="Responsabilidade"
            node={
              <Badge variant={resp?.variant ?? "secondary"} title={resp?.ajuda}>
                {resp?.label ?? avaria.responsabilidade}
              </Badge>
            }
          />
          <Campo
            label="Custo estimado"
            valor={avaria.custo_estimado > 0 ? formatarBRL(avaria.custo_estimado) : "—"}
          />
          <Campo label="Obra" valor={obra ? `${obra.codigo} — ${obra.nome}` : "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dano constatado</CardTitle>
          <CardDescription>
            O que foi registrado quando a avaria nasceu. Editável na vistoria.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{avaria.descricao}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/vistorias/${avaria.vistoria_id}`} />}
            >
              <Camera className="size-3.5" aria-hidden />
              Fotos da vistoria
            </Button>
            {/* Constatada NA DEVOLUÇÃO ou EM USO — a distinção decide de quem é
                a conversa. Dano visto na volta é discussão com o fornecedor;
                dano visto em uso é da obra até prova em contrário. */}
            {avaria.devolucao ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/devolucoes/${avaria.devolucao.id}`} />}
              >
                <PackageOpen className="size-3.5" aria-hidden />
                Devolução {avaria.devolucao.numero_registro ?? ""}
              </Button>
            ) : null}
            {avaria.lancamento_id ? (
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/financeiro" />}
              >
                <Wallet className="size-3.5" aria-hidden />
                Lançamento gerado
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Apuração</CardTitle>
          <CardDescription>
            O laudo existe para <strong>apurar</strong>, não para confirmar o que
            já se decidiu. Toda avaria começa com a responsabilidade a definir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LaudoForm
            avariaId={avaria.id}
            data={avaria.data}
            responsabilidade={avaria.responsabilidade}
            unidadeId={avaria.unidade_id}
            laudo={avaria.laudo}
            pecas={pecas}
            podeEditar={podeEditar}
          />
        </CardContent>
      </Card>

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Custo</CardTitle>
            <CardDescription>
              Separado do laudo de propósito: ele costuma chegar depois, num
              orçamento do fornecedor, e por outra pessoa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustoForm
              avariaId={avaria.id}
              custoEstimado={avaria.custo_estimado}
              podeEditar={podeEditar}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
