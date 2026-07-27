import { FileText, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { formatarData } from "@/lib/locacao";
import {
  CATEGORIAS_BIBLIOTECA,
  CATEGORIA_BIBLIOTECA_INFO,
} from "@/lib/biblioteca";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDelete } from "@/components/confirm-delete";
import { BibliotecaUploader } from "../biblioteca-uploader";
import { excluirDocumentoBiblioteca } from "../actions";

export const metadata = { title: "Documentos do alojamento — Loca" };

type Doc = {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string | null;
  path: string;
  created_at: string;
};

export default async function DocumentosPage() {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);

  const supabase = await createClient();
  const { data } = await supabase
    .from("biblioteca_documento")
    .select("id, categoria, titulo, descricao, path, created_at")
    .order("created_at", { ascending: false });
  const docs = (data ?? []) as Doc[];

  const url = new Map<string, string>();
  await Promise.all(
    docs.map(async (d) => {
      const { data } = await supabase.storage.from("imoveis").createSignedUrl(d.path, 3600);
      if (data?.signedUrl) url.set(d.path, data.signedUrl);
    }),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Imóveis"
        titulo="Documentos do alojamento"
        descricao="Normativos, formulários e placas padronizadas — para consultar, baixar e imprimir."
      />

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar documento</CardTitle>
            <CardDescription>
              Envie PDF, imagem, Word, PowerPoint ou Excel. Ficam disponíveis para
              toda a organização.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BibliotecaUploader orgId={perfil?.org_id ?? ""} />
          </CardContent>
        </Card>
      ) : null}

      {docs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum documento na biblioteca ainda.
          </CardContent>
        </Card>
      ) : (
        CATEGORIAS_BIBLIOTECA.map((cat) => {
          const doList = docs.filter((d) => d.categoria === cat);
          if (doList.length === 0) return null;
          const info = CATEGORIA_BIBLIOTECA_INFO[cat];
          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{info.label}</CardTitle>
                <CardDescription>{info.descricao}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {doList.map((d) => (
                  <div
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="font-medium">{d.titulo}</p>
                        {d.descricao ? (
                          <p className="text-sm text-muted-foreground">{d.descricao}</p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {formatarData(d.created_at.slice(0, 10))}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {url.get(d.path) ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          render={
                            <a href={url.get(d.path)} target="_blank" rel="noopener noreferrer" />
                          }
                        >
                          <Download className="size-4" /> Baixar
                        </Button>
                      ) : null}
                      {podeEditar ? (
                        <ConfirmDelete
                          action={excluirDocumentoBiblioteca}
                          id={d.id}
                          hidden={{ path: d.path }}
                          mensagem="Remover este documento da biblioteca?"
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
