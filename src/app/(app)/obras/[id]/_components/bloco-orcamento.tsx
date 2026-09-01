import { formatarBRL, formatarData } from "@/lib/locacao";
import {
  percentualConsumido,
  projecaoFinal,
  estouroPrevisto,
  diagnostico,
  totalDetalhado,
} from "@/lib/orcamento";
import type { OrcamentoObra, RealizadoObra } from "@/lib/data/orcamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OrcamentoForm,
  type ItemCatalogoOpcao,
} from "./orcamento-form";

function Numero({
  label,
  valor,
  detalhe,
  destaque,
}: {
  label: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={destaque ? "text-lg font-semibold text-destructive" : "text-lg font-semibold"}>
        {valor}
      </p>
      {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/**
 * Orçamento de locação: o terceiro percentual e a projeção de estouro.
 *
 * A projeção é o número que muda decisão: consumir 62% do orçamento tendo
 * entregado 31% da obra significa terminar no dobro do orçado.
 */
export function BlocoOrcamento({
  obraId,
  orcamento,
  realizado,
  historico,
  fisico,
  prazo,
  catalogo,
}: {
  obraId: string;
  orcamento: OrcamentoObra | null;
  realizado: RealizadoObra;
  historico: { versao: number; valor_total: number; created_at: string }[];
  /** Avanço físico atual, para a projeção. */
  fisico: number | null;
  prazo: number | null;
  catalogo: ItemCatalogoOpcao[];
}) {
  const orcado = orcamento?.valor_total ?? 0;
  const consumido = orcamento ? percentualConsumido(orcado, realizado.comContrato) : null;
  const projecao = projecaoFinal(consumido, fisico);
  const estouro = estouroPrevisto(orcado, projecao);
  const veredito = diagnostico(prazo, fisico, consumido);

  const detalhado = orcamento ? totalDetalhado(orcamento.itens) : 0;
  const semDetalhe = orcado - detalhado;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orçamento de locação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {orcamento === null ? (
          <p className="text-sm text-muted-foreground">
            Nenhum orçamento cadastrado. Sem ele não há percentual de consumo, e o
            avanço da obra fica sem contraponto financeiro.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-4">
              <Numero
                label="Orçado"
                valor={formatarBRL(orcado)}
                detalhe={`versão ${orcamento.versao}`}
              />
              <Numero
                label="Realizado"
                valor={formatarBRL(realizado.comContrato)}
                detalhe={`${formatarBRL(realizado.pago)} já pago`}
              />
              <Numero
                label="Consumido"
                valor={pct(consumido)}
                destaque={consumido !== null && consumido > 100}
              />
              <Numero
                label="Projeção final"
                valor={pct(projecao)}
                detalhe={
                  projecao === null
                    ? "sem avanço lançado, não há projeção"
                    : estouro !== null
                      ? `estouro de ${formatarBRL(estouro)}`
                      : "dentro do orçamento"
                }
                destaque={estouro !== null}
              />
            </div>

            <p
              className={
                veredito === "Consumindo mais rápido que entrega."
                  ? "text-sm font-medium text-destructive"
                  : "text-sm font-medium"
              }
            >
              {veredito}
            </p>

            {/* A confissão do dado faltante. Sem ela, um "0% consumido" seria
                mentira por omissão: o dinheiro saiu, só não está atribuído a
                contrato nenhum. */}
            {realizado.semContrato > 0 ? (
              <p className="text-xs text-muted-foreground">
                {formatarBRL(realizado.semContrato)} lançados nesta obra não estão
                vinculados a contrato e por isso não entram no realizado.
              </p>
            ) : null}

            {orcamento.itens.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Detalhamento: {formatarBRL(detalhado)} de {formatarBRL(orcado)}
                  {semDetalhe > 0
                    ? ` · ${formatarBRL(semDetalhe)} sem detalhamento`
                    : semDetalhe < 0
                      ? ` · ${formatarBRL(Math.abs(semDetalhe))} acima do total`
                      : null}
                </p>
                <div className="divide-y rounded-md border text-sm">
                  {orcamento.itens.map((i) => (
                    <div key={i.item_id} className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">
                        {i.descricao}
                        {i.quantidade !== null ? ` · ${i.quantidade}` : ""}
                      </span>
                      <span className="font-medium">
                        {formatarBRL(i.valor_previsto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {historico.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Histórico de versões
                </p>
                <div className="divide-y rounded-md border text-sm">
                  {historico.map((h) => (
                    <div key={h.versao} className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">
                        v{h.versao} · {formatarData(h.created_at)}
                      </span>
                      <span className="font-medium">{formatarBRL(h.valor_total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}

        <div className="border-t pt-4">
          <OrcamentoForm
            obraId={obraId}
            atual={
              orcamento
                ? {
                    versao: orcamento.versao,
                    valor_total: orcamento.valor_total,
                    observacoes: orcamento.observacoes,
                    itens: orcamento.itens,
                  }
                : undefined
            }
            catalogo={catalogo}
          />
        </div>
      </CardContent>
    </Card>
  );
}
