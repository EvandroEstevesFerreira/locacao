// Adapta um `Relatorio` do domínio para os dados que o e-mail precisa.
//
// Vive separado de `templates.ts` porque `relatorios.ts` carrega o gerador de
// relatório inteiro. O template só quer células já formatadas; deixar a
// conversão aqui é o que mantém `templates.ts` sem dependência de domínio — e
// testável sem nada além de strings.

import {
  expandirLinhas,
  formatarValor,
  type Relatorio,
} from "@/lib/relatorios";
import type { DadosRelatorio } from "./templates";

/**
 * Converte o relatório em linhas de e-mail, preservando subtotais e total.
 *
 * A ênfase das linhas de fechamento é a razão desta função existir: sem ela o
 * leitor soma de novo o que já está somado. No e-mail antigo a intenção estava
 * no código, mas a cor de fundo era interpolada dentro de uma string de aspas
 * duplas e chegava ao HTML como o texto `${SLATE_100}` — nenhuma linha de
 * fechamento tinha fundo.
 */
export function dadosDeRelatorio(
  relatorio: Relatorio,
  periodo: string,
  anexo?: string,
): DadosRelatorio {
  const primeira = relatorio.colunas[0]?.key;

  const linhas: DadosRelatorio["linhas"] = expandirLinhas(relatorio).map((lr) => {
    if (lr.tipo === "dado") {
      return {
        celulas: relatorio.colunas.map((c) => formatarValor(c.tipo, lr.valores[c.key])),
      };
    }

    // Linha de fechamento: o rótulo vai na primeira coluna, as somas nas colunas
    // de moeda, e o resto fica vazio.
    const celulas = relatorio.colunas.map((c) => {
      if (c.key in lr.valores) return formatarValor("moeda", lr.valores[c.key]);
      if (c.key === primeira) {
        return lr.tipo === "total" ? lr.rotulo : `Subtotal — ${lr.rotulo}`;
      }
      return "";
    });
    return { celulas, enfase: lr.tipo };
  });

  return {
    titulo: relatorio.titulo,
    periodo,
    colunas: relatorio.colunas.map((c) => ({ label: c.label, tipo: c.tipo })),
    linhas,
    anexo,
  };
}
