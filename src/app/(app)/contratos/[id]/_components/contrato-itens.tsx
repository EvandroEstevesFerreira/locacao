import { listarFrentesDoContrato } from "@/lib/data/frentes";
// "Adicionar item" + tabela de itens locados. Duas seções num componente porque
// compartilham a mesma leitura calculada e são visualmente contíguas.

import { createClient } from "@/lib/supabase/server";
import { obterItensLocadosCalculados } from "@/lib/data/contratos";
import { CADENCIA, formatarBRL, formatarData, type Cadencia } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { AddItemLocadoForm } from "../../add-item-locado-form";
import { DevolucaoForm } from "../../devolucao-form";
import { excluirItemLocado } from "../../actions";

export async function ContratoItens({
  contratoId,
  cadencia,
  prorata,
  podeEditar,
}: {
  contratoId: string;
  cadencia: Cadencia;
  prorata: boolean;
  /** Operar cobre editar itens e registrar devolução — é o mesmo gate. */
  podeEditar: boolean;
}) {
  // Em paralelo: o catálogo não depende do cálculo dos itens.
  const [linhas, catalogo, frentes] = await Promise.all([
    obterItensLocadosCalculados(contratoId, cadencia, prorata),
    podeEditar ? listarItensDoCatalogo() : Promise.resolve([]),
    // Só quem pode editar precisa do seletor. Para leitor, seria uma consulta
    // para desenhar nada.
    podeEditar ? listarFrentesDoContrato(contratoId) : Promise.resolve([]),
  ]);

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adicionar item</CardTitle>
            <CardDescription>
              Inclua um item locado neste contrato.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AddItemLocadoForm
              frentes={frentes}
              contratoId={contratoId}
              itens={catalogo}
              cadencia={cadencia}
              prorata={prorata}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens locados</CardTitle>
          <CardDescription>
            Custo estimado = quantidade × valor por período × períodos decorridos
            (cadência {CADENCIA[cadencia].label.toLowerCase()}). A devolução pode
            ser parcial, até zerar o saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {linhas.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Valor/período</TableHead>
                  <TableHead>Retirada</TableHead>
                  <TableHead>Devol. prevista</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Custo est.</TableHead>
                  <TableHead>Status</TableHead>
                  {podeEditar ? <TableHead>Devolver</TableHead> : null}
                  {podeEditar ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      {l.item?.descricao ?? "—"}
                      {l.item?.unidade ? (
                        <span className="text-muted-foreground">
                          {" "}
                          ({l.item.unidade})
                        </span>
                      ) : null}
                      {l.identificacao ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          nº {l.identificacao}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{l.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {formatarBRL(Number(l.valor_unitario_periodo))}
                    </TableCell>
                    <TableCell>{formatarData(l.data_retirada)}</TableCell>
                    <TableCell>
                      {formatarData(l.data_devolucao_prevista)}
                    </TableCell>
                    <TableCell className="text-right">{l.saldo}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatarBRL(l.custo)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={l.status === "devolvido" ? "secondary" : "default"}
                      >
                        {l.status === "devolvido" ? "Devolvido" : "Em aberto"}
                      </Badge>
                    </TableCell>
                    {podeEditar ? (
                      <TableCell>
                        {l.status === "em_aberto" && l.saldo > 0 ? (
                          <DevolucaoForm
                            key={l.saldo}
                            itemLocadoId={l.id}
                            contratoId={contratoId}
                            saldo={l.saldo}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    ) : null}
                    {podeEditar ? (
                      <TableCell>
                        <ConfirmDelete
                          action={excluirItemLocado}
                          id={l.id}
                          hidden={{ contrato_id: contratoId }}
                          mensagem="Remover este item do contrato?"
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum item locado neste contrato.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}

async function listarItensDoCatalogo() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("item_catalogo")
    .select("id, descricao, unidade")
    .eq("ativo", true)
    .order("descricao");
  return data ?? [];
}
