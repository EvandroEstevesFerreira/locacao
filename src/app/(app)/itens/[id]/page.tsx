import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { TIPO_ITEM, type TipoItem } from "@/lib/itens";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ItemForm } from "../item-form";
import { AddUnidadeForm } from "../add-unidade-form";
import { excluirUnidade } from "../actions";

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
    .select("id, tipo, descricao, unidade, ativo")
    .eq("id", id)
    .single();

  if (!item) notFound();
  const tipo = item.tipo as TipoItem;

  const { data: unidades } =
    tipo === "equipamento"
      ? await supabase
          .from("equipamento_unidade")
          .select("id, identificador, observacoes")
          .eq("item_id", id)
          .order("identificador")
      : { data: [] };

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
            <AddUnidadeForm key={unidades?.length ?? 0} itemId={item.id} />

            {(unidades?.length ?? 0) > 0 ? (
              <ul className="divide-y rounded-md border">
                {unidades!.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{u.identificador}</span>
                      {u.observacoes ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {u.observacoes}
                        </span>
                      ) : null}
                    </div>
                    <form action={excluirUnidade}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <ConfirmDeleteInline />
                    </form>
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

// Botão de excluir para itens dentro de um form já existente (sem form próprio).
function ConfirmDeleteInline() {
  return (
    <button
      type="submit"
      aria-label="Excluir unidade"
      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
    >
      Remover
    </button>
  );
}
