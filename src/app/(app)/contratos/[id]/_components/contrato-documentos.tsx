// Contrato assinado (original) e os aditivos/renovações. É a seção mais lenta da
// rota: precisa assinar uma URL de Storage por arquivo. Fica atrás de um
// <Suspense> por isso.

import { Download, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import { formatarData } from "@/lib/locacao";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AnexoUploader } from "../../anexo-uploader";
import { ContratoDocsUploader } from "../../contrato-docs-uploader";
import { removerAnexoContrato, removerContratoDoc } from "../../actions";

const DOC_LABEL: Record<string, string> = {
  aditivo: "Aditivo",
  renovacao: "Renovação",
  outro: "Documento",
};

export async function ContratoDocumentos({
  contratoId,
  anexoPath,
  orgId,
  podeEditar,
}: {
  contratoId: string;
  /** Caminho do contrato original, que vive na própria linha de contrato. */
  anexoPath: string | null;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contrato_anexo")
    .select("id, tipo, descricao, path, data")
    .eq("contrato_id", contratoId)
    .order("data", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  type Doc = {
    id: string;
    tipo: string;
    descricao: string | null;
    path: string;
    data: string | null;
  };
  const docs = (data ?? []) as Doc[];

  // Uma requisição para o anexo original e todos os aditivos juntos — antes era
  // uma por arquivo.
  const docUrl = await assinarUrls("contratos", [
    anexoPath,
    ...docs.map((d) => d.path),
  ]);
  const anexoUrl = anexoPath ? docUrl.get(anexoPath) ?? null : null;

  return (
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
                <ConfirmDelete
                  action={removerAnexoContrato}
                  id={contratoId}
                  hidden={{ contrato_id: contratoId, path: anexoPath ?? "" }}
                  rotulo="Remover"
                  mensagem="Remover o contrato anexado? O arquivo será apagado."
                />
              ) : null}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Nenhum arquivo</span>
          )}
          {podeEditar ? (
            <AnexoUploader
              contratoId={contratoId}
              orgId={orgId}
              tem={!!anexoUrl}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 border-t pt-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Aditivos e renovações
        </p>
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum aditivo ou renovação anexado.
          </p>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => {
              const url = docUrl.get(d.path);
              return (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">
                      {DOC_LABEL[d.tipo] ?? d.tipo}
                    </span>
                    {d.descricao ? (
                      <span className="text-muted-foreground">
                        {" "}
                        — {d.descricao}
                      </span>
                    ) : null}
                    {d.data ? (
                      <span className="block text-xs text-muted-foreground">
                        {formatarData(d.data)}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Download className="size-4" /> Abrir
                      </a>
                    ) : null}
                    {podeEditar ? (
                      <ConfirmDelete
                        action={removerContratoDoc}
                        id={d.id}
                        hidden={{ contrato_id: contratoId, path: d.path }}
                        rotulo="Remover"
                        mensagem="Remover este documento? O arquivo será apagado."
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {podeEditar ? (
          <ContratoDocsUploader contratoId={contratoId} orgId={orgId} />
        ) : null}
      </CardContent>
    </Card>
  );
}
