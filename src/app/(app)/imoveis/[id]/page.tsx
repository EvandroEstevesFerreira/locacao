import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, FileText, Check, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  STATUS_IMOVEL_INFO,
  STATUS_CAUCAO_INFO,
  tipoImovelLabel,
  tipoConsumoLabel,
  type StatusImovel,
  type StatusCaucao,
} from "@/lib/imoveis";
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
import { ContratoImovelForm } from "../contrato-imovel-form";
import { type ReactNode } from "react";
import { ContratoImovelCard } from "../contrato-imovel-card";
import { ContratoImovelAcoes, type HistoricoItem } from "../contrato-imovel-acoes";
import { PiiText } from "@/components/pii-text";
import { AtividadeTimeline } from "@/components/atividade-timeline";
import { ImovelAnexoUploader } from "../imovel-anexo-uploader";
import { ContaConsumoForm } from "../conta-consumo-form";
import { ReparoForm, OcorrenciaForm, VistoriaImovelForm } from "../fase3-forms";
import { ImovelUpload } from "../imovel-upload";
import { OcupanteForm } from "../ocupante-form";
import {
  excluirImovel,
  excluirContratoImovel,
  removerAnexoImovelContrato,
  alternarPagoConsumo,
  excluirContaConsumo,
  excluirReparo,
  excluirOcorrencia,
  excluirVistoriaImovel,
  excluirOcupante,
} from "../actions";

export const metadata = { title: "Imóvel — Loca" };

type Contrato = {
  id: string;
  data_inicio: string | null;
  data_fim: string | null;
  valor_aluguel: number;
  valor_condominio: number;
  valor_iptu: number;
  seguro_fianca: number;
  seguro_fianca_mensal: boolean;
  dia_vencimento: number | null;
  indice_reajuste: string | null;
  data_reajuste: string | null;
  caucao_valor: number | null;
  caucao_status: string | null;
  caucao_comprovante_path: string | null;
  anexo_contrato_path: string | null;
  vigente: boolean;
  observacoes: string | null;
};

