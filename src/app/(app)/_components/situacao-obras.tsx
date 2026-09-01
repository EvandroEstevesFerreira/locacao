import Link from "next/link";
import { Gauge } from "lucide-react";

import { formatarBRL } from "@/lib/locacao";
import type { LinhaPainel, ResumoPainel } from "@/lib/painel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(0)}%`);

/** Quando o consumo passa a entrega por mais que isto, a linha é destacada. */
const MARGEM_DESTAQUE = 10;

/**
 * Situação das obras: os três percentuais de todas elas, lado a lado.
 *
 * A ordenação vem do módulo puro (`montarPainel`) e é a razão de o card
 * existir: um diretor com 7 obras não lê 7 linhas procurando o problema — a
 * obra que queima orçamento mais rápido do que entrega está em cima.
 */
export function SituacaoObras({
  linhas,
  resumo,
}: {
  linhas: LinhaPainel[];
  resumo: ResumoPainel;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" /> Situação das obras
        </CardTitle>
        <CardDescription>
          Prazo decorrido contra avanço físico e orçamento consumido.
          {resumo.comEstouro > 0 ? (
            <>
              {" "}
              <strong className="text-destructive">
                {resumo.comEstouro}{" "}
                {resumo.comEstouro === 1 ? "obra projeta" : "obras projetam"} estouro
              </strong>
              , somando {formatarBRL(resumo.estouroTotal)}.
            </>
          ) : null}
          {/* O número que impede o painel de mentir por otimismo: obra verde
              por falta de dado não é obra saudável. */}
          {resumo.semDados > 0 ? (
            <>
              {" "}
              {resumo.semDados} de {resumo.obras}{" "}
              {resumo.semDados === 1 ? "está" : "estão"} sem dado suficiente para
              diagnosticar.
            </>
          ) : null}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma obra ativa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left font-medium">Obra</th>
                  <th className="py-2 text-right font-medium">Prazo</th>
                  <th className="py-2 text-right font-medium">Avanço</th>
                  <th className="py-2 text-right font-medium">Consumido</th>
                  <th className="py-2 text-right font-medium">Projeção</th>
                  <th className="py-2 text-right font-medium">Itens</th>
                  <th className="py-2 text-left font-medium">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const critico =
                    l.desvioConsumo !== null && l.desvioConsumo > MARGEM_DESTAQUE;
                  return (
                    <tr key={l.obraId} className="border-b last:border-0">
                      <td className="py-2">
                        <Link
                          href={`/obras/${l.obraId}`}
                          className="hover:underline"
                        >
                          {l.rotulo}
                        </Link>
                      </td>
                      <td className="py-2 text-right tabular-nums">{pct(l.prazo)}</td>
                      <td className="py-2 text-right tabular-nums">{pct(l.fisico)}</td>
                      <td
                        className={
                          critico
                            ? "py-2 text-right font-semibold tabular-nums text-destructive"
                            : "py-2 text-right tabular-nums"
                        }
                      >
                        {pct(l.consumido)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {pct(l.projecao)}
                        {l.estouro !== null ? (
                          <span className="block text-xs text-destructive">
                            +{formatarBRL(l.estouro)}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right tabular-nums">{l.itensAbertos}</td>
                      <td
                        className={
                          critico
                            ? "py-2 text-xs text-destructive"
                            : "py-2 text-xs text-muted-foreground"
                        }
                      >
                        {l.veredito}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
