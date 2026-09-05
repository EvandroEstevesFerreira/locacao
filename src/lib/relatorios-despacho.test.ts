import { describe, it, expect } from "vitest";
import {
  gerarRelatorio,
  TIPOS_RELATORIO,
  type TipoRelatorio,
  type Relatorio,
} from "./relatorios";

/**
 * O DEFEITO QUE ESTE ARQUIVO GUARDA.
 *
 * `gerarRelatorio` é uma escada de `if` que TERMINA num `return` sem condição:
 *
 *     if (tipo === "avarias") return avarias(...);
 *     …
 *     return imoveisCaucao(supabase, filtros);
 *
 * Acrescentar um tipo à união `TipoRelatorio` e ao seletor da tela, e esquecer
 * o `if`, não quebra o typecheck nem o lint. O usuário escolhe "Custo de
 * manutenção", a tela mostra o título dele no cabeçalho da página — e as linhas
 * são de CAUÇÃO DE IMÓVEL. Um relatório plausível e errado, que é exatamente o
 * que o AGENTS.md manda impedir nos agregados que viram documento.
 *
 * A varredura não tem lista escrita à mão: ela percorre `TIPOS_RELATORIO`, que
 * é a mesma fonte que alimenta o seletor. Tipo novo entra por existir.
 */

/**
 * Um cliente Supabase de mentira que responde vazio a qualquer encadeamento.
 *
 * O Proxy é o ponto: os geradores encadeiam `.select().eq().in().order()` em
 * ordens diferentes, e um stub com métodos fixos exigiria manutenção a cada
 * gerador novo — voltando a ser uma lista escrita à mão, que é o que esta
 * varredura existe para não ser.
 */
function clienteVazio() {
  const resultado = { data: [], error: null, count: 0 };
  const alvo: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(alvo, {
    get(_, prop) {
      // `then` faz o objeto parecer uma Promise para o `await` dos geradores.
      if (prop === "then") {
        return (aceitar: (v: unknown) => unknown) => aceitar(resultado);
      }
      return () => proxy;
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return proxy as any;
}

describe("gerarRelatorio despacha todo tipo declarado", () => {
  it("o seletor da tela declara tipos", () => {
    // Sem esta trava, um refactor que esvaziasse `TIPOS_RELATORIO` tornaria a
    // varredura um teste vazio que passa sempre.
    expect(TIPOS_RELATORIO.length).toBeGreaterThan(5);
  });

  it("nenhum tipo cai no ramo final por engano", async () => {
    const titulos = new Map<TipoRelatorio, string>();
    for (const { valor } of TIPOS_RELATORIO) {
      const r: Relatorio = await gerarRelatorio(clienteVazio(), valor, {});
      titulos.set(valor, r.titulo);
    }

    // Dois tipos com o MESMO título é a assinatura do defeito: o segundo caiu
    // no `return` final e devolveu o relatório de outro.
    const porTitulo = new Map<string, TipoRelatorio[]>();
    for (const [tipo, titulo] of titulos) {
      porTitulo.set(titulo, [...(porTitulo.get(titulo) ?? []), tipo]);
    }
    const repetidos = [...porTitulo.entries()]
      .filter(([, tipos]) => tipos.length > 1)
      .map(([titulo, tipos]) => `"${titulo}" devolvido por ${tipos.join(", ")}`);

    expect(
      repetidos,
      "Tipo de relatório sem ramo próprio em `gerarRelatorio` — ele caiu no " +
        "`return` final e devolveu o relatório de outro:\n  " +
        repetidos.join("\n  "),
    ).toEqual([]);
  });

  it("todo relatório volta com colunas e título", async () => {
    for (const { valor, label } of TIPOS_RELATORIO) {
      const r = await gerarRelatorio(clienteVazio(), valor, {});
      expect(r.titulo, `${label} sem título`).toBeTruthy();
      expect(r.colunas.length, `${label} sem colunas`).toBeGreaterThan(0);
      // Coluna sem `key` produz célula vazia em toda linha, na tela e no PDF.
      for (const c of r.colunas) {
        expect(c.key, `${label}: coluna sem key`).toBeTruthy();
        expect(c.label, `${label}: coluna sem rótulo`).toBeTruthy();
      }
    }
  });

  it("o gráfico, quando declarado, aponta para colunas que existem", async () => {
    // `dadosGrafico` lê `linhas[labelKey]` e `linhas[valorKey]`. Apontar para
    // uma coluna inexistente não estoura: desenha um gráfico de barras com
    // todos os valores em zero e todos os rótulos "—".
    for (const { valor, label } of TIPOS_RELATORIO) {
      const r = await gerarRelatorio(clienteVazio(), valor, {});
      if (!r.grafico) continue;
      const chaves = r.colunas.map((c) => c.key);
      expect(chaves, `${label}: grafico.labelKey fora das colunas`).toContain(
        r.grafico.labelKey,
      );
      expect(chaves, `${label}: grafico.valorKey fora das colunas`).toContain(
        r.grafico.valorKey,
      );
    }
  });

  it("`agruparPor`, quando declarado, aponta para uma coluna que existe", async () => {
    // `expandirLinhas` agrupa por essa chave. Fora das colunas, ela agrupa
    // tudo sob `undefined` — um subtotal só, rotulado vazio.
    for (const { valor, label } of TIPOS_RELATORIO) {
      const r = await gerarRelatorio(clienteVazio(), valor, {});
      if (!r.agruparPor) continue;
      expect(
        r.colunas.map((c) => c.key),
        `${label}: agruparPor fora das colunas`,
      ).toContain(r.agruparPor);
    }
  });
});