export default async function ImovelDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const orgId = perfil?.org_id ?? "";

  const supabase = await createClient();
  const { data: imovel } = await supabase
    .from("imovel")
    .select("*, obra:obra_id(codigo, nome)")
    .is("deleted_at", null)
    .eq("id", id)
    .single();
  if (!imovel) notFound();

  const { data: contratosData } = await supabase
    .from("contrato_imovel")
    .select("*")
    .eq("imovel_id", id)
    .order("vigente", { ascending: false })
    .order("data_inicio", { ascending: false });
  const contratos = (contratosData ?? []) as Contrato[];

  // Histórico versionado (aditivos/reajustes/encerramentos) por contrato.
  const { data: histData } = await supabase
    .from("contrato_imovel_historico")
    .select("id, contrato_id, tipo, descricao, data_efeito")
    .eq("imovel_id", id)
    .order("data_efeito", { ascending: false })
    .order("created_at", { ascending: false });
  const histPorContrato = new Map<string, HistoricoItem[]>();
  for (const h of histData ?? []) {
    const arr = histPorContrato.get(h.contrato_id) ?? [];
    arr.push({ id: h.id, tipo: h.tipo, descricao: h.descricao, data_efeito: h.data_efeito });
    histPorContrato.set(h.contrato_id, arr);
  }

  // URLs assinadas para os anexos.
  const paths = contratos
    .flatMap((c) => [c.anexo_contrato_path, c.caucao_comprovante_path])
    .filter(Boolean) as string[];
  const urlDe = new Map<string, string>();
  await Promise.all(
    paths.map(async (p) => {
      const { data } = await supabase.storage.from("imoveis").createSignedUrl(p, 3600);
      if (data?.signedUrl) urlDe.set(p, data.signedUrl);
    }),
  );

  const { data: contasData } = await supabase
    .from("conta_consumo")
    .select("id, tipo, competencia, valor, vencimento, pago, lancamento_id")
    .eq("imovel_id", id)
    .order("competencia", { ascending: false });
  type Conta = {
    id: string;
    tipo: string;
    competencia: string;
    valor: number;
    vencimento: string | null;
    pago: boolean;
    lancamento_id: string | null;
  };
  const contas = (contasData ?? []) as Conta[];
  const totalConsumo = contas.reduce((s, c) => s + Number(c.valor), 0);

  // --- Fase 3: reparos, ocorrências, vistorias ---
  const [{ data: reparosData }, { data: ocorrenciasData }, { data: vistoriasData }] =
    await Promise.all([
      supabase.from("reparo_imovel").select("id, data, descricao, valor, executor, anexo_path").eq("imovel_id", id).order("data", { ascending: false }),
      supabase.from("ocorrencia_imovel").select("id, data, tipo, descricao, anexo_path").eq("imovel_id", id).order("data", { ascending: false }),
      supabase.from("vistoria_imovel").select("id, data, responsavel, observacoes, vistoria_imovel_foto(id, path)").eq("imovel_id", id).order("data", { ascending: false }),
    ]);
  type Reparo = { id: string; data: string; descricao: string; valor: number; executor: string | null; anexo_path: string | null };
  type Ocorrencia = { id: string; data: string; tipo: string; descricao: string; anexo_path: string | null };
  type VistoriaImv = { id: string; data: string; responsavel: string | null; observacoes: string | null; vistoria_imovel_foto: { id: string; path: string }[] };
  const reparos = (reparosData ?? []) as Reparo[];
  const ocorrencias = (ocorrenciasData ?? []) as Ocorrencia[];
  const vistorias = (vistoriasData ?? []) as VistoriaImv[];
  const totalReparos = reparos.reduce((s, r) => s + Number(r.valor), 0);

  const paths3 = [
    ...reparos.map((r) => r.anexo_path),
    ...ocorrencias.map((o) => o.anexo_path),
    ...vistorias.flatMap((v) => v.vistoria_imovel_foto.map((f) => f.path)),
  ].filter(Boolean) as string[];
  await Promise.all(
    paths3.map(async (p) => {
      const { data } = await supabase.storage.from("imoveis").createSignedUrl(p, 3600);
      if (data?.signedUrl) urlDe.set(p, data.signedUrl);
    }),
  );

  const { data: ocupantesData } = await supabase
    .from("ocupante_imovel")
    .select("id, nome, cpf, contato, data_entrada, data_saida")
    .eq("imovel_id", id)
    .order("created_at", { ascending: false });
  type Ocupante = { id: string; nome: string; cpf: string | null; contato: string | null; data_entrada: string | null; data_saida: string | null };
  const ocupantes = (ocupantesData ?? []) as Ocupante[];

  const st = STATUS_IMOVEL_INFO[imovel.status as StatusImovel];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Imóvel" titulo={imovel.apelido} descricao={tipoImovelLabel(imovel.tipo)}>
        <Button variant="outline" render={<a href={`/api/imoveis/${id}/contrato-pdf`} />}>
          <FileText className="size-4" /> Gerar contrato
        </Button>
        {podeEditar ? (
          <>
            <Button variant="outline" render={<Link href={`/imoveis/${id}/editar`} />}>
              <Pencil className="size-4" /> Editar
            </Button>
            <ConfirmDelete action={excluirImovel} id={id} mensagem="Excluir este imóvel e todos os seus contratos? Esta ação não pode ser desfeita." />
          </>
        ) : null}
      </PageHeader>

      {/* Dados */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            Dados
            <Badge variant={st?.variant ?? "secondary"}>{st?.label ?? imovel.status}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Campo label="Endereço" valor={imovel.endereco} span />
          <Campo label="Cidade/UF" valor={[imovel.cidade, imovel.uf].filter(Boolean).join("/")} />
          <Campo label="Capacidade" valor={imovel.capacidade_pessoas ? `${imovel.capacidade_pessoas} pessoas` : null} />
          <Campo label="Área" valor={imovel.area_m2 ? `${imovel.area_m2} m²` : null} />
          <Campo label="Obra / centro de custo" valor={imovel.obra ? `${imovel.obra.codigo} — ${imovel.obra.nome}` : null} />
          {imovel.observacoes ? <Campo label="Observações" valor={imovel.observacoes} span /> : null}
        </CardContent>
      </Card>

      {/* Contatos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contatos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Proprietário</p>
            <p className="font-medium">{imovel.proprietario_nome ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{imovel.proprietario_telefone ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{imovel.proprietario_email ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Imobiliária</p>
            <p className="font-medium">{imovel.imobiliaria_nome ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{imovel.imobiliaria_telefone ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{imovel.imobiliaria_email ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      {/* Dados bancários */}
      {imovel.banco || imovel.conta || imovel.pix_chave || imovel.titular_conta ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dados bancários</CardTitle>
            <CardDescription>Pagamento ao proprietário.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Campo label="Banco" valor={imovel.banco} />
            <Campo label="Agência" valor={imovel.agencia} />
            <Campo
              label="Conta"
              node={
                imovel.conta ? (
                  <span className="inline-flex items-center gap-1">
                    <PiiText value={imovel.conta} />
                    {imovel.tipo_conta === "corrente" ? " · corrente" : imovel.tipo_conta === "poupanca" ? " · poupança" : ""}
                  </span>
                ) : undefined
              }
            />
            <Campo label="Titular" valor={imovel.titular_conta} />
            <Campo label="Chave PIX" span node={imovel.pix_chave ? <PiiText value={imovel.pix_chave} keepEnd={4} /> : undefined} />
          </CardContent>
        </Card>
      ) : null}

      {/* Contratos */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Adicionar contrato
            </CardTitle>
            <CardDescription>Cadastre um novo contrato/renovação para este imóvel.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContratoImovelForm imovelId={id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contratos ({contratos.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
          ) : (
            contratos.map((c) => (
              <ContratoImovelCard
                key={c.id}
                imovelId={id}
                podeEditar={podeEditar}
                vigente={c.vigente}
                dataLabel={`${formatarData(c.data_inicio)} — ${c.data_fim ? formatarData(c.data_fim) : "sem fim"}`}
                contrato={{
                  id: c.id,
                  data_inicio: c.data_inicio,
                  data_fim: c.data_fim,
                  valor_aluguel: c.valor_aluguel,
                  valor_condominio: c.valor_condominio,
                  valor_iptu: c.valor_iptu,
                  seguro_fianca: c.seguro_fianca,
                  seguro_fianca_mensal: c.seguro_fianca_mensal,
                  dia_vencimento: c.dia_vencimento,
                  indice_reajuste: c.indice_reajuste,
                  data_reajuste: c.data_reajuste,
                  caucao_valor: c.caucao_valor,
                  caucao_status: c.caucao_status,
                  vigente: c.vigente,
                  observacoes: c.observacoes,
                }}
                deleteSlot={
                  podeEditar ? (
                    <ConfirmDelete action={excluirContratoImovel} id={c.id} hidden={{ imovel_id: id }} />
                  ) : null
                }
              >
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <Campo label="Aluguel" valor={formatarBRL(Number(c.valor_aluguel))} />
                  <Campo label="Condomínio" valor={formatarBRL(Number(c.valor_condominio))} />
                  <Campo label="IPTU" valor={formatarBRL(Number(c.valor_iptu))} />
                  <Campo
                    label="Seguro fiança"
                    valor={`${formatarBRL(Number(c.seguro_fianca))}${c.seguro_fianca_mensal ? "" : " (não somado)"}`}
                  />
                  <Campo
                    label="Total/mês"
                    valor={formatarBRL(
                      Number(c.valor_aluguel) +
                        Number(c.valor_condominio) +
                        Number(c.valor_iptu) +
                        (c.seguro_fianca_mensal ? Number(c.seguro_fianca) : 0),
                    )}
                  />
                  <Campo label="Vencimento" valor={c.dia_vencimento ? `dia ${c.dia_vencimento}` : null} />
                  <Campo label="Reajuste" valor={[c.indice_reajuste, c.data_reajuste ? formatarData(c.data_reajuste) : null].filter(Boolean).join(" · ")} />
                  <Campo label="Caução" valor={c.caucao_valor != null ? `${formatarBRL(Number(c.caucao_valor))}${c.caucao_status ? ` (${STATUS_CAUCAO_INFO[c.caucao_status as StatusCaucao]})` : ""}` : null} />
                  {c.observacoes ? <Campo label="Observações" valor={c.observacoes} span /> : null}
                </div>

                {/* Anexos */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <AnexoLinha
                    rotulo="contrato"
                    path={c.anexo_contrato_path}
                    url={c.anexo_contrato_path ? urlDe.get(c.anexo_contrato_path) : undefined}
                    campo="anexo_contrato_path"
                    contratoId={c.id}
                    imovelId={id}
                    orgId={orgId}
                    podeEditar={podeEditar}
                  />
                  <AnexoLinha
                    rotulo="comprovante de caução"
                    path={c.caucao_comprovante_path}
                    url={c.caucao_comprovante_path ? urlDe.get(c.caucao_comprovante_path) : undefined}
                    campo="caucao_comprovante_path"
                    contratoId={c.id}
                    imovelId={id}
                    orgId={orgId}
                    podeEditar={podeEditar}
                  />
                </div>

                <ContratoImovelAcoes
                  contratoId={c.id}
                  vigente={c.vigente}
                  aluguelAtual={Number(c.valor_aluguel)}
                  historico={histPorContrato.get(c.id) ?? []}
                  podeEditar={podeEditar}
                />
              </ContratoImovelCard>
            ))
          )}
        </CardContent>
      </Card>

      {/* Contas de consumo */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Adicionar conta de consumo
            </CardTitle>
            <CardDescription>
              Água, luz, gás, internet, IPTU — mês a mês. Pode lançar direto no financeiro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContaConsumoForm imovelId={id} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Contas de consumo ({contas.length})</span>
            <span className="text-sm font-normal text-muted-foreground">
              Total: {formatarBRL(totalConsumo)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contas.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">Nenhuma conta lançada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financeiro</TableHead>
                  {podeEditar ? <TableHead className="text-right">Ações</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.competencia.slice(0, 7).split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{tipoConsumoLabel(c.tipo)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.vencimento ? formatarData(c.vencimento) : "—"}
                    </TableCell>
                    <TableCell className="text-right">{formatarBRL(Number(c.valor))}</TableCell>
                    <TableCell>
                      <Badge variant={c.pago ? "secondary" : "default"}>
                        {c.pago ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lancamento_id ? "Lançado" : "—"}
                    </TableCell>
                    {podeEditar ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <form action={alternarPagoConsumo}>
                            <input type="hidden" name="id" value={c.id} />
                            <input type="hidden" name="imovel_id" value={id} />
                            <input type="hidden" name="novo_status" value={c.pago ? "pendente" : "pago"} />
                            <Button type="submit" variant="ghost" size="icon-sm" aria-label={c.pago ? "Reabrir" : "Marcar pago"}>
                              {c.pago ? <Undo2 /> : <Check />}
                            </Button>
                          </form>
                          <ConfirmDelete action={excluirContaConsumo} id={c.id} hidden={{ imovel_id: id }} />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Reparos */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Registrar reparo</CardTitle>
          </CardHeader>
          <CardContent><ReparoForm imovelId={id} /></CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Reparos ({reparos.length})</span>
            <span className="text-sm font-normal text-muted-foreground">Total: {formatarBRL(totalReparos)}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reparos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum reparo registrado.</p>
          ) : (
            reparos.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium">{r.descricao}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatarData(r.data)} · {formatarBRL(Number(r.valor))}
                    {r.executor ? ` · ${r.executor}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.anexo_path && urlDe.get(r.anexo_path) ? (
                    <a href={urlDe.get(r.anexo_path)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><FileText className="size-4" /> Anexo</a>
                  ) : (
                    <ImovelUpload kind="reparo" registroId={r.id} imovelId={id} orgId={orgId} rotulo="Anexar" />
                  )}
                  <ConfirmDelete action={excluirReparo} id={r.id} hidden={{ imovel_id: id }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Ocorrências */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Registrar ocorrência</CardTitle>
            <CardDescription>Avarias, desentendimentos, reparos e afins.</CardDescription>
          </CardHeader>
          <CardContent><OcorrenciaForm imovelId={id} /></CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ocorrências ({ocorrencias.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ocorrencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência.</p>
          ) : (
            ocorrencias.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{o.tipo}</p>
                  <p className="text-sm text-muted-foreground">{formatarData(o.data)} · {o.descricao}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.anexo_path && urlDe.get(o.anexo_path) ? (
                    <a href={urlDe.get(o.anexo_path)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><FileText className="size-4" /> Anexo</a>
                  ) : (
                    <ImovelUpload kind="ocorrencia" registroId={o.id} imovelId={id} orgId={orgId} rotulo="Anexar" />
                  )}
                  <ConfirmDelete action={excluirOcorrencia} id={o.id} hidden={{ imovel_id: id }} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Vistorias */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Nova vistoria</CardTitle>
          </CardHeader>
          <CardContent><VistoriaImovelForm imovelId={id} /></CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Vistorias ({vistorias.length})</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {vistorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma vistoria.</p>
          ) : (
            vistorias.map((v) => (
              <div key={v.id} className="border border-border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{formatarData(v.data)}{v.responsavel ? ` · ${v.responsavel}` : ""}</p>
                    {v.observacoes ? <p className="text-sm text-muted-foreground">{v.observacoes}</p> : null}
                  </div>
                  {podeEditar ? <ConfirmDelete action={excluirVistoriaImovel} id={v.id} hidden={{ imovel_id: id }} /> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {v.vistoria_imovel_foto.map((f) =>
                    urlDe.get(f.path) ? (
                      <a key={f.id} href={urlDe.get(f.path)} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
                        <FileText className="size-4" /> Foto
                      </a>
                    ) : null,
                  )}
                  {podeEditar ? (
                    <ImovelUpload kind="vistoria_foto" registroId={v.id} imovelId={id} orgId={orgId} rotulo="Adicionar foto" />
                  ) : null}
                  {v.vistoria_imovel_foto.length === 0 && !podeEditar ? (
                    <span className="text-sm text-muted-foreground">Sem fotos</span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Ocupantes */}
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base"><Plus className="size-4" /> Adicionar ocupante</CardTitle>
            <CardDescription>Para kitnet/casa/apartamento — base do termo de responsabilidade.</CardDescription>
          </CardHeader>
          <CardContent><OcupanteForm imovelId={id} /></CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Ocupantes ({ocupantes.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {ocupantes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum ocupante cadastrado.</p>
          ) : (
            ocupantes.map((o) => (
              <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium">
                    {o.nome}
                    {o.cpf ? <> · <PiiText value={o.cpf} keepEnd={2} /></> : null}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[o.contato, o.data_entrada ? `entrada ${formatarData(o.data_entrada)}` : null, o.data_saida ? `saída ${formatarData(o.data_saida)}` : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" render={<a href={`/api/imoveis/${id}/termo-pdf?ocupante=${o.id}`} />}>
                    <FileText className="size-4" /> Gerar termo
                  </Button>
                  {podeEditar ? <ConfirmDelete action={excluirOcupante} id={o.id} hidden={{ imovel_id: id }} /> : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AtividadeTimeline entidade="imovel" registroId={id} />
    </div>
  );
}

function Campo({
  label,
  valor,
  span,
  node,
}: {
  label: string;
  valor?: string | number | null | undefined;
  span?: boolean;
  node?: ReactNode;
}) {
  return (
    <div className={span ? "sm:col-span-3" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{node ?? (valor ? String(valor) : "—")}</p>
    </div>
  );
}

function AnexoLinha({
  rotulo,
  path,
  url,
  campo,
  contratoId,
  imovelId,
  orgId,
  podeEditar,
}: {
  rotulo: string;
  path: string | null;
  url?: string;
  campo: "anexo_contrato_path" | "caucao_comprovante_path";
  contratoId: string;
  imovelId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {path && url ? (
        <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <FileText className="size-4" /> Ver {rotulo}
        </a>
      ) : (
        <span className="text-sm text-muted-foreground">Sem {rotulo}</span>
      )}
      {podeEditar ? (
        <>
          <ImovelAnexoUploader
            contratoId={contratoId}
            imovelId={imovelId}
            orgId={orgId}
            campo={campo}
            tem={Boolean(path)}
            rotulo={rotulo}
          />
          {path ? (
            <form action={removerAnexoImovelContrato}>
              <input type="hidden" name="contrato_id" value={contratoId} />
              <input type="hidden" name="imovel_id" value={imovelId} />
              <input type="hidden" name="campo" value={campo} />
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                Remover
              </Button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
