<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Versionamento (obrigatório a cada alteração)

Toda mudança relevante (nova funcionalidade, melhoria, correção ou ajuste de
segurança) DEVE ser versionada. Siga [SemVer](https://semver.org):

- **MAJOR** (x.0.0): quebra de compatibilidade.
- **MINOR** (0.x.0): novas funcionalidades sem quebrar o que existe.
- **PATCH** (0.0.x): correções e ajustes pequenos.

Ao concluir uma alteração, atualize **os três** pontos, mantendo-os em sincronia:

1. **`src/lib/changelog.ts`** — fonte única da tela **Novidades**. Adicione (ou
   complemente) o `Release` no topo do array `CHANGELOG` e ajuste `APP_VERSION`.
   Cada item tem `tipo`: `novo` | `melhoria` | `correcao` | `seguranca`, com
   texto curto e voltado ao usuário (não jargão técnico).
2. **`CHANGELOG.md`** — replique um resumo da mesma versão (formato Keep a
   Changelog).
3. **`package.json`** — campo `version` igual a `APP_VERSION`.

Regra prática: se agrupar várias mudanças pequenas no mesmo dia/tema, use um
único `Release` (uma versão MINOR) e vá acrescentando itens até publicar.
