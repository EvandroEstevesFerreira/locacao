import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Regras alinhadas ao Sistenge People. Não adicionar regras
    // `@typescript-eslint/*` sem instalar o plugin — quebra o lint no build.
    rules: {
      // Saída de log passa por src/lib/logger.ts. console.error/warn seguem
      // liberados porque a camada de leitura loga e degrada (ver AGENTS.md).
      "no-console": ["warn", { allow: ["error", "warn"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "@next/next/no-html-link-for-pages": "error",
    },
  },
  {
    // O logger é o ponto único de saída estruturada da aplicação, e os scripts
    // de `scripts/` são utilitários de terminal: nos dois casos console.log é o
    // meio, não um esquecimento.
    files: ["src/lib/logger.ts", "scripts/**/*.mjs"],
    rules: { "no-console": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
