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
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules", ".next", "supabase"],
  },
});
