// Vistorias do imóvel, com as fotos de cada uma.

import { FileText, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import { formatarData } from "@/lib/locacao";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { VistoriaImovelForm } from "../../fase3-forms";
import { ImovelUpload } from "../../imovel-upload";
import { excluirVistoriaImovel } from "../../actions";

type VistoriaDoImovel = {
  id: string;
  data: string;
  responsavel: string | null;
  observacoes: string | null;
  vistoria_imovel_foto: { id: string; path: string }[];
};

export async function ImovelVistorias({
  imovelId,
  orgId,
  podeEditar,
}: {
  imovelId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vistoria_imovel")
    .select("id, data, responsavel, observacoes, vistoria_imovel_foto(id, path)")
    .eq("imovel_id", imovelId)
    .order("data", { ascending: false });

  const vistorias = (data ?? []) as VistoriaDoImovel[];

  // Um lote para as fotos de todas as vistorias.
  const urlDe = await assinarUrls(
    "imoveis",
    vistorias.flatMap((v) => v.vistoria_imovel_foto.map((f) => f.path)),
  );

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Nova vistoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VistoriaImovelForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Vistorias ({vistorias.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {vistorias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma vistoria.</p>
          ) : (
            vistorias.map((v) => (
              <div key={v.id} className="rounded-md border border-border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {formatarData(v.data)}
                      {v.responsavel ? ` · ${v.responsavel}` : ""}
                    </p>
                    {v.observacoes ? (
                      <p className="text-sm text-muted-foreground">
                        {v.observacoes}
                      </p>
                    ) : null}
                  </div>
                  {podeEditar ? (
                    <ConfirmDelete
                      action={excluirVistoriaImovel}
                      id={v.id}
                      hidden={{ imovel_id: imovelId }}
                    />
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {v.vistoria_imovel_foto.map((f) => {
                    const url = urlDe.get(f.path);
                    return url ? (
                      <a
                        key={f.id}
                        href={url}
                        target="_blank"
                        rel="noopener"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <FileText className="size-4" /> Foto
                      </a>
                    ) : null;
                  })}
                  {podeEditar ? (
                    <ImovelUpload
                      kind="vistoria_foto"
                      registroId={v.id}
                      imovelId={imovelId}
                      orgId={orgId}
                      rotulo="Adicionar foto"
                    />
                  ) : null}
                  {v.vistoria_imovel_foto.length === 0 && !podeEditar ? (
                    <span className="text-sm text-muted-foreground">
                      Sem fotos
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
