// Relatório fotográfico de retirada. Não faz fetch: a vistoria de retirada e a
// contagem de fotos vêm aninhadas na linha de contrato que a página já carregou.

import Link from "next/link";
import { AlertTriangle, Camera, ChevronRight } from "lucide-react";
import { contaFotos } from "@/lib/data/contratos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { criarRelatorioRetirada } from "../../actions";

export type VistoriaDeRetirada = {
  id: string;
  vistoria_foto: { count: number }[];
};

export function ContratoRetirada({
  contratoId,
  retirada,
  podeMovimentar,
}: {
  contratoId: string;
  retirada: VistoriaDeRetirada | null;
  podeMovimentar: boolean;
}) {
  const fotos = retirada ? contaFotos(retirada) : 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            Relatório fotográfico de retirada
          </CardTitle>
          <CardDescription>
            Documente com fotos todos os itens no início do contrato.
          </CardDescription>
        </div>
        {retirada ? (
          <div className="flex items-center gap-2">
            {fotos === 0 ? (
              <Badge variant="destructive">
                <AlertTriangle className="size-3" /> Pendente de fotos
              </Badge>
            ) : (
              <Badge variant="secondary">{fotos} foto(s)</Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/vistorias/${retirada.id}`} />}
            >
              Abrir relatório
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : podeMovimentar ? (
          <form action={criarRelatorioRetirada}>
            <input type="hidden" name="contrato_id" value={contratoId} />
            <Button type="submit" variant="outline" size="sm">
              <Camera className="size-4" />
              Criar relatório de retirada
            </Button>
          </form>
        ) : (
          <span className="text-sm text-muted-foreground">Não criado</span>
        )}
      </CardHeader>
    </Card>
  );
}
