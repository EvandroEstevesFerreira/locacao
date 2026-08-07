// Seção de fotos da vistoria. Busca os próprios dados para poder ser envolvida
// num <Suspense> — é ela que carrega a parte lenta da página, porque precisa
// assinar uma URL de Storage para cada foto.

import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { assinarUrls } from "@/lib/data/storage";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FotoUploader } from "../../foto-uploader";
import { FotoLegenda } from "../../foto-legenda";
import { excluirFoto } from "../../actions";

export async function VistoriaFotos({
  vistoriaId,
  orgId,
  podeEditar,
}: {
  vistoriaId: string;
  orgId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data: fotos } = await supabase
    .from("vistoria_foto")
    .select("id, path, legenda")
    .eq("vistoria_id", vistoriaId)
    .order("created_at");

  const lista = fotos ?? [];
  // Uma requisição para todas as fotos, não uma por foto.
  const urlPorPath = await assinarUrls(
    "vistorias",
    lista.map((f) => f.path),
  );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Fotos</CardTitle>
          <CardDescription>
            Prova do estado na retirada/devolução.
          </CardDescription>
        </div>
        {podeEditar ? (
          <FotoUploader vistoriaId={vistoriaId} orgId={orgId} />
        ) : null}
      </CardHeader>
      <CardContent>
        {lista.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {lista.map((f) => {
              const url = urlPorPath.get(f.path);
              return (
                <div key={f.id} className="group relative">
                  {url ? (
                    <Image
                      src={url}
                      alt={f.legenda ?? "Foto da vistoria"}
                      width={300}
                      height={300}
                      unoptimized
                      className="aspect-square w-full rounded-md object-cover"
                    />
                  ) : (
                    <div className="aspect-square rounded-md bg-muted" />
                  )}
                  {podeEditar ? (
                    <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <ConfirmDelete
                        action={excluirFoto}
                        id={f.id}
                        hidden={{ path: f.path, vistoria_id: vistoriaId }}
                        mensagem="Remover esta foto?"
                      />
                    </div>
                  ) : null}
                  {podeEditar ? (
                    <FotoLegenda
                      fotoId={f.id}
                      vistoriaId={vistoriaId}
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
          <p className="text-sm text-muted-foreground">Nenhuma foto ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Quantas fotos a vistoria tem — para o aviso de relatório pendente no topo. */
export async function contarFotos(vistoriaId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("vistoria_foto")
    .select("*", { count: "exact", head: true })
    .eq("vistoria_id", vistoriaId);
  return count ?? 0;
}
