import { redirect } from "next/navigation";
import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ItemForm } from "../item-form";
import {
  listarTiposParaSelecao,
  listarUnidades,
} from "@/lib/data/catalogo";

export const metadata = { title: "Novo item — Loca" };

export default async function NovoItemPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/itens");

  const [tipos, unidades] = await Promise.all([
    listarTiposParaSelecao(),
    listarUnidades(),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        titulo="Novo item"
        descricao="Cadastre um equipamento, material retornável ou consumível."
      />
      <Card>
        <CardContent className="pt-6">
          <ItemForm tipos={tipos} unidades={unidades} />
        </CardContent>
      </Card>
    </div>
  );
}
