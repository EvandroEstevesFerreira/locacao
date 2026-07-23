import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Pencil,
  Camera,
  ChevronRight,
  AlertTriangle,
  Paperclip,
  Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeExcluirCritico } from "@/lib/auth";
import {
  CADENCIA,
  STATUS_CONTRATO,
  calcularCusto,
  dataDeISO,
  formatarBRL,
  formatarData,
  periodosEntre,
  type Cadencia,
  type StatusContrato,
} from "@/lib/locacao";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AddItemLocadoForm } from "../add-item-locado-form";
import { DevolucaoForm } from "../devolucao-form";
import { AnexoUploader } from "../anexo-uploader";
import {
  excluirContrato,
  excluirItemLocado,
  criarRelatorioRetirada,
  removerAnexoContrato,
} from "../actions";

export const metadata = { title: "Contrato — Loca" };

type Mov = {
  id: string;
  quantidade: number;
  tipo: string;
  data: string;
  vistoria_id: string | null;
  vistoria: { vistoria_foto: { count: number }[] } | null;
};
type Linha = {
  id: string;
  quantidade: number;
  valor_unitario_periodo: number;
  data_retirada: string;
  data_devolucao_prevista: string | null;
  data_devolucao: string | null;
  status: "em_aberto" | "devolvido";
  item: { descricao: string; unidade: string | null } | null;
  movimentacao: Mov[];
};

function contaFotos(v: { vistoria_foto: { count: number }[] } | null): number {
  return v?.vistoria_foto?.[0]?.count ?? 0;
}

