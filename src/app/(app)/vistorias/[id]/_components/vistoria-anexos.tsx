// Seção dos documentos da CONTRAPARTE: protocolo de retirada, ordem de serviço.
//
// Busca os próprios dados para poder viver num <Suspense>, como a de fotos —
// e pelo mesmo motivo: precisa assinar uma URL de Storage por arquivo.
//
// Por que não é a seção de fotos. O relatório em PDF desenha toda linha de
// `vistoria_foto` como imagem; um PDF de protocolo ali quebraria a renderização
// do documento. São coisas diferentes que moram na mesma bucket.

import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import { formatarData } from "@/lib/locacao";
import { TIPO_ANEXO_VISTORIA, tipoAnexoValido } from "@/lib/vistoria";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AnexoUploader } from "../../anexo-uploader";
import { excluirAnexo } from "../../actions";

export async function VistoriaAnexos({
  vistoriaId,
  orgId,
  podeEditar,
}: {
  vistoriaId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data: anexos } = await supabase
    .from("vistoria_anexo")
    .select("id, tipo, descricao, path, created_at")
    .eq("vistoria_id", vistoriaId)
    .order("created_at");

  const lista = anexos ?? [];
  // Uma requisição para todos os anexos, não uma por anexo.
  const urlPorPath = await assinarUrls(
    "vistorias",
    lista.map((a) => a.path as string),
  );

  return (
    <Card>
      <CardHeader className="space-y-0">
        <CardTitle className="text-base">Protocolos e OS</CardTitle>
        <CardDescription>
          Documento que a contraparte trouxe — protocolo de retirada, ordem de
          serviço. Fica guardado aqui e não sai no relatório.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {podeEditar ? (
          <AnexoUploader vistoriaId={vistoriaId} orgId={orgId} />
        ) : null}

        {lista.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {lista.map((a) => {
              const url = urlPorPath.get(a.path as string);
              const tipo = tipoAnexoValido(a.tipo as string);
              const nome = String(a.path).split("/").pop() ?? "documento";
              return (
                <li
                  key={a.id as string}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm"
                >
                  <Badge variant="secondary">{TIPO_ANEXO_VISTORIA[tipo]}</Badge>
                  <span className="min-w-0 flex-1">
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2"
                      >
                        {a.descricao ? String(a.descricao) : nome}
                      </a>
                    ) : (
                      /* URL não assinada: o arquivo existe na linha e não no
                         Storage, ou a assinatura falhou. Mostrar o nome sem link
                         é mais honesto que um link que não abre. */
                      <span className="text-muted-foreground">
                        {a.descricao ? String(a.descricao) : nome}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatarData(String(a.created_at).slice(0, 10))}
                  </span>
                  {podeEditar ? (
                    <ConfirmDelete
                      action={excluirAnexo}
                      id={a.id as string}
                      hidden={{ path: a.path as string, vistoria_id: vistoriaId }}
                      mensagem="Remover este documento?"
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum documento anexado a esta vistoria.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
