"use client";

// O que esta peça precisa ter em dia — e o que ela não tem.
//
// A seção é organizada por EXIGÊNCIA, e não por certificado lançado. A
// diferença é a razão de a fatia existir: uma lista de certificados mostra o que
// existe, e a exigência que ninguém cumpriu nunca não apareceria em lugar
// nenhum — que é exatamente o caso que interdita máquina em fiscalização.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Upload,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  ESPECIE_INFO,
  ESTADO_CERTIFICADO_INFO,
  venceEmProposto,
  type EspecieCertificado,
} from "@/lib/certificado";
import type {
  PendenciaCertificado,
  CertificadoDaPeca,
} from "@/lib/data/certificados";
import { formatarData } from "@/lib/locacao";
import { registrarCertificado, excluirCertificado } from "../certificado-actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function nomeSeguro(nome: string) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
}

export function PecaCertificados({
  unidadeId,
  orgId,
  pendencias,
  certificados,
  urls,
  podeEditar,
}: {
  unidadeId: string;
  orgId: string;
  pendencias: PendenciaCertificado[];
  certificados: CertificadoDaPeca[];
  /** caminho no bucket → URL assinada, montado no servidor em um lote só. */
  urls: Record<string, string>;
  podeEditar: boolean;
}) {
  const [lancando, setLancando] = useState<EspecieCertificado | null>(null);
  const [aberta, setAberta] = useState<EspecieCertificado | null>(null);

  // Peça de tipo que não exige nada não mostra a seção. Um cartão vazio em todo
  // notebook do parque ensina a ignorar o cartão — e ele precisa ser lido
  // justamente nas peças em que aparece.
  if (pendencias.length === 0) return null;

  const problemas = pendencias.filter(
    (p) => p.estado === "ausente" || p.estado === "vencido",
  ).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4" aria-hidden />
          Certificados
        </CardTitle>
        <CardDescription>
          {problemas === 0
            ? `${pendencias.length} ${pendencias.length === 1 ? "exigência" : "exigências"} — tudo em dia.`
            : `${problemas} ${problemas === 1 ? "exigência" : "exigências"} sem certificado válido. Equipamento nessa condição é interditado em fiscalização.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {pendencias.map((p) => {
          const info = ESTADO_CERTIFICADO_INFO[p.estado];
          const historico = certificados.filter((c) => c.especie === p.especie);
          const expandida = aberta === p.especie;

          return (
            <div key={p.especie} className="rounded-md border">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{ESPECIE_INFO[p.especie].label}</span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {p.venceEm
                      ? `vence em ${formatarData(p.venceEm)}`
                      : "nunca foi lançado"}
                    {p.periodicidadeMeses
                      ? ` · renova a cada ${p.periodicidadeMeses} meses`
                      : ""}
                  </span>
                </span>

                <Badge variant={info.variant}>{info.label}</Badge>

                {historico.length > 0 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAberta(expandida ? null : p.especie)}
                  >
                    {expandida ? (
                      <ChevronDown className="size-3.5" aria-hidden />
                    ) : (
                      <ChevronRight className="size-3.5" aria-hidden />
                    )}
                    {historico.length} {historico.length === 1 ? "emissão" : "emissões"}
                  </Button>
                ) : null}

                {podeEditar ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setLancando(lancando === p.especie ? null : p.especie)
                    }
                  >
                    <Plus className="size-3.5" aria-hidden />
                    {p.venceEm ? "Renovar" : "Lançar"}
                  </Button>
                ) : null}
              </div>

              {lancando === p.especie ? (
                <div className="border-t bg-muted/30 p-3">
                  <CertificadoForm
                    unidadeId={unidadeId}
                    orgId={orgId}
                    especie={p.especie}
                    periodicidadeMeses={p.periodicidadeMeses}
                    aoConcluir={() => setLancando(null)}
                  />
                </div>
              ) : null}

              {expandida ? (
                <div className="divide-y border-t">
                  {historico.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 flex-1">
                        {formatarData(c.venceEm)}
                        {c.emitidoEm ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · emitido em {formatarData(c.emitidoEm)}
                          </span>
                        ) : null}
                        {c.numero ? (
                          <span className="text-muted-foreground"> · nº {c.numero}</span>
                        ) : null}
                        {c.responsavel ? (
                          <span className="text-muted-foreground"> · {c.responsavel}</span>
                        ) : null}
                        {!c.atual ? (
                          <Badge variant="outline" className="ml-2">
                            Substituído
                          </Badge>
                        ) : null}
                      </span>

                      {c.arquivoPath && urls[c.arquivoPath] ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          render={
                            <a
                              href={urls[c.arquivoPath]}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <FileText className="size-3.5" aria-hidden />
                          Laudo
                        </Button>
                      ) : null}

                      {podeEditar ? (
                        <ExcluirCertificado id={c.id} unidadeId={unidadeId} />
                      ) : null}
                    </div>
                  ))}
                  {observacoesDo(historico)}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** As observações, quando existem, abaixo da lista — não em cada linha. */
function observacoesDo(historico: CertificadoDaPeca[]) {
  const comNota = historico.filter((c) => c.observacoes);
  if (comNota.length === 0) return null;
  return (
    <div className="space-y-1 px-3 py-2">
      {comNota.map((c) => (
        <p key={c.id} className="text-xs text-muted-foreground">
          <span className="font-medium">{formatarData(c.venceEm)}:</span>{" "}
          {c.observacoes}
        </p>
      ))}
    </div>
  );
}

function ExcluirCertificado({ id, unidadeId }: { id: string; unidadeId: string }) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Excluir certificado"
      disabled={pendente}
      onClick={() =>
        startTransition(async () => {
          const r = await excluirCertificado(id, unidadeId);
          if (!r.ok) {
            toast.error(r.erro);
            return;
          }
          toast.success("Certificado excluído.");
          router.refresh();
        })
      }
    >
      <Trash2 className="size-3.5" />
    </Button>
  );
}

function CertificadoForm({
  unidadeId,
  orgId,
  especie,
  periodicidadeMeses,
  aoConcluir,
}: {
  unidadeId: string;
  orgId: string;
  especie: EspecieCertificado;
  periodicidadeMeses: number | null;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [emitidoEm, setEmitidoEm] = useState("");
  const [venceEm, setVenceEm] = useState("");
  // `true` enquanto o vencimento ainda é o proposto. A primeira digitação no
  // campo desliga a proposta: a validade impressa no laudo é que manda, e
  // sobrescrevê-la a cada tecla na data de emissão apagaria o que a pessoa
  // acabou de ler no papel.
  const [venceAuto, setVenceAuto] = useState(true);
  const [numero, setNumero] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  function mudarEmissao(v: string) {
    setEmitidoEm(v);
    if (!venceAuto) return;
    const proposto = venceEmProposto(v, periodicidadeMeses);
    if (proposto) setVenceEm(proposto);
  }

  async function salvar() {
    setErro(null);
    setEnviando(true);
    const supabase = createClient();
    let path: string | null = null;

    try {
      const file = inputRef.current?.files?.[0];
      if (file) {
        const uid = crypto.randomUUID();
        path = `${orgId}/${unidadeId}/${uid}-${nomeSeguro(file.name)}`;
        const { error } = await supabase.storage
          .from("certificados")
          .upload(path, file, { upsert: false });
        if (error) {
          setErro("Falha ao enviar o arquivo.");
          return;
        }
      }

      const r = await registrarCertificado(
        {
          unidade_id: unidadeId,
          especie,
          emitido_em: emitidoEm,
          vence_em: venceEm,
          numero,
          responsavel,
          observacoes,
        },
        path,
      );

      if (!r.ok) {
        // O arquivo já subiu e o registro não entrou. Sem esta remoção, o
        // bucket acumula PDF que nenhuma tela alcança.
        if (path) await supabase.storage.from("certificados").remove([path]);
        setErro(r.erro);
        return;
      }

      toast.success("Certificado registrado.");
      startTransition(() => router.refresh());
      aoConcluir();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{ESPECIE_INFO[especie].label}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="emitido_em">Emitido em</Label>
          <Input
            id="emitido_em"
            type="date"
            value={emitidoEm}
            onChange={(e) => mudarEmissao(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Pode ficar em branco — laudo antigo às vezes chega só com a validade.
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="vence_em">Vence em</Label>
          <Input
            id="vence_em"
            type="date"
            required
            value={venceEm}
            onChange={(e) => {
              setVenceEm(e.target.value);
              setVenceAuto(false);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {periodicidadeMeses
              ? `Proposto pela periodicidade de ${periodicidadeMeses} meses. Vale o que estiver impresso no laudo.`
              : "Copie a validade impressa no laudo."}
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor="numero">Número</Label>
          <Input
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número da ART ou do laudo"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="responsavel">Responsável</Label>
          <Input
            id="responsavel"
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            placeholder="Empresa ou profissional que emitiu"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="arquivo">Laudo em PDF</Label>
        <Input
          id="arquivo"
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
        />
        <p className="text-xs text-muted-foreground">
          Opcional. A data já vale sozinha — mas em fiscalização quem responde é
          o papel.
        </p>
      </div>

      {erro ? <p className="text-sm text-destructive">{erro}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={salvar} disabled={enviando || !venceEm}>
          <Upload className="size-3.5" aria-hidden />
          {enviando ? "Salvando…" : "Registrar certificado"}
        </Button>
        <Button variant="ghost" size="sm" onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
