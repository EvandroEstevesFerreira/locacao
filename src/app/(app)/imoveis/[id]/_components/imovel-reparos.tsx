// Reparos e ocorrências. Ficam juntos porque a estrutura é a mesma — registro
// com data, texto e um anexo opcional — e as duas listas são curtas.

import { FileText, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { ReparoForm, OcorrenciaForm } from "../../fase3-forms";
import { ImovelUpload } from "../../imovel-upload";
import { excluirReparo, excluirOcorrencia } from "../../actions";

type Reparo = {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  executor: string | null;
  anexo_path: string | null;
};
type Ocorrencia = {
  id: string;
  data: string;
  tipo: string;
  descricao: string;
  anexo_path: string | null;
};

export async function ImovelReparos({
  imovelId,
  orgId,
  podeEditar,
}: {
  imovelId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const [{ data: reparosData }, { data: ocorrenciasData }] = await Promise.all([
    supabase
      .from("reparo_imovel")
      .select("id, data, descricao, valor, executor, anexo_path")
      .eq("imovel_id", imovelId)
      .order("data", { ascending: false }),
    supabase
      .from("ocorrencia_imovel")
      .select("id, data, tipo, descricao, anexo_path")
      .eq("imovel_id", imovelId)
      .order("data", { ascending: false }),
  ]);

  const reparos = (reparosData ?? []) as Reparo[];
  const ocorrencias = (ocorrenciasData ?? []) as Ocorrencia[];
  const totalReparos = reparos.reduce((s, r) => s + Number(r.valor), 0);

  // Um lote para os anexos das duas listas.
  const urlDe = await assinarUrls("imoveis", [
    ...reparos.map((r) => r.anexo_path),
    ...ocorrencias.map((o) => o.anexo_path),
  ]);

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Registrar reparo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ReparoForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Reparos ({reparos.length})</span>
            <span className="text-sm font-normal text-muted-foreground">
              Total: {formatarBRL(totalReparos)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {reparos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum reparo registrado.
            </p>
          ) : (
            reparos.map((r) => (
              <LinhaRegistro
                key={r.id}
                titulo={r.descricao}
                subtitulo={`${formatarData(r.data)} · ${formatarBRL(Number(r.valor))}${r.executor ? ` · ${r.executor}` : ""}`}
                acoes={
                  <>
                    <AnexoOuUpload
                      url={r.anexo_path ? urlDe.get(r.anexo_path) : undefined}
                      kind="reparo"
                      registroId={r.id}
                      imovelId={imovelId}
                      orgId={orgId}
                      podeEditar={podeEditar}
                    />
                    {podeEditar ? (
                      <ConfirmDelete
                        action={excluirReparo}
                        id={r.id}
                        hidden={{ imovel_id: imovelId }}
                      />
                    ) : null}
                  </>
                }
              />
            ))
          )}
        </CardContent>
      </Card>

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Registrar ocorrência
            </CardTitle>
            <CardDescription>
              Avarias, desentendimentos, reparos e afins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OcorrenciaForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Ocorrências ({ocorrencias.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ocorrencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma ocorrência.</p>
          ) : (
            ocorrencias.map((o) => (
              <LinhaRegistro
                key={o.id}
                titulo={o.tipo}
                tituloCapitalizado
                subtitulo={`${formatarData(o.data)} · ${o.descricao}`}
                acoes={
                  <>
                    <AnexoOuUpload
                      url={o.anexo_path ? urlDe.get(o.anexo_path) : undefined}
                      kind="ocorrencia"
                      registroId={o.id}
                      imovelId={imovelId}
                      orgId={orgId}
                      podeEditar={podeEditar}
                    />
                    {podeEditar ? (
                      <ConfirmDelete
                        action={excluirOcorrencia}
                        id={o.id}
                        hidden={{ imovel_id: imovelId }}
                      />
                    ) : null}
                  </>
                }
              />
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}

function LinhaRegistro({
  titulo,
  tituloCapitalizado,
  subtitulo,
  acoes,
}: {
  titulo: string;
  tituloCapitalizado?: boolean;
  subtitulo: string;
  acoes: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0">
      <div className="min-w-0">
        <p className={`font-medium${tituloCapitalizado ? " capitalize" : ""}`}>
          {titulo}
        </p>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      <div className="flex items-center gap-2">{acoes}</div>
    </div>
  );
}

/**
 * Link para o anexo, ou o botão de anexar quando ainda não há arquivo.
 *
 * O gate por `podeEditar` é novo: estas duas listas eram as únicas da página que
 * mostravam "Anexar" e o botão de excluir a quem só tem leitura — vistorias e
 * ocupantes, ao lado, já os escondiam.
 */
function AnexoOuUpload({
  url,
  kind,
  registroId,
  imovelId,
  orgId,
  podeEditar,
}: {
  url?: string;
  kind: "reparo" | "ocorrencia";
  registroId: string;
  imovelId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <FileText className="size-4" /> Anexo
      </a>
    );
  }
  if (!podeEditar) {
    return <span className="text-sm text-muted-foreground">Sem anexo</span>;
  }
  return (
    <ImovelUpload
      kind={kind}
      registroId={registroId}
      imovelId={imovelId}
      orgId={orgId}
      rotulo="Anexar"
    />
  );
}
