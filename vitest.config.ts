import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      // `server-only` não existe fora do bundler do Next. A camada de leitura
      // em src/lib/data/ abre com `import "server-only"` para impedir que um
      // componente cliente a importe, então o Vitest precisa de um stub.
      //
      // Ele é cinto e suspensório: nenhuma lógica pura mora em data/, logo
      // nenhum teste deveria precisar importar módulo server-only. Se algum
      // passar a precisar, é sinal de que há regra de negócio no lugar errado.
      "server-only": fileURLToPath(
        new URL("./test/stubs/server-only.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    // Os testes de documento renderizam PDF de verdade, e o grid do FRM-RH-005
    // — 45 linhas x 10 colunas, com 315 caixas de marcação DESENHADAS — custa
    // cerca de 5s. Medido: as bordas por célula são de graça (1677ms contra
    // 1696ms num teste isolado); o custo é o desenho das caixas, que existe
    // porque o Helvetica não tem o glifo ☐ e sem elas o formulário é inútil.
    // O default de 5s ficava exatamente na fronteira, e o teste falhava por
    // timeout sem nada estar errado.
    //
    // 30s NÃO BASTOU. Em 06/09/2026 o `romaneio.test.tsx` estourou os 30s numa
    // rodada completa que levou 102s — e passou em 10,5s quando rodado sozinho.
    // A causa não é aquele teste: são OITO arquivos renderizando PDF de verdade,
    // e o vitest os roda em workers paralelos disputando CPU. Três vezes mais
    // lento sob carga, e o runner do GitHub tem dois núcleos — metade desta
    // máquina.
    //
    // 60s dá folga para a contenção sem esconder regressão de verdade: um PDF
    // que passasse a custar o dobro ainda estouraria.
    testTimeout: 60_000,
    exclude: ["node_modules", ".next", "supabase"],
  },
});
