// Contas de consumo do imóvel (água, luz, gás, internet, IPTU) — cadastro e
// tabela mês a mês, com o total no cabeçalho.

import { Check, Plus, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatarBRL, formatarData } from "@/lib/locacao";
import { tipoConsumoLabel } from "@/lib/imoveis";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { FormComErro } from "@/components/shared/form-com-erro";
import { ContaConsumoForm } from "../../conta-consumo-form";
import { alternarPagoConsumo, excluirContaConsumo } from "../../actions";

type Conta = {
  id: string;
  tipo: string;
  competencia: string;
  valor: number;
  vencimento: string | null;
  pago: boolean;
  lancamento_id: string | null;
};

export async function ImovelConsumo({
  imovelId,
  podeEditar,
}: {
  imovelId: string;
  podeEditar: boolean;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conta_consumo")
    .select("id, tipo, competencia, valor, vencimento, pago, lancamento_id")
    .eq("imovel_id", imovelId)
    .order("competencia", { ascending: false });

  const contas = (data ?? []) as Conta[];
  const total = contas.reduce((s, c) => s + Number(c.valor), 0);

  return (
    <>
      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4" /> Adicionar conta de consumo
            </CardTitle>
            <CardDescription>
              Água, luz, gás, internet, IPTU — mês a mês. Pode lançar direto no
              financeiro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContaConsumoForm imovelId={imovelId} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Contas de consumo ({contas.length})</span>
            <span className="text-sm font-normal text-muted-foreground">
              Total: {formatarBRL(total)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contas.length === 0 ? (
            <p className="px-6 py-4 text-sm text-muted-foreground">
              Nenhuma conta lançada.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Financeiro</TableHead>
                  {podeEditar ? (
                    <TableHead className="text-right">Ações</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      {c.competencia.slice(0, 7).split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tipoConsumoLabel(c.tipo)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.vencimento ? formatarData(c.vencimento) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatarBRL(Number(c.valor))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.pago ? "secondary" : "default"}>
                        {c.pago ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.lancamento_id ? "Lançado" : "—"}
                    </TableCell>
                    {podeEditar ? (
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <FormComErro action={alternarPagoConsumo}>
                            <input type="hidden" name="id" value={c.id} />
                            <input
                              type="hidden"
                              name="imovel_id"
                              value={imovelId}
                            />
                            <input
                              type="hidden"
                              name="novo_status"
                              value={c.pago ? "pendente" : "pago"}
                            />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={c.pago ? "Reabrir" : "Marcar pago"}
                            >
                              {c.pago ? <Undo2 /> : <Check />}
                            </Button>
                          </FormComErro>
                          <ConfirmDelete
                            action={excluirContaConsumo}
                            id={c.id}
                            hidden={{ imovel_id: imovelId }}
                          />
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
