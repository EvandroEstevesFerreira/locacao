import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { formatarData } from "@/lib/locacao";
import {
  CATEGORIAS_BIBLIOTECA,
  CATEGORIA_BIBLIOTECA_INFO,
} from "@/lib/biblioteca";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BibliotecaUploader } from "../biblioteca-uploader";
import { BibliotecaItem } from "../biblioteca-item";
import { assinarUrls } from "@/lib/data/storage";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";

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

  const url = await assinarUrls("imoveis", docs.map((d) => d.path));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
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
        <EmptyState
          icon={<FileText />}
          titulo="Nenhum documento na biblioteca"
          descricao="Normativos, formulários e placas ficam aqui para consultar, baixar e imprimir."
        />
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
              <CardContent className="space-y-1">
                {doList.map((d) => (
                  <BibliotecaItem
                    key={d.id}
                    doc={{
                      id: d.id,
                      categoria: d.categoria,
                      titulo: d.titulo,
                      descricao: d.descricao,
                      path: d.path,
                    }}
                    downloadUrl={url.get(d.path)}
                    dataLabel={formatarData(d.created_at.slice(0, 10))}
                    podeEditar={podeEditar}
                  />
                ))}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
