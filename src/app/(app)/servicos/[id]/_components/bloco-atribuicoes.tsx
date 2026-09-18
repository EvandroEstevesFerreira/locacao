"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormError } from "@/components/shared/form-error";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDelete } from "@/components/confirm-delete";
import { formatarData } from "@/lib/locacao";
import type { AtribuicaoDetalhe } from "@/lib/data/servicos";
import { atribuirLicenca, devolverLicenca } from "../../actions";

export function BlocoAtribuicoes({
  contratoId,
  atribuicoes,
  quantidade,
  funcionarios,
}: {
  contratoId: string;
  atribuicoes: AtribuicaoDetalhe[];
  quantidade: number;
  funcionarios: { id: string; nome: string }[];
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();
  const [funcionarioId, setFuncionarioId] = useState("");
  const [data, setData] = useState("");

  const livres = quantidade - atribuicoes.length;
  // Quem já está com uma licença aberta não entra no select: o banco recusaria
  // pelo índice único, e oferecer o que vai ser recusado é convidar ao erro.
  const jaComLicenca = new Set(atribuicoes.map((a) => a.funcionario_id));
  const disponiveis = funcionarios.filter((f) => !jaComLicenca.has(f.id));

  function onAtribuir() {
    setErro(null);
    startTransition(async () => {
      const r = await atribuirLicenca({
        contrato_id: contratoId,
        funcionario_id: funcionarioId,
        atribuido_em: data,
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success("Licença atribuída.");
      setFuncionarioId("");
      setData("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Licenças em uso{" "}
          <span className="font-normal text-muted-foreground">
            ({atribuicoes.length} de {quantidade}
            {livres > 0 ? `, ${livres} livre${livres > 1 ? "s" : ""}` : ""})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {livres > 0 ? (
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="funcionario">Pessoa</Label>
              <NativeSelect
                id="funcionario"
                value={funcionarioId}
                disabled={pendente}
                onChange={(e) => setFuncionarioId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {disponiveis.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="atribuido_em">Desde</Label>
              <Input
                id="atribuido_em"
                type="date"
                value={data}
                disabled={pendente}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <Button
              onClick={onAtribuir}
              disabled={pendente || !funcionarioId || !data}
            >
              {pendente ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Atribuir
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Todas as {quantidade} licenças contratadas estão atribuídas. Para
            atribuir a mais alguém, devolva uma antes ou aumente a quantidade do
            contrato.
          </p>
        )}

        <FormError>{erro}</FormError>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pessoa</TableHead>
              <TableHead>Centro de custo</TableHead>
              <TableHead>Desde</TableHead>
              <TableHead className="w-16 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {atribuicoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  Nenhuma licença atribuída. O contrato inteiro está ocioso.
                </TableCell>
              </TableRow>
            ) : null}
            {atribuicoes.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.funcionario_nome}</TableCell>
                <TableCell className="text-muted-foreground">
                  {a.centro_custo_nome ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatarData(a.atribuido_em)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    {/* "Devolver" e não "excluir": a linha fica no histórico,
                        e é ela que responde desde quando a pessoa usava. */}
                    <ConfirmDelete
                      action={devolverLicenca}
                      id={a.id}
                      hidden={{ contrato_id: contratoId }}
                      mensagem="Devolver esta licença? Ela sai da contagem de uso e volta a ficar livre. O registro fica no histórico."
                      rotulo="Devolver"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
