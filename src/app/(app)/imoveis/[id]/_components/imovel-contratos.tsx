// Contratos do imóvel: cadastro, lista com valores, anexos e o histórico
// versionado (aditivos, reajustes, encerramentos).
//
// Busca os próprios dados: contratos, histórico e as URLs assinadas dos dois
// anexos de cada contrato, num lote só.

import { FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { STATUS_CAUCAO_INFO, type StatusCaucao } from "@/lib/imoveis";
import { Campo } from "@/components/shared/campo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ContratoImovelForm } from "../../contrato-imovel-form";
import { ContratoImovelCard } from "../../contrato-imovel-card";
import {
  ContratoImovelAcoes,
  type HistoricoItem,
} from "../../contrato-imovel-acoes";
import { ImovelAnexoUploader } from "../../imovel-anexo-uploader";
import {
  excluirContratoImovel,
  removerAnexoImovelContrato,
} from "../../actions";

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

export async function ImovelContratos({
  imovelId,
  orgId,
  podeEditar,
}: {
  imovelId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const [{ data: contratosData }, { data: histData }] = await Promise.all([
    supabase
      .from("contrato_imovel")
      .select("*")
      .eq("imovel_id", imovelId)
      .order("vigente", { ascending: false })
      .order("data_inicio", { ascending: false }),
    supabase
      .from("contrato_imovel_historico")
      .select("id, contrato_id, tipo, descricao, data_efeito")
      .eq("imovel_id", imovelId)
      .order("data_efeito", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const contratos = (contratosData ?? []) as Contrato[];

  const histPorContrato = new Map<string, HistoricoItem[]>();
  for (const h of histData ?? []) {
    const arr = histPorContrato.get(h.contrato_id) ?? [];
    arr.push({
      id: h.id,
      tipo: h.tipo,
      descricao: h.descricao,
      data_efeito: h.data_efeito,
    });
    histPorContrato.set(h.contrato_id, arr);
  }

  // Um lote para o contrato e o comprovante de caução de todos os contratos.
  const urlDe = await assinarUrls(
    "imoveis",
    contratos.flatMap((c) => [c.anexo_contrato_path, c.caucao_comprovante_path]),
  );

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Adicionar contrato
            </CardTitle>
            <CardDescription>
              Cadastre um novo contrato/renovação para este imóvel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContratoImovelForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Contratos ({contratos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {contratos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum contrato cadastrado.
            </p>
          ) : (
            contratos.map((c) => (
              <ContratoImovelCard
                key={c.id}
                imovelId={imovelId}
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
                    <ConfirmDelete
                      action={excluirContratoImovel}
                      id={c.id}
                      hidden={{ imovel_id: imovelId }}
                    />
                  ) : null
                }
              >
                <div className="grid gap-3 text-sm sm:grid-cols-3">
                  <Campo
                    label="Aluguel"
                    valor={formatarBRL(Number(c.valor_aluguel))}
                  />
                  <Campo
                    label="Condomínio"
                    valor={formatarBRL(Number(c.valor_condominio))}
                  />
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
                  <Campo
                    label="Vencimento"
                    valor={c.dia_vencimento ? `dia ${c.dia_vencimento}` : null}
                  />
                  <Campo
                    label="Reajuste"
                    valor={[
                      c.indice_reajuste,
                      c.data_reajuste ? formatarData(c.data_reajuste) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                  <Campo
                    label="Caução"
                    valor={
                      c.caucao_valor != null
                        ? `${formatarBRL(Number(c.caucao_valor))}${c.caucao_status ? ` (${STATUS_CAUCAO_INFO[c.caucao_status as StatusCaucao]})` : ""}`
                        : null
                    }
                  />
                  {c.observacoes ? (
                    <Campo label="Observações" valor={c.observacoes} span />
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <AnexoLinha
                    rotulo="contrato"
                    path={c.anexo_contrato_path}
                    url={
                      c.anexo_contrato_path
                        ? urlDe.get(c.anexo_contrato_path)
                        : undefined
                    }
                    campo="anexo_contrato_path"
                    contratoId={c.id}
                    imovelId={imovelId}
                    orgId={orgId}
                    podeEditar={podeEditar}
                  />
                  <AnexoLinha
                    rotulo="comprovante de caução"
                    path={c.caucao_comprovante_path}
                    url={
                      c.caucao_comprovante_path
                        ? urlDe.get(c.caucao_comprovante_path)
                        : undefined
                    }
                    campo="caucao_comprovante_path"
                    contratoId={c.id}
                    imovelId={imovelId}
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
    </>
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
        <a
          href={url}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
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
            <ConfirmDelete
              action={removerAnexoImovelContrato}
              id={contratoId}
              hidden={{ contrato_id: contratoId, imovel_id: imovelId, campo }}
              rotulo="Remover"
              mensagem="Remover este anexo? O arquivo será apagado."
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
