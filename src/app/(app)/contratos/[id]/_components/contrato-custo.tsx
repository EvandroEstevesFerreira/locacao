// O "custo estimado acumulado" do card de resumo.
//
// Existe como componente próprio para o resumo não ficar preso à consulta mais
// pesada da rota: obra, fornecedor, cadência e status vêm da linha de contrato e
// aparecem de imediato, enquanto só esta célula espera o cálculo dos itens. A
// leitura é a mesma da tabela de itens e está sob `cache()`, então não custa uma
// consulta extra.

import { obterItensLocadosCalculados } from "@/lib/data/contratos";
import { formatarBRL, type Cadencia } from "@/lib/locacao";
import { Campo } from "@/components/shared/campo";

export async function ContratoCusto({
  contratoId,
  cadencia,
  prorata,
}: {
  contratoId: string;
  cadencia: Cadencia;
  prorata: boolean;
}) {
  const linhas = await obterItensLocadosCalculados(contratoId, cadencia, prorata);
  const total = linhas.reduce((s, l) => s + l.custo, 0);

  return (
    <Campo label="Custo estimado acumulado" valor={formatarBRL(total)} destaque />
  );
}

/** Placeholder do valor enquanto o cálculo dos itens não volta. */
export function ContratoCustoSkeleton() {
  return (
    <div>
      <p className="text-xs text-muted-foreground">Custo estimado acumulado</p>
      <div className="mt-1 h-6 w-28 animate-pulse rounded bg-muted" />
    </div>
  );
}
