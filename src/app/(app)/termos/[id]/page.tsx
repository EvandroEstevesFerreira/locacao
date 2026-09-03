import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Users } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { obterTermo } from "@/lib/data/termo";
import { SITUACAO_TERMO_INFO, estadoLabel } from "@/lib/termo";
import { formatarData, formatarDataHora } from "@/lib/locacao";
import { formatarNumero } from "@/lib/registros";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TermoDevolucao } from "./_components/termo-devolucao";
import { TermoEmissao } from "./_components/termo-emissao";
import { TermoCancelar } from "./_components/termo-cancelar";
import { TermoExcluir } from "./_components/termo-excluir";

export const metadata = { title: "Termo de responsabilidade — Loca" };

/**
 * Detalhe do termo — a tela que responde "quem está com o quê, desde quando".
 *
 * A ordem dos blocos é a ordem em que a pergunta aparece no almoxarifado:
 * primeiro quem recebeu, depois o que saiu, depois o que já voltou, e só então
 * as assinaturas. O que fecha o ciclo (devolução, encerramento) fica junto da
 * lista de itens, e não no fim da página: quem confere está com a peça na mão.
 */
export default async function TermoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [termo, perfil] = await Promise.all([obterTermo(id), getCurrentPerfil()]);
  if (!termo) notFound();

  const podeEditar = podeOperar(perfil?.papel);
  // Cancelar anula um documento assinado: é decisão de master ou administrador,
  // não de quem opera o dia a dia do almoxarifado.
  const podeCancelar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizacao")
    .select("nome")
    .eq("id", perfil!.org_id)
    .maybeSingle();
  const nomeEmpresa = (org as { nome: string } | null)?.nome ?? "Sistenge";

  const info = SITUACAO_TERMO_INFO[termo.situacao];
  const rascunho = termo.situacao === "rascunho";
  const cancelado = termo.situacao === "cancelado";
  const encerrado = Boolean(termo.encerrado_em) || cancelado;
  const pendentes = termo.itens.filter((i) => !i.data_devolucao).length;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        titulo={rascunho ? "Termo em rascunho" : formatarNumero(termo.numero_registro)}
        descricao={`${termo.funcionario_nome}${
          termo.obra_codigo ? ` · ${termo.obra_codigo}` : ""
        }`}
        acoes={
          <>
            <Button
              variant="outline"
              render={
                <a
                  href={`/api/termos/${termo.id}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <FileText className="size-4" />
              Gerar termo (PDF)
            </Button>
            <Button variant="outline" render={<Link href="/termos" />}>
              Voltar
            </Button>
            {podeEditar && rascunho ? <TermoExcluir termoId={termo.id} /> : null}
            {podeCancelar && !rascunho && !cancelado ? (
              <TermoCancelar termoId={termo.id} />
            ) : null}
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            label="Funcionário"
            node={
              <Link
                href={`/termos/funcionarios?q=${encodeURIComponent(termo.funcionario_nome)}`}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Users className="size-4 text-muted-foreground" />
                {termo.funcionario_nome}
              </Link>
            }
          />
          <Campo label="CPF" valor={termo.funcionario_cpf} />
          <Campo label="Função" valor={termo.funcionario_cargo} />
          <div>
            <p className="text-xs text-muted-foreground">Situação</p>
            <Badge variant={info.variant} title={info.ajuda}>
              {info.label}
            </Badge>
          </div>
          <Campo
            label="Obra"
            valor={
              termo.obra_codigo
                ? [termo.obra_codigo, termo.obra_nome].filter(Boolean).join(" — ")
                : null
            }
          />
          <Campo label="Entrega" valor={formatarData(termo.data_entrega)} />
          <Campo
            label="Devolução prevista"
            valor={formatarData(termo.previsao_devolucao)}
          />
          <Campo
            label="Itens pendentes"
            valor={`${pendentes} de ${termo.itens.length}`}
          />
          {termo.observacoes ? (
            <Campo label="Observações" valor={termo.observacoes} span />
          ) : null}
          {cancelado ? (
            <Campo
              label="Motivo do cancelamento"
              valor={termo.motivo_cancelamento}
              span
            />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipamento entregue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead className="text-right">Qtd.</TableHead>
                <TableHead>Estado na entrega</TableHead>
                <TableHead>Devolvido em</TableHead>
                <TableHead>Estado na devolução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {termo.itens.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.item_descricao}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.patrimonio ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {i.quantidade}
                    {i.unidade_medida ? ` ${i.unidade_medida}` : ""}
                  </TableCell>
                  <TableCell>{estadoLabel(i.estado_entrega)}</TableCell>
                  <TableCell className="tabular-nums">
                    {i.data_devolucao ? formatarData(i.data_devolucao) : "—"}
                  </TableCell>
                  <TableCell>
                    {i.estado_devolucao ? estadoLabel(i.estado_devolucao) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {podeEditar && rascunho ? (
        <Card>
          <CardHeader>
            <CardTitle>Emitir o termo</CardTitle>
          </CardHeader>
          <CardContent>
            <TermoEmissao
              termoId={termo.id}
              funcionarioNome={termo.funcionario_nome}
              funcionarioCpf={termo.funcionario_cpf}
              nomeEmpresa={nomeEmpresa}
            />
          </CardContent>
        </Card>
      ) : null}

      {podeEditar && !rascunho && !cancelado ? (
        <Card>
          <CardHeader>
            <CardTitle>Devolução</CardTitle>
          </CardHeader>
          <CardContent>
            <TermoDevolucao
              termoId={termo.id}
              itens={termo.itens}
              funcionarioNome={termo.funcionario_nome}
              funcionarioCpf={termo.funcionario_cpf}
              nomeEmpresa={nomeEmpresa}
              encerrado={encerrado}
              dataEntrega={termo.data_entrega}
            />
          </CardContent>
        </Card>
      ) : null}

      {termo.assinaturas.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Assinaturas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Hora e IP ficam à vista: é isso que sustenta a assinatura
                eletrônica quando alguém disser que não assinou. */}
            {termo.assinaturas.map((a, i) => (
              <div
                key={`${a.momento}-${a.papel}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{a.nome}</span>
                <span className="text-muted-foreground">
                  {a.papel === "funcionario" ? "Funcionário" : "Pela empresa"} ·{" "}
                  {a.momento === "entrega" ? "Entrega" : "Devolução"} ·{" "}
                  {formatarDataHora(a.assinado_em)}
                  {a.assinado_ip ? ` · IP ${a.assinado_ip}` : ""}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
