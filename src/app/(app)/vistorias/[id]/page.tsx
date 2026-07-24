import Image from "next/image";
import { notFound } from "next/navigation";
import { AlertTriangle, FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar } from "@/lib/auth";
import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  STATUS_AVARIA,
  TIPO_VISTORIA,
  type StatusAvaria,
  type TipoVistoria,
} from "@/lib/vistoria";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FotoUploader } from "../foto-uploader";
import { AddAvariaForm } from "../add-avaria-form";
import { RelatorioForm } from "../relatorio-form";
import { FotoLegenda } from "../foto-legenda";
import {
  atualizarStatusAvaria,
  excluirAvaria,
  excluirFoto,
  excluirVistoria,
} from "../actions";

export const metadata = { title: "Vistoria — Loca" };

const selectClasses =
  "h-8 rounded-md border border-input bg-transparent px-2 text-xs outline-none";

export default async function VistoriaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeOperar(perfil?.papel);
  const { id } = await params;

  const supabase = await createClient();
  const { data: vistoria } = await supabase
    .from("vistoria")
    .select(
      "id, tipo, data, responsavel, observacoes, assinatura_empresa_nome, assinatura_empresa_img, assinatura_retirante_nome, assinatura_retirante_img, contrato:contrato_id(numero, obra:obra_id(codigo,nome))",
    )
    .eq("id", id)
    .single();

  if (!vistoria) notFound();
  const contrato = vistoria.contrato as unknown as {
    numero: string;
    obra: { codigo: string; nome: string } | null;
  } | null;

  const { data: fotos } = await supabase
    .from("vistoria_foto")
    .select("id, path, legenda")
    .eq("vistoria_id", id)
    .order("created_at");

  const paths = (fotos ?? []).map((f) => f.path);
  const assinadas = paths.length
    ? (await supabase.storage.from("vistorias").createSignedUrls(paths, 3600))
        .data ?? []
    : [];
  const urlPorPath = new Map(assinadas.map((s) => [s.path, s.signedUrl]));

  const { data: avarias } = await supabase
    .from("avaria")
    .select("id, descricao, custo_estimado, status")
    .eq("vistoria_id", id)
    .order("created_at");

  const totalAvarias = (avarias ?? []).reduce(
    (s, a) => s + Number(a.custo_estimado),
    0,
  );

  // Contexto: esta vistoria é o relatório de uma devolução?
  const { data: movs } = await supabase
    .from("movimentacao")
    .select("quantidade, item_locado:item_locado_id(item:item_id(descricao))")
    .eq("vistoria_id", id);
  const mov = (movs ?? [])[0] as unknown as
    | { quantidade: number; item_locado: { item: { descricao: string } | null } | null }
    | undefined;
  const contextoDevolucao = mov
    ? `Devolução de ${mov.quantidade} un. de ${mov.item_locado?.item?.descricao ?? "item"}`
    : null;

  const semFotos = (fotos?.length ?? 0) === 0;
  const empresaImg = (vistoria.assinatura_empresa_img as string | null) ?? null;
  const empresaAssinado = !!empresaImg;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        eyebrow="Relatório de vistoria"
        titulo="Vistoria"
        descricao={
          contrato
            ? `Contrato ${contrato.numero}${contrato.obra ? ` · ${contrato.obra.codigo}` : ""}`
            : undefined
        }
      >
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
          <form action={excluirVistoria}>
            <input type="hidden" name="id" value={vistoria.id} />
            <Button variant="outline" type="submit" className="text-destructive">
              Excluir vistoria
            </Button>
          </form>
        ) : null}
      </PageHeader>

      {contextoDevolucao ? (
        <p className="text-sm text-muted-foreground">{contextoDevolucao}</p>
      ) : null}

      {semFotos ? (
        <div className="flex items-center gap-2 border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          Relatório pendente: adicione ao menos uma foto para concluí-lo.
        </div>
      ) : null}

      {!empresaAssinado ? (
        <div className="flex items-center gap-2 border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
          <AlertTriangle className="size-4 shrink-0" />
          Relatório <strong>não assinado</strong> pelo representante da empresa.
          A assinatura é opcional, mas recomendada antes de finalizar.
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
          <Info label="Data" valor={formatarData(vistoria.data)} />
          <Info label="Responsável" valor={vistoria.responsavel ?? "—"} />
          <Info
            label="Avarias (custo est.)"
            valor={formatarBRL(totalAvarias)}
          />
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Fotos</CardTitle>
            <CardDescription>Prova do estado na retirada/devolução.</CardDescription>
          </div>
          {podeEditar ? (
            <FotoUploader vistoriaId={vistoria.id} orgId={perfil!.org_id!} />
          ) : null}
        </CardHeader>
        <CardContent>
          {(fotos?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {fotos!.map((f) => {
                const url = urlPorPath.get(f.path);
                return (
                  <div key={f.id} className="group relative">
                    {url ? (
                      <Image
                        src={url}
                        alt="Foto da vistoria"
                        width={300}
                        height={300}
                        unoptimized
                        className="aspect-square w-full rounded-md object-cover"
                      />
                    ) : (
                      <div className="aspect-square rounded-md bg-muted" />
                    )}
                    {podeEditar ? (
                      <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <ConfirmDelete
                          action={excluirFoto}
                          id={f.id}
                          hidden={{ path: f.path, vistoria_id: vistoria.id }}
                          mensagem="Remover esta foto?"
                        />
                      </div>
                    ) : null}
                    {podeEditar ? (
                      <FotoLegenda
                        fotoId={f.id}
                        vistoriaId={vistoria.id}
                        defaultValue={f.legenda ?? ""}
                      />
                    ) : f.legenda ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.legenda}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma foto ainda.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Avarias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avarias</CardTitle>
          <CardDescription>
            Registre danos que podem gerar cobrança do fornecedor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(avarias?.length ?? 0) > 0 ? (
            <ul className="divide-y rounded-md border">
              {avarias!.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{a.descricao}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {formatarBRL(Number(a.custo_estimado))}
                    </span>
                  </div>
                  <Badge variant={STATUS_AVARIA[a.status as StatusAvaria].variant}>
                    {STATUS_AVARIA[a.status as StatusAvaria].label}
                  </Badge>
                  {podeEditar ? (
                    <div className="flex items-center gap-2">
                      <form action={atualizarStatusAvaria} className="flex gap-1">
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="vistoria_id" value={vistoria.id} />
                        <select
                          name="status"
                          defaultValue={a.status}
                          className={selectClasses}
                        >
                          <option value="aberta">Aberta</option>
                          <option value="cobrada">Cobrada</option>
                          <option value="resolvida">Resolvida</option>
                        </select>
                        <Button type="submit" size="sm" variant="outline">
                          Salvar
                        </Button>
                      </form>
                      <ConfirmDelete
                        action={excluirAvaria}
                        id={a.id}
                        hidden={{ vistoria_id: vistoria.id }}
                        mensagem="Remover esta avaria?"
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma avaria registrada.
            </p>
          )}

          {podeEditar ? <AddAvariaForm key={avarias?.length ?? 0} vistoriaId={vistoria.id} /> : null}
        </CardContent>
      </Card>

      {/* Observações e assinaturas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Observações e assinaturas</CardTitle>
          <CardDescription>
            Observações e as duas assinaturas (representante e quem retira).
            Entram no PDF do relatório.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {podeEditar ? (
            <RelatorioForm
              vistoriaId={vistoria.id}
              usuarioNome={perfil?.nome ?? ""}
              defaults={{
                observacoes: vistoria.observacoes ?? "",
                empresaNome:
                  (vistoria.assinatura_empresa_nome as string | null) ?? "",
                empresaImg: empresaImg ?? "",
                retiranteNome:
                  (vistoria.assinatura_retirante_nome as string | null) ?? "",
                retiranteImg:
                  (vistoria.assinatura_retirante_img as string | null) ?? "",
              }}
            />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="text-muted-foreground">
                {vistoria.observacoes || "Sem observações."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <AssinaturaRO
                  label="Representante Sistenge"
                  nome={
                    (vistoria.assinatura_empresa_nome as string | null) ?? "—"
                  }
                  assinado={empresaAssinado}
                />
                <AssinaturaRO
                  label="Quem retira / recebe"
                  nome={
                    (vistoria.assinatura_retirante_nome as string | null) ?? "—"
                  }
                  assinado={!!vistoria.assinatura_retirante_img}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AssinaturaRO({
  label,
  nome,
  assinado,
}: {
  label: string;
  nome: string;
  assinado: boolean;
}) {
  return (
    <div className="border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{nome}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {assinado ? "Assinatura registrada" : "Sem assinatura"}
      </p>
    </div>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{valor}</p>
    </div>
  );
}
