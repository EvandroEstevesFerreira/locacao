// Seção de avarias da vistoria, com o próprio fetch.
//
// O total de custo estimado é exportado à parte porque o cabeçalho da página
// precisa dele — e vem de `contarAvarias`, uma consulta agregada separada, para o
// resumo não esperar a lista inteira.

import { createClient } from "@/lib/supabase/server";
import { formatarBRL } from "@/lib/locacao";
import { STATUS_AVARIA, type StatusAvaria } from "@/lib/vistoria";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormComErro } from "@/components/shared/form-com-erro";
import { AddAvariaForm } from "../../add-avaria-form";
import {
  atualizarStatusAvaria,
  excluirAvaria,
  gerarLancamentoAvaria,
} from "../../actions";

export async function VistoriaAvarias({
  vistoriaId,
  podeEditar,
  podeCobrar,
}: {
  vistoriaId: string;
  podeEditar: boolean;
  podeCobrar: boolean;
}) {
  const supabase = await createClient();
  const { data: avarias } = await supabase
    .from("avaria")
    .select("id, descricao, custo_estimado, status, lancamento_id")
    .eq("vistoria_id", vistoriaId)
    .order("created_at");

  const lista = avarias ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Avarias</CardTitle>
        <CardDescription>
          Registre danos que podem gerar cobrança do fornecedor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {lista.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {lista.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{a.descricao}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatarBRL(Number(a.custo_estimado))}
                  </span>
                </div>
                <Badge variant={STATUS_AVARIA[a.status as StatusAvaria].variant}>
                  {STATUS_AVARIA[a.status as StatusAvaria].label}
                </Badge>
                {a.lancamento_id ? (
                  <Badge variant="secondary">Cobrança gerada</Badge>
                ) : podeCobrar && Number(a.custo_estimado) > 0 ? (
                  <form action={gerarLancamentoAvaria}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="vistoria_id" value={vistoriaId} />
                    <Button type="submit" size="sm" variant="outline">
                      Gerar cobrança
                    </Button>
                  </form>
                ) : null}
                {podeEditar ? (
                  <div className="flex items-center gap-2">
                    <FormComErro
                      action={atualizarStatusAvaria}
                      className="flex gap-1"
                    >
                      <input type="hidden" name="id" value={a.id} />
                      <input type="hidden" name="vistoria_id" value={vistoriaId} />
                      <NativeSelect
                        className="w-auto"
                        name="status"
                        defaultValue={a.status}
                      >
                        <option value="aberta">Aberta</option>
                        <option value="cobrada">Cobrada</option>
                        <option value="resolvida">Resolvida</option>
                      </NativeSelect>
                      <Button type="submit" size="sm" variant="outline">
                        Salvar
                      </Button>
                    </FormComErro>
                    <ConfirmDelete
                      action={excluirAvaria}
                      id={a.id}
                      hidden={{ vistoria_id: vistoriaId }}
                      mensagem="Remover esta avaria?"
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma avaria registrada.
          </p>
        )}

        {podeEditar ? <AddAvariaForm vistoriaId={vistoriaId} /> : null}
      </CardContent>
    </Card>
  );
}

/** Custo estimado somado das avarias — o cabeçalho da página mostra este total. */
export async function somarAvarias(vistoriaId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avaria")
    .select("custo_estimado")
    .eq("vistoria_id", vistoriaId);
  return (data ?? []).reduce((s, a) => s + Number(a.custo_estimado), 0);
}
