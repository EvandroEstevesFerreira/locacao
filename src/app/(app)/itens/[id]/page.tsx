import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { TIPO_ITEM, type TipoItem } from "@/lib/itens";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ItemForm } from "../item-form";
import { listarObrasParaFiltro } from "@/lib/data/obras";
import { AddUnidadeForm } from "../add-unidade-form";
import { excluirUnidade } from "../actions";
import { ConfirmDelete } from "@/components/confirm-delete";

export const metadata = { title: "Editar item — Loca" };

export default async function EditarItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await getCurrentPerfil();
  const podeEditar = podeEditarCadastros(perfil?.papel);
  if (!podeEditar) redirect("/itens");

  const { id } = await params;
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("item_catalogo")
    .select("id, tipo, descricao, unidade, controle, ativo")
    .eq("id", id)
    .single();

  if (!item) notFound();
  const tipo = item.tipo as TipoItem;

  const { data: unidades } =
    tipo === "equipamento"
      ? await supabase
          .from("equipamento_unidade")
          .select(
            "id, identificador, numero_serie, situacao, propriedade, obra_id, ano, estado, observacoes, obra:obra_id(codigo, nome)",
          )
          .eq("item_id", id)
          .order("identificador")
      : { data: [] };

  // As obras alimentam o campo "onde está" do formulário da peça.
  const obras = tipo === "equipamento" ? await listarObrasParaFiltro() : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader titulo="Editar item" descricao={item.descricao} />

      <Card>
        <CardContent className="pt-6">
          <ItemForm item={item} />
        </CardContent>
      </Card>

      {tipo === "equipamento" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unidades</CardTitle>
            <CardDescription>
              {TIPO_ITEM.equipamento.descricao} Cadastre cada unidade física.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AddUnidadeForm
              key={unidades?.length ?? 0}
              itemId={item.id}
              obras={obras}
            />

            {(unidades?.length ?? 0) > 0 ? (
              <ul className="divide-y rounded-md border">
                {unidades!.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div>
                      {/* Da lista de peças só dava para EXCLUIR. Abrir a peça é
                          o caminho para ver posse, linha do tempo e editar o
                          cadastro — tudo já existe em /frota/[id]. */}
                      <Link
                        href={`/frota/${u.id}`}
                        className="font-medium hover:underline"
                      >
                        {u.identificador}
                      </Link>
                      {u.observacoes ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {u.observacoes}
                        </span>
                      ) : null}
                    </div>
                    <ConfirmDelete
                      action={excluirUnidade}
                      id={u.id}
                      hidden={{ item_id: item.id }}
                      mensagem="Excluir esta unidade do equipamento?"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma unidade cadastrada.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