export default async function ContratoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  // Operar (operador incluso) cobre editar contrato, itens e movimentação;
  // excluir o contrato inteiro é exclusivo do master.
  const podeEditar = podeOperar(perfil?.papel);
  const podeMovimentar = podeEditar;
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
  const statusC = STATUS_CONTRATO[contrato.status as StatusContrato];
  const obra = contrato.obra as unknown as { codigo: string; nome: string } | null;
  const fornecedor = contrato.fornecedor as unknown as { nome: string } | null;
  const retirada = contrato.vistoria_retirada as unknown as {
    id: string;
    vistoria_foto: { count: number }[];
  } | null;

  const anexoPath = (contrato.anexo_path as string | null) ?? null;
  const anexoUrl = anexoPath
    ? (await supabase.storage.from("contratos").createSignedUrl(anexoPath, 600))
        .data?.signedUrl ?? null
    : null;

  const { data: linhasRaw } = await supabase
    .from("item_locado")
    .select(
      "id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, data_devolucao, status, item:item_id(descricao,unidade), movimentacao(id, quantidade, tipo, data, vistoria_id, vistoria:vistoria_id(vistoria_foto(count)))",
    )
    .eq("contrato_id", id)
    .order("created_at");

  const linhas = (linhasRaw ?? []) as unknown as Linha[];
  const hoje = new Date();
  const prorata = !!contrato.cobranca_prorata;

  const linhasCalc = linhas.map((l) => {
    const devolvido = (l.movimentacao ?? [])
      .filter((m) => m.tipo === "devolucao")
      .reduce((s, m) => s + Number(m.quantidade), 0);
    const saldo = Number(l.quantidade) - devolvido;
    const fim = l.data_devolucao ? dataDeISO(l.data_devolucao) : hoje;
    const periodos = periodosEntre(cadencia, dataDeISO(l.data_retirada), fim, prorata);
    const custo = calcularCusto(
      Number(l.quantidade),
      Number(l.valor_unitario_periodo),
      periodos,
    );
    return { ...l, saldo, periodos, custo };
  });

  const custoTotal = linhasCalc.reduce((s, l) => s + l.custo, 0);

  // Histórico de devoluções (achatado, mais recente primeiro).
  const devolucoes = linhasCalc
    .flatMap((l) =>
      (l.movimentacao ?? [])
        .filter((m) => m.tipo === "devolucao")
        .map((m) => ({
          id: m.id,
          item: l.item?.descricao ?? "—",
          quantidade: Number(m.quantidade),
          data: m.data,
          vistoria_id: m.vistoria_id,
          fotos: contaFotos(m.vistoria),
        })),
    )
    .sort((a, b) => (a.data < b.data ? 1 : -1));

  const { data: itens } = await supabase
    .from("item_catalogo")
    .select("id, descricao, unidade")
    .eq("ativo", true)
    .order("descricao");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader titulo={`Contrato ${contrato.numero}`}>
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
              <form action={excluirContrato}>
                <input type="hidden" name="id" value={contrato.id} />
                <Button
                  variant="outline"
                  type="submit"
                  className="text-destructive"
                >
                  Excluir
                </Button>
              </form>
            ) : null}
          </>
        ) : null}
      </PageHeader>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Obra" valor={obra ? `${obra.codigo} — ${obra.nome}` : "—"} />
          <Info label="Fornecedor" valor={fornecedor?.nome ?? "—"} />
          <Info label="Cadência" valor={CADENCIA[cadencia].label} />
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={statusC.variant}>{statusC.label}</Badge>
          </div>
          <Info label="Início" valor={formatarData(contrato.data_inicio)} />
          <Info
            label="Fim previsto"
            valor={formatarData(contrato.data_fim_prevista)}
          />
          <Info
            label="Custo estimado acumulado"
            valor={formatarBRL(custoTotal)}
            destaque
          />
        </CardContent>
      </Card>

      {/* Contrato de locação (original) */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Paperclip className="size-4" /> Contrato de locação (original)
            </CardTitle>
            <CardDescription>
              Arquivo do contrato assinado com o fornecedor (PDF ou imagem).
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {anexoUrl ? (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  render={
                    <a href={anexoUrl} target="_blank" rel="noopener noreferrer" />
                  }
                >
                  <Download className="size-4" /> Abrir
                </Button>
                {podeEditar ? (
                  <form action={removerAnexoContrato}>
                    <input type="hidden" name="contrato_id" value={contrato.id} />
                    <input type="hidden" name="path" value={anexoPath ?? ""} />
                    <Button
                      variant="ghost"
                      size="sm"
                      type="submit"
                      className="text-destructive"
                    >
                      Remover
                    </Button>
                  </form>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">Nenhum arquivo</span>
            )}
            {podeEditar ? (
              <AnexoUploader
                contratoId={contrato.id}
                orgId={perfil?.org_id ?? ""}
                tem={!!anexoUrl}
              />
            ) : null}
          </div>
        </CardHeader>
      </Card>

      {/* Relatório fotográfico de retirada */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              Relatório fotográfico de retirada
            </CardTitle>
            <CardDescription>
              Documente com fotos todos os itens no início do contrato.
            </CardDescription>
          </div>
          {retirada ? (
            <div className="flex items-center gap-2">
              {contaFotos(retirada) === 0 ? (
                <Badge variant="destructive">
                  <AlertTriangle className="size-3" /> Pendente de fotos
                </Badge>
              ) : (
                <Badge variant="secondary">{contaFotos(retirada)} foto(s)</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                render={<Link href={`/vistorias/${retirada.id}`} />}
              >
                Abrir relatório
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : podeMovimentar ? (
            <form action={criarRelatorioRetirada}>
              <input type="hidden" name="contrato_id" value={contrato.id} />
              <Button type="submit" variant="outline" size="sm">
                <Camera className="size-4" />
                Criar relatório de retirada
              </Button>
            </form>
          ) : (
            <span className="text-sm text-muted-foreground">Não criado</span>
          )}
        </CardHeader>
      </Card>

      {/* Adicionar item (antes da lista) */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar item</CardTitle>
            <CardDescription>
              Inclua um item locado neste contrato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddItemLocadoForm
              key={linhasCalc.length}
              contratoId={contrato.id}
              itens={itens ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Itens locados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens locados</CardTitle>
          <CardDescription>
            Custo estimado = quantidade × valor por período × períodos decorridos
            (cadência {CADENCIA[cadencia].label.toLowerCase()}). A devolução pode
            ser parcial, até zerar o saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {linhasCalc.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor/período</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Devol. prevista</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Custo est.</TableHead>
                  <TableHead>Status</TableHead>
                  {podeMovimentar ? <TableHead>Devolver</TableHead> : null}
                  {podeEditar ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhasCalc.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.item?.descricao ?? "—"}
                      {l.item?.unidade ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({l.item.unidade})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{l.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatarBRL(Number(l.valor_unitario_periodo))}
                    </TableCell>
                    <TableCell>{formatarData(l.data_retirada)}</TableCell>
                    <TableCell>
                      {formatarData(l.data_devolucao_prevista)}
                    </TableCell>
                    <TableCell className="text-right">{l.saldo}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatarBRL(l.custo)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={l.status === "devolvido" ? "secondary" : "default"}>
                        {l.status === "devolvido" ? "Devolvido" : "Em aberto"}
                      </Badge>
                    </TableCell>
                    {podeMovimentar ? (
                      <TableCell>
                        {l.status === "em_aberto" && l.saldo > 0 ? (
                          <DevolucaoForm
                            key={l.saldo}
                            itemLocadoId={l.id}
                            contratoId={contrato.id}
                            saldo={l.saldo}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ) : null}
                    {podeEditar ? (
                      <TableCell>
                        <ConfirmDeleteItem itemId={l.id} contratoId={contrato.id} />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum item locado neste contrato.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Histórico de devoluções */}
      {devolucoes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de devoluções</CardTitle>
            <CardDescription>
              Cada devolução gera um relatório fotográfico.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd. devolvida</TableHead>
                  <TableHead>Relatório fotográfico</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devolucoes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{formatarData(d.data)}</TableCell>
                    <TableCell className="font-medium">{d.item}</TableCell>
                    <TableCell className="text-right">{d.quantidade}</TableCell>
                    <TableCell>
                      {d.vistoria_id ? (
                        <div className="flex items-center gap-2">
                          {d.fotos === 0 ? (
                            <Badge variant="destructive">
                              <AlertTriangle className="size-3" /> Pendente de fotos
                            </Badge>
                          ) : (
                            <Badge variant="secondary">{d.fotos} foto(s)</Badge>
                          )}
                          <Link
                            href={`/vistorias/${d.vistoria_id}`}
                            className="text-sm text-primary hover:underline"
                          >
                            Abrir
                          </Link>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Info({
  label,
  valor,
  destaque,
}: {
  label: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={destaque ? "text-lg font-semibold" : "font-medium"}>{valor}</p>
    </div>
  );
}

function ConfirmDeleteItem({
  itemId,
  contratoId,
}: {
  itemId: string;
  contratoId: string;
}) {
  return (
    <ConfirmDelete
      action={excluirItemLocado}
      id={itemId}
      hidden={{ contrato_id: contratoId }}
      mensagem="Remover este item do contrato?"
    />
  );
}
