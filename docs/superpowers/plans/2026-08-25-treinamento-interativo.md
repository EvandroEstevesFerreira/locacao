# Treinamento interativo do Loca — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar um treinamento interativo em HTML, em três trilhas e dezoito módulos, e atualizar o manual em Markdown para a v0.39.0.

**Architecture:** Conteúdo como **dado tipado** em `src/lib/treinamento/`, HTML **gerado** por uma função pura, arquivo escrito em disco pelo teste. É o mesmo padrão que `src/lib/emails/` usa desde a 0.38.0, e existe pela mesma razão: dezoito módulos com cinco blocos cada, escritos como HTML à mão, tornam impossível verificar cobertura, integridade de link e paleta — e transformam "corrigir um passo" em cirurgia. Com o conteúdo em dado, os cinco checks da spec são cinco asserções.

**Tech Stack:** TypeScript, Vitest (já instalados). HTML/CSS/JS embutido, zero dependência nova, zero asset externo. Nenhuma mudança no app.

**Spec:** `docs/superpowers/specs/2026-08-25-treinamento-interativo-design.md`

## Global Constraints

Valem para **toda** tarefa deste plano.

- **Paleta:** só `src/lib/brand-colors.ts` mais os extras declarados em `CORES_PERMITIDAS` (Tarefa 2), cada um com comentário do porquê. `--primary` (slate-900) é a cor de ação. O vermelho da marca `#BE3A31` **só** no logotipo e em marcação de crítico. **`#cf2927` é proibido** — é o vermelho errado que ainda vive em `apresentacao-loca.html`.
- **PT-BR acentuado em toda string visível.** Palavras que mais escapam: `não`, `usuário`, `permissão`, `função`, `endereço`, `número`, `você`, `também`, `após`, `só`, `até`. Não acentuar: identificadores TypeScript, chaves de enum, comentários `//`, `id=`/`href=`, slugs.
- **Sem asset externo.** Nenhum `<img src="http...">`, nenhuma webfont, nenhum CDN. SVG embutido.
- **Mobile:** legível e utilizável em 390px de largura. Quem opera está na obra.
- **Tema:** claro e escuro, pelos tokens do próprio arquivo. O Artifact renderiza no tema de quem abre.
- **`localStorage` sempre dentro de `try/catch`.** Em alguns contextos o acessor lança, e a página tem de renderizar certo sem nenhum valor guardado.
- **Versão de referência do conteúdo: 0.39.0.** Não a v0.19.3 do manual antigo.
- **Ritual de fechamento em toda tarefa:** `npm run typecheck && npm run lint && npm test`. O `npm run build` só na Tarefa 7 em diante (nada aqui entra em rota do app).

## File Structure

| Arquivo | Responsabilidade |
|---|---|
`src/lib/treinamento/tipos.ts` | Tipos do conteúdo + `validarTrilhas`. Sem HTML, sem cor |
`src/lib/treinamento/tipos.test.ts` | Invariantes de estrutura |
`src/lib/treinamento/layout.ts` | Casca HTML, CSS, JS de navegação e progresso, `CORES_PERMITIDAS` |
`src/lib/treinamento/layout.test.ts` | Paleta, `try/catch`, ausência de asset externo |
`src/lib/treinamento/diagramas.ts` | Os quatro SVG |
`src/lib/treinamento/diagramas.test.ts` | Acessibilidade e paleta dos SVG |
`src/lib/treinamento/trilha-0.ts` | Fundação — 6 módulos |
`src/lib/treinamento/trilha-a.ts` | Ferramentas e locações — 6 módulos |
`src/lib/treinamento/trilha-b.ts` | Imóveis e alojamento — 6 módulos |
`src/lib/treinamento/gerar.ts` | Monta a página a partir das três trilhas |
`src/lib/treinamento/gerar.test.ts` | Os cinco checks da spec + escreve `docs/treinamento/index.html` |
`docs/treinamento/index.html` | **Gerado.** Nunca editar à mão — o cabeçalho do arquivo diz isso |
`docs/manual-treinamento-loca.md` | Atualizado para 0.39.0 |

**Por que em `src/lib/` e não em `docs/`:** o `vitest.config.ts` coleta apenas `src/**/*.test.{ts,tsx}`. Conteúdo fora de `src/` não teria teste, e sem teste os cinco checks da spec não existem. Nenhum código do app importa esta pasta, então ela não entra no bundle.

---

### Task 1: Tipos do conteúdo e validador de estrutura

**Files:**
- Create: `src/lib/treinamento/tipos.ts`
- Test: `src/lib/treinamento/tipos.test.ts`

**Interfaces:**
- Consumes: `PerfilKey` derivado de `Papel` em `src/lib/permissoes.ts`
- Produces: `PerfilKey`, `DiagramaKey`, `Pergunta`, `Modulo`, `Trilha`, `validarTrilhas(trilhas: Trilha[]): string[]`, `TOTAL_MODULOS`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/treinamento/tipos.test.ts
import { describe, expect, it } from "vitest";
import { validarTrilhas, type Trilha, type Modulo } from "./tipos";

const modulo = (id: string, numero: number): Modulo => ({
  id,
  numero,
  titulo: `Módulo ${numero}`,
  perfis: ["operador"],
  problema: "A dor real.",
  caminho: ["Abrir a tela.", "Preencher.", "Salvar."],
  exemplo: "Na Torre B, isto acontece.",
  exercicios: ["Faça isto no Loca.", "Confira aquilo."],
  perguntas: [
    {
      enunciado: "Qual é a competência de uma despesa?",
      alternativas: ["O mês a que ela pertence", "O dia do pagamento"],
      correta: 0,
      comentario: "A competência é o mês a que a despesa pertence; o vencimento é quando ela é paga.",
    },
  ],
});

const trilha = (id: Trilha["id"], numero: Trilha["numero"], qtd: number): Trilha => ({
  id,
  numero,
  titulo: `Trilha ${numero}`,
  subtitulo: "Subtítulo.",
  modulos: Array.from({ length: qtd }, (_, i) => modulo(`${id}-${i + 1}`, i + 1)),
});

const completas = (): Trilha[] => [
  trilha("fundacao", 0, 6),
  trilha("ferramentas", 1, 6),
  trilha("imoveis", 2, 6),
];

describe("validarTrilhas", () => {
  it("aceita as três trilhas completas", () => {
    expect(validarTrilhas(completas())).toEqual([]);
  });

  it("acusa id de módulo repetido — é o que quebraria o link interno", () => {
    const t = completas();
    t[1].modulos[0].id = t[0].modulos[0].id;
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("id de módulo repetido"),
    );
  });

  it("acusa módulo sem perfil — sem isso ninguém sabe para quem é", () => {
    const t = completas();
    t[0].modulos[2].perfis = [];
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("sem perfil"),
    );
  });

  it("acusa pergunta cujo índice da correta não existe", () => {
    const t = completas();
    t[0].modulos[0].perguntas[0].correta = 5;
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("alternativa correta inexistente"),
    );
  });

  it("acusa pergunta sem comentário — 'errado' sozinho não ensina", () => {
    const t = completas();
    t[0].modulos[1].perguntas[0].comentario = "  ";
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("sem comentário"),
    );
  });

  it("acusa contagem diferente de 18 módulos", () => {
    const t = completas();
    t[2].modulos.pop();
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("17 módulos"),
    );
  });

  it("acusa numeração fora de sequência dentro da trilha", () => {
    const t = completas();
    t[1].modulos[3].numero = 9;
    expect(validarTrilhas(t)).toContainEqual(
      expect.stringContaining("numeração"),
    );
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/lib/treinamento/tipos.test.ts`
Expected: FAIL — `Failed to resolve import "./tipos"`

- [ ] **Step 3: Escrever `tipos.ts`**

```ts
// src/lib/treinamento/tipos.ts
// Conteúdo do treinamento como dado tipado — sem HTML e sem cor.
//
// Existe separado do layout pelo mesmo motivo que `src/lib/emails/templates.ts`
// existe separado de `layout.ts`: quem escreve o conteúdo decide O QUE se diz, e
// nunca como se desenha. Mudar o visual dos dezoito módulos é mexer em
// `layout.ts`, e nenhum conteúdo acompanha.

import type { Papel } from "@/lib/permissoes";

/** Os quatro perfis do Loca. Reaproveita `Papel` para não divergir dele. */
export type PerfilKey = Papel;

export type DiagramaKey =
  | "cadeia-custodia"
  | "tela-lista"
  | "ciclo-contrato-imovel"
  | "matriz-perfis";

export type Pergunta = {
  enunciado: string;
  alternativas: string[];
  /** Índice em `alternativas`. */
  correta: number;
  /**
   * Por que a correta é correta.
   *
   * Obrigatório, e o validador recusa vazio: "errado" não ensina nada. O que
   * ensina é "errado, porque a competência é o mês a que a despesa pertence e o
   * vencimento é quando ela é paga".
   */
  comentario: string;
};

export type Modulo = {
  /** Slug sem acento — vira `id` de âncora no HTML. */
  id: string;
  /** Posição dentro da trilha, começando em 1. */
  numero: number;
  titulo: string;
  /** Para quem é. Ao menos um perfil. */
  perfis: PerfilKey[];
  /** A dor real, em 2-3 frases. */
  problema: string;
  /** Passos numerados. */
  caminho: string[];
  /** Diagrama que acompanha o passo a passo, quando houver. */
  diagrama?: DiagramaKey;
  /** O que acontece com a obra do fio condutor neste passo. */
  exemplo: string;
  /** Exercícios no Loca real. */
  exercicios: string[];
  perguntas: Pergunta[];
  /** Recurso que o sistema ainda não tem — sai marcado na tela. */
  emConstrucao?: boolean;
};

export type Trilha = {
  id: "fundacao" | "ferramentas" | "imoveis";
  numero: 0 | 1 | 2;
  titulo: string;
  subtitulo: string;
  modulos: Modulo[];
};

/** Dezoito, conforme a spec: 6 por trilha. */
export const TOTAL_MODULOS = 18;

/**
 * Devolve a lista de problemas encontrados. Vazia significa válido.
 *
 * Devolve lista em vez de lançar porque o gerador quer relatar TODOS os
 * problemas de uma vez: consertar um por execução, dezoito módulos, é lento.
 */
export function validarTrilhas(trilhas: Trilha[]): string[] {
  const problemas: string[] = [];
  const vistos = new Set<string>();
  let total = 0;

  for (const t of trilhas) {
    t.modulos.forEach((m, i) => {
      total++;

      if (vistos.has(m.id)) {
        problemas.push(`id de módulo repetido: "${m.id}"`);
      }
      vistos.add(m.id);

      if (m.numero !== i + 1) {
        problemas.push(
          `numeração fora de sequência na trilha "${t.id}": "${m.id}" é ${m.numero}, esperado ${i + 1}`,
        );
      }
      if (m.perfis.length === 0) {
        problemas.push(`módulo "${m.id}" sem perfil`);
      }
      if (m.caminho.length === 0) {
        problemas.push(`módulo "${m.id}" sem passo a passo`);
      }
      if (m.exercicios.length === 0) {
        problemas.push(`módulo "${m.id}" sem exercício`);
      }
      if (m.perguntas.length === 0) {
        problemas.push(`módulo "${m.id}" sem pergunta de verificação`);
      }

      for (const p of m.perguntas) {
        if (p.correta < 0 || p.correta >= p.alternativas.length) {
          problemas.push(
            `módulo "${m.id}": alternativa correta inexistente (${p.correta} de ${p.alternativas.length})`,
          );
        }
        if (p.comentario.trim() === "") {
          problemas.push(`módulo "${m.id}": pergunta sem comentário`);
        }
      }
    });
  }

  if (total !== TOTAL_MODULOS) {
    problemas.push(`${total} módulos, esperado ${TOTAL_MODULOS}`);
  }

  return problemas;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/tipos.test.ts`
Expected: PASS, 7 testes

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/tipos.ts src/lib/treinamento/tipos.test.ts
git commit -m "feat(treinamento): tipos do conteúdo e validador de estrutura

Conteúdo como dado, não HTML: é o que torna verificável a cobertura dos
dezoito módulos, a integridade dos links e a paleta. O validador devolve
lista de problemas em vez de lançar no primeiro, porque consertar um por
execução em dezoito módulos é lento."
```

---

### Task 2: Casca HTML, paleta permitida e progresso

**Files:**
- Create: `src/lib/treinamento/layout.ts`
- Test: `src/lib/treinamento/layout.test.ts`

**Interfaces:**
- Consumes: `Modulo`, `Trilha`, `PerfilKey` de `./tipos`; `DIAGRAMAS` **não** — o layout recebe o SVG já pronto como string, para não depender da Tarefa 3
- Produces: `CORES_PERMITIDAS: string[]`, `CSS: string`, `JS: string`, `cabecalho(): string`, `secaoModulo(m: Modulo, svg: string | null): string`, `navTrilhas(trilhas: Trilha[]): string`, `PERFIL_LABEL: Record<PerfilKey, string>`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/treinamento/layout.test.ts
import { describe, expect, it } from "vitest";
import { CORES_PERMITIDAS, CSS, JS, secaoModulo, PERFIL_LABEL } from "./layout";
import * as marca from "@/lib/brand-colors";
import type { Modulo } from "./tipos";

const m: Modulo = {
  id: "obras",
  numero: 4,
  titulo: "Obras",
  perfis: ["administrador", "gestor"],
  problema: "Sem obra, nenhum custo tem dono.",
  caminho: ["Abrir Obras.", "Clicar em Nova obra."],
  exemplo: "A Torre B nasce aqui.",
  exercicios: ["Cadastre uma obra de teste."],
  perguntas: [
    {
      enunciado: "Por que quase toda tela filtra por obra?",
      alternativas: ["Porque a obra é o centro de custo", "Por acaso"],
      correta: 0,
      comentario: "A obra é o centro de custo: todo gasto precisa de um dono.",
    },
  ],
};

describe("paleta", () => {
  it("toda cor de brand-colors está permitida", () => {
    const daMarca = Object.values(marca).filter(
      (v): v is string => typeof v === "string" && v.startsWith("#"),
    );
    for (const c of daMarca) {
      expect(CORES_PERMITIDAS.map((x) => x.toUpperCase())).toContain(c.toUpperCase());
    }
  });

  it("o vermelho ERRADO é proibido", () => {
    // #cf2927 divergiu da paleta e ainda vive em apresentacao-loca.html.
    expect(CORES_PERMITIDAS.join(" ").toLowerCase()).not.toContain("#cf2927");
    expect(CSS.toLowerCase()).not.toContain("#cf2927");
  });

  it("o CSS não usa nenhuma cor fora da lista permitida", () => {
    const usadas = [...CSS.matchAll(/#[0-9a-fA-F]{6}/g)].map((x) =>
      x[0].toUpperCase(),
    );
    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
  });
});

describe("progresso no navegador", () => {
  it("nenhum acesso a localStorage fora de try/catch", () => {
    // Em janela privada e em captura de miniatura o acessor LANÇA. Sem o
    // try/catch a página quebra inteira em vez de abrir sem progresso salvo.
    const semTry = JS.replace(/try\s*\{[\s\S]*?\}\s*catch\s*\([\s\S]*?\}/g, "");
    expect(semTry).not.toContain("localStorage");
  });
});

describe("sem dependência externa", () => {
  it("o CSS não busca font nem imagem de fora", () => {
    expect(CSS).not.toMatch(/@import|https?:\/\//);
  });
});

describe("secaoModulo", () => {
  it("marca para quem é o módulo", () => {
    const html = secaoModulo(m, null);
    expect(html).toContain(PERFIL_LABEL.administrador);
    expect(html).toContain(PERFIL_LABEL.gestor);
    expect(html).not.toContain(PERFIL_LABEL.operador);
  });

  it("usa o id do módulo como âncora", () => {
    expect(secaoModulo(m, null)).toContain('id="obras"');
  });

  it("traz os cinco blocos", () => {
    const html = secaoModulo(m, null);
    for (const rotulo of ["O problema", "O caminho", "No exemplo", "Faça você", "Confira"]) {
      expect(html).toContain(rotulo);
    }
  });

  it("embute o diagrama quando recebe um", () => {
    expect(secaoModulo(m, "<svg role=\"img\"></svg>")).toContain("<svg");
    expect(secaoModulo(m, null)).not.toContain("<svg");
  });

  it("guarda a resposta correta em atributo de dado, não em texto visível", () => {
    // O JS lê daqui. Se ficasse no texto, a resposta apareceria na tela.
    expect(secaoModulo(m, null)).toContain('data-correta="0"');
  });

  it("não deixa buraco de dado", () => {
    expect(secaoModulo(m, null)).not.toMatch(/undefined|NaN|\[object Object\]/);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/lib/treinamento/layout.test.ts`
Expected: FAIL — `Failed to resolve import "./layout"`

- [ ] **Step 3: Escrever `layout.ts`**

O arquivo tem quatro partes, nesta ordem:

1. `CORES_PERMITIDAS` — todos os valores de `brand-colors.ts` **mais** os extras, cada um com comentário do porquê. Os extras previstos: `#FEF2F2` (fundo do bloco de resposta errada — o mesmo literal que `src/lib/emails/layout.ts` já usa), `#ECFDF5` e `#065F46` (fundo e texto da resposta certa; não há verde na paleta, e certo/errado só por texto é ruim para quem não distingue cor — vem sempre com ícone `✓`/`✕`), `#0B111E` e `#070A13` (superfícies do tema escuro, que já existem em `brand-colors.ts` como `DARK_CARD` e `DARK_FUNDO` e portanto **não** são extras — conferir antes de duplicar).

2. `CSS` — tokens em `:root`, redefinidos em `@media (prefers-color-scheme: dark)`. Layout de coluna única até 780px; barra lateral de navegação acima disso. Alvo de toque de 44px nos itens de trilha e nas alternativas.

3. `JS` — três funções, todas com `try/catch` em volta de cada acesso a `localStorage`:
   - `marcar(id)` — exercício feito, grava `loca-treinamento:exercicio:<id>`
   - `responder(perguntaId, escolha)` — compara com `data-correta`, revela o comentário, grava
   - `progresso()` — recalcula as barras por trilha e o "continuar de onde parei"

4. As funções de montagem: `cabecalho()`, `navTrilhas()`, `secaoModulo()`.

`secaoModulo` monta os cinco blocos com os rótulos exatos `O problema`, `O caminho`, `No exemplo`, `Faça você`, `Confira`, envolve a seção em `<section id="{m.id}">`, imprime as etiquetas de perfil por `PERFIL_LABEL`, e põe a resposta correta em `data-correta` — nunca no texto visível.

```ts
export const PERFIL_LABEL: Record<PerfilKey, string> = {
  master: "Master",
  administrador: "Administrador",
  gestor: "Gestor",
  operador: "Operador",
};
```

Toda interpolação de conteúdo passa por uma função `esc()` local, igual à de `src/lib/emails/base.ts` e pelo mesmo motivo: dado com `<` ou `&` quebra a marcação em silêncio.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/layout.test.ts`
Expected: PASS

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/layout.ts src/lib/treinamento/layout.test.ts
git commit -m "feat(treinamento): casca, paleta permitida e progresso no navegador

A lista de cores permitidas é a paleta de brand-colors mais extras
declarados um a um com o porquê. Exigir que TODA cor viesse de
brand-colors reprovaria o fundo do bloco de erro — emails/layout.ts já usa
#FEF2F2 literal pelo mesmo motivo. O que o teste garante é que nenhuma cor
entra sem passar por essa decisão, e que #cf2927 nunca volta.

Todo acesso a localStorage vai em try/catch: em janela privada o acessor
lança, e sem isso a página quebra inteira em vez de abrir sem progresso."
```

---

### Task 3: Os quatro diagramas

**Files:**
- Create: `src/lib/treinamento/diagramas.ts`
- Test: `src/lib/treinamento/diagramas.test.ts`

**Interfaces:**
- Consumes: `DiagramaKey` de `./tipos`; `CORES_PERMITIDAS` de `./layout`
- Produces: `DIAGRAMAS: Record<DiagramaKey, { titulo: string; svg: string }>`

- [ ] **Step 1: Escrever o teste que falha**

```ts
// src/lib/treinamento/diagramas.test.ts
import { describe, expect, it } from "vitest";
import { DIAGRAMAS } from "./diagramas";
import { CORES_PERMITIDAS } from "./layout";
import type { DiagramaKey } from "./tipos";

const CHAVES: DiagramaKey[] = [
  "cadeia-custodia",
  "tela-lista",
  "ciclo-contrato-imovel",
  "matriz-perfis",
];

describe("DIAGRAMAS", () => {
  it("tem os quatro previstos na spec", () => {
    expect(Object.keys(DIAGRAMAS).sort()).toEqual([...CHAVES].sort());
  });

  it.each(CHAVES)("%s — acessível e sem cor fora da paleta", (chave) => {
    const d = DIAGRAMAS[chave];

    // Quem usa leitor de tela recebe o título; sem isto o diagrama é um buraco.
    expect(d.svg).toContain('role="img"');
    expect(d.svg).toContain(`<title>${d.titulo}</title>`);

    // Sem largura fixa em px: o diagrama tem de encolher no celular.
    expect(d.svg).toContain("viewBox=");
    expect(d.svg).not.toMatch(/width="\d+"/);

    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    const usadas = [...d.svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((x) =>
      x[0].toUpperCase(),
    );
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
  });

  it("a cadeia de custódia marca o elo que o sistema ainda não tem", () => {
    // O elo Sistenge -> funcionário é o recibo de ferramenta, fora de escopo.
    // Sem a marcação, o diagrama promete o que o Loca não faz.
    expect(DIAGRAMAS["cadeia-custodia"].svg).toMatch(/em construção|ainda não/i);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/lib/treinamento/diagramas.test.ts`
Expected: FAIL — `Failed to resolve import "./diagramas"`

- [ ] **Step 3: Escrever `diagramas.ts`**

Quatro SVG, cada um com `viewBox`, sem `width` fixo, `role="img"` e `<title>`. Cores só de `CORES_PERMITIDAS` — na prática `SLATE_900` para traço e texto, `SLATE_200` para linha fina, `SLATE_100` para preenchimento fraco, `SLATE_500` para rótulo secundário, e `MARCA_VERMELHO` **apenas** no elo em construção da cadeia de custódia, que é marcação de crítico.

1. **`cadeia-custodia`** — quatro caixas ligadas por seta: `fornecedor → Sistenge` (recebimento, existe desde a 0.39.0), `Sistenge → funcionário` (**tracejado, com a etiqueta "em construção"**), `funcionário → Sistenge`, `Sistenge → fornecedor` (devolução, existe).
2. **`tela-lista`** — a anatomia que se repete em dez telas: campo de busca, filtros que aplicam ao vivo, cabeçalho de tabela, linhas, paginação, e o estado vazio. Ensina uma vez o que serve para todas.
3. **`ciclo-contrato-imovel`** — os estados e as transições da aba de ações do contrato de imóvel.
4. **`matriz-perfis`** — grade de 4 perfis × 3 capacidades (cadastrar, operar, ler), com `✓` e `—`. Nunca só por cor.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/diagramas.test.ts`
Expected: PASS

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/diagramas.ts src/lib/treinamento/diagramas.test.ts
git commit -m "feat(treinamento): os quatro diagramas em SVG embutido

Sem width fixo, com viewBox: o diagrama tem de encolher em tela de 390px,
que é onde o operador de obra abre. Com role=img e title, porque diagrama
sem alternativa textual é um buraco para quem usa leitor de tela.

A cadeia de custódia marca em tracejado o elo Sistenge -> funcionário: o
sistema ainda não faz isso, e um diagrama que não diz isso promete o que o
Loca não entrega."
```

---

### Task 4: Conteúdo da Trilha 0 — Fundação

**Files:**
- Create: `src/lib/treinamento/trilha-0.ts`
- Test: coberto por `tipos.test.ts` (validador) e por `gerar.test.ts` (Tarefa 7)

**Interfaces:**
- Consumes: `Modulo`, `Trilha` de `./tipos`
- Produces: `TRILHA_0: Trilha` com `id: "fundacao"`, `numero: 0`, seis módulos com os `id`: `visao-geral`, `primeiro-acesso`, `perfis`, `obras`, `fornecedores`, `financeiro-relatorios`

**Sobre o conteúdo desta tarefa e das duas seguintes:** o texto dos módulos **é** o produto, e não cabe transcrito no plano. O que o plano fixa é a estrutura (já tipada na Tarefa 1), a fonte de cada fato e o teste que verifica cobertura. Nenhum fato pode ser inventado: cada afirmação sai de um destes lugares.

| Módulo | Fonte da verdade |
|---|---|
`visao-geral` | `docs/manual-treinamento-loca.md` §1 (conceitos e a tabela de Organização/Obra/Fornecedor/Item/Contrato/Imóvel/Vistoria/Lançamento) |
`primeiro-acesso` | §3; `src/app/(app)/trocar-senha/`; `public/manifest.webmanifest` e `public/sw.js` para o comportamento sem sinal |
`perfis` | `src/lib/permissoes.ts` (`PAPEL_INFO` e os helpers `podeEditarCadastros`/`podeOperar`), `supabase/migrations/0011_fase7_rbac_4_perfis.sql`, e `obra_usuario` para o escopo por obra |
`obras` | §5; `src/lib/obra.ts`; `src/app/(app)/obras/` |
`fornecedores` | §6; `src/lib/fornecedor.ts` |
`financeiro-relatorios` | §10 e §12; `src/lib/financeiro.ts` (competência x vencimento, `STATUS_LANCAMENTO`, baixa); `src/lib/relatorios.ts` (`TIPOS_RELATORIO` — **doze**, seis de equipamento e seis de imóvel) |

- [ ] **Step 1: Escrever `trilha-0.ts` com os seis módulos**

Cada módulo preenche os cinco blocos do tipo `Modulo`. Regras de conteúdo:

- **`problema`** diz a dor em 2-3 frases, com número quando houver. O de `financeiro-relatorios` deve explicar a confusão competência x vencimento, que é a que mais gera erro de lançamento.
- **`caminho`** são os cliques reais, na ordem, com os rótulos exatos dos botões como estão na tela. Conferir no `src/app/(app)/<rota>/` antes de escrever — rótulo inventado faz a pessoa procurar botão que não existe.
- **`exemplo`** avança o fio condutor: a obra **Residencial Alto da Serra — Torre B** e o fornecedor **Locadora Bandeirantes** nascem no módulo `obras` e `fornecedores`.
- **`exercicios`** são feitos no Loca real e verificáveis pela própria pessoa.
- **`perguntas`** atacam o mal-entendido, não a memória. Não "onde fica o botão X", e sim "por que este lançamento apareceu no mês passado".
- **`perfis`**: `visao-geral` e `primeiro-acesso` valem para os quatro. `perfis` e `obras` marcam `master` e `administrador`. `financeiro-relatorios` marca `gestor` em destaque.
- **`diagrama`**: `perfis` usa `matriz-perfis`; `obras` usa `tela-lista`.

- [ ] **Step 2: Escrever o teste de cobertura desta trilha**

```ts
// acrescentar em src/lib/treinamento/tipos.test.ts
import { TRILHA_0 } from "./trilha-0";

describe("TRILHA_0", () => {
  it("é válida sozinha, exceto pela contagem total", () => {
    const problemas = validarTrilhas([TRILHA_0]);
    expect(problemas.filter((p) => !p.includes("esperado 18"))).toEqual([]);
  });

  it("tem os seis módulos previstos, nesta ordem", () => {
    expect(TRILHA_0.modulos.map((m) => m.id)).toEqual([
      "visao-geral",
      "primeiro-acesso",
      "perfis",
      "obras",
      "fornecedores",
      "financeiro-relatorios",
    ]);
  });

  it("diz que são doze relatórios — o manual antigo dizia outro número", () => {
    const m = TRILHA_0.modulos.find((x) => x.id === "financeiro-relatorios")!;
    const texto = [m.problema, ...m.caminho, m.exemplo].join(" ");
    expect(texto).toMatch(/doze|12/);
  });

  it("o fio condutor começa aqui", () => {
    const texto = TRILHA_0.modulos.map((m) => m.exemplo).join(" ");
    expect(texto).toContain("Alto da Serra");
    expect(texto).toContain("Bandeirantes");
  });
});
```

- [ ] **Step 3: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/tipos.test.ts`
Expected: PASS

- [ ] **Step 4: Auditoria de PT-BR**

Run:
```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem|apos|ate) " src/lib/treinamento/trilha-0.ts
```
Expected: nenhuma ocorrência em string visível. Acerto em identificador ou comentário `//` é aceitável — conferir uma a uma.

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/trilha-0.ts src/lib/treinamento/tipos.test.ts
git commit -m "feat(treinamento): Trilha 0 — Fundação, seis módulos

Obras, Fornecedores, Financeiro e Relatórios são compartilhados pelos dois
controles. Ficam numa trilha só, feita uma vez: repetidos nas duas
trilhas seriam duas versões da mesma verdade, e divergiriam na primeira
correção — o mesmo passivo que os e-mails tinham antes da 0.38.0.

O teste afirma doze relatórios porque o número foi conferido em
TIPOS_RELATORIO. O manual antigo dizia outro."
```

---

### Task 5: Conteúdo da Trilha A — Ferramentas, materiais e locações

**Files:**
- Create: `src/lib/treinamento/trilha-a.ts`
- Test: acrescentar bloco em `src/lib/treinamento/tipos.test.ts`

**Interfaces:**
- Consumes: `Modulo`, `Trilha` de `./tipos`
- Produces: `TRILHA_A: Trilha` com `id: "ferramentas"`, `numero: 1`, seis módulos: `itens`, `contrato-fornecedor`, `recebimento`, `vistoria-retirada`, `devolucao`, `avarias`

| Módulo | Fonte da verdade |
|---|---|
`itens` | §7; `src/lib/itens.ts`; `item_catalogo.controle` (`peca` \| `quantidade`) na migration `0049` |
`contrato-fornecedor` | §8, §8.1, §8.2; `src/lib/data/contratos.ts`; numeração `CTR-ANO-0000` da migration `0048` |
`recebimento` | **0.39.0 — recém-entregue.** `supabase/migrations/0049_recebimento_equipamento.sql`; `src/app/(app)/contratos/recebimento-actions.ts`; `src/app/(app)/recebimentos/`; `src/lib/data/recebimentos.ts`. Cobrir: conferência item a item, quem conferiu, número da nota do fornecedor, item fora do contrato, avaria já na entrada, e a data da entrega separada da data de digitação |
`vistoria-retirada` | §8.3 e §9; `src/lib/vistoria.ts` (`TipoVistoria = "entrada" \| "devolucao"`) |
`devolucao` | §8.4; `movimentacao` na migration `0006`; o cálculo de custo em `src/lib/locacao.ts` |
`avarias` | §9; `src/lib/vistoria.ts` (`StatusAvaria = "aberta" \| "cobrada" \| "resolvida"`) |

- [ ] **Step 1: Escrever `trilha-a.ts`**

Regras específicas desta trilha:

- O fio condutor avança: a **betoneira BT-4412** da Locadora Bandeirantes é recebida no módulo `recebimento`, vistoriada em `vistoria-retirada`, devolvida em `devolucao` com a **coroa dentada**, e a cobrança é contestada em `avarias`.
- `itens` explica por que a escolha entre controle **por peça** e **por quantidade** muda tudo depois: por peça, o sistema sabe *qual* betoneira chegou; por quantidade, só que chegaram duas.
- `vistoria-retirada` carrega o argumento central da trilha: a foto na entrada é o que ganha a discussão na saída. Sem ela, a palavra do fornecedor vale tanto quanto a da Sistenge.
- `devolucao` explica que o custo para de correr na data da devolução, não na data em que alguém digitou — a mesma distinção que o `recebimento` faz na entrada.
- **`perfis`**: `operador` em destaque nos módulos 2 a 6; `itens` marca `administrador`.
- **`diagrama`**: `recebimento` usa `cadeia-custodia`.
- Nenhum módulo desta trilha tem `emConstrucao: true`. O recibo de ferramenta **não** é um módulo — é um aviso ao fim da trilha, montado pelo `gerar.ts` na Tarefa 7.

- [ ] **Step 2: Escrever o teste de cobertura**

```ts
// acrescentar em src/lib/treinamento/tipos.test.ts
import { TRILHA_A } from "./trilha-a";

describe("TRILHA_A", () => {
  it("tem os seis módulos previstos, nesta ordem", () => {
    expect(TRILHA_A.modulos.map((m) => m.id)).toEqual([
      "itens",
      "contrato-fornecedor",
      "recebimento",
      "vistoria-retirada",
      "devolucao",
      "avarias",
    ]);
  });

  it("o recebimento cobre o que a 0.39.0 entregou", () => {
    const m = TRILHA_A.modulos.find((x) => x.id === "recebimento")!;
    const texto = [m.problema, ...m.caminho, m.exemplo].join(" ").toLowerCase();
    for (const assunto of ["patrimônio", "nota", "fora do contrato", "data"]) {
      expect(texto, `recebimento deve falar de ${assunto}`).toContain(assunto);
    }
  });

  it("o fio condutor atravessa a trilha", () => {
    const texto = TRILHA_A.modulos.map((m) => m.exemplo).join(" ");
    expect(texto).toContain("BT-4412");
  });

  it("nenhum módulo está marcado em construção", () => {
    // O recibo de ferramenta não é módulo: é aviso ao fim da trilha (gerar.ts).
    expect(TRILHA_A.modulos.filter((m) => m.emConstrucao)).toEqual([]);
  });
});
```

- [ ] **Step 3: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/tipos.test.ts`
Expected: PASS

- [ ] **Step 4: Auditoria de PT-BR**

Run:
```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem|apos|ate) " src/lib/treinamento/trilha-a.ts
```
Expected: nada em string visível.

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/trilha-a.ts src/lib/treinamento/tipos.test.ts
git commit -m "feat(treinamento): Trilha A — ferramentas, materiais e locações

O módulo de recebimento cobre a 0.39.0, que pousou anteontem: conferência
por patrimônio, número da nota do fornecedor, item fora do contrato,
avaria já na entrada e a data da entrega separada da data de digitação.

A betoneira BT-4412 atravessa os seis módulos — chega, é vistoriada, volta
com a coroa dentada e a cobrança é contestada. Exemplo solto por módulo
ensina telas; uma história só ensina o encadeamento, que é onde as pessoas
de fato erram: a vistoria que ninguém fez na entrada só cobra o preço na
devolução, três meses depois."
```

---

### Task 6: Conteúdo da Trilha B — Imóveis e alojamento

**Files:**
- Create: `src/lib/treinamento/trilha-b.ts`
- Test: acrescentar bloco em `src/lib/treinamento/tipos.test.ts`

**Interfaces:**
- Consumes: `Modulo`, `Trilha` de `./tipos`
- Produces: `TRILHA_B: Trilha` com `id: "imoveis"`, `numero: 2`, seis módulos: `imovel-cadastro`, `imovel-contrato`, `ocupantes`, `documentos-alojamento`, `consumo`, `imovel-vistorias`

| Módulo | Fonte da verdade |
|---|---|
`imovel-cadastro` | §11.1; `src/lib/imoveis.ts` |
`imovel-contrato` | §11.2 e §11.3; caução, reajuste por índice, ciclo de vida na aba de ações |
`ocupantes` | `supabase/migrations/0043_alojamento_ocupante.sql` — `cargo`, `quarto`, `armario`, `aceite_em`, `aceite_ip` |
`documentos-alojamento` | `src/lib/templates.ts` — os **sete** com `modulo: "imoveis"`; `src/lib/alojamento.ts`; `supabase/migrations/0044_alojamento_registros.sql` (`entrega_ocupante` com `tipo in ('chaves','kit')`, `medida_disciplinar`) e `0045_alojamento_limpeza.sql` |
`consumo` | §11.4 |
`imovel-vistorias` | §11.5; numeração `VIM-` e `OCO-` da migration `0048` |

- [ ] **Step 1: Escrever `trilha-b.ts`**

Regras específicas:

- O fio condutor avança no **Alojamento Rua das Palmeiras, 412**: recebe um ocupante, que assina o termo (FRM-RH-001), recebe chaves (FRM-RH-003) e o kit (FRM-RH-004), e a limpeza semanal é registrada (FRM-RH-005).
- `documentos-alojamento` é o módulo mais denso da trilha. Para **cada** um dos sete: quando sai, quem assina, onde fica arquivado. Os códigos (`FRM-RH-001`… `POL-RH-001`) saem exatamente como estão em `templates.ts` — são os códigos do sistema de qualidade da Sistenge e a pessoa vai procurar por eles.
- `ocupantes` explica o `aceite_em`/`aceite_ip`: o aceite registrado é o que prova que o alojado leu a política, e é o que sustenta uma medida disciplinar depois.
- **`perfis`**: `administrador` em destaque em toda a trilha; `documentos-alojamento` marca também `master`.
- **`diagrama`**: `imovel-contrato` usa `ciclo-contrato-imovel`.

- [ ] **Step 2: Escrever o teste de cobertura**

```ts
// acrescentar em src/lib/treinamento/tipos.test.ts
import { TRILHA_B } from "./trilha-b";
import { DOCUMENTOS } from "@/lib/templates";

describe("TRILHA_B", () => {
  it("tem os seis módulos previstos, nesta ordem", () => {
    expect(TRILHA_B.modulos.map((m) => m.id)).toEqual([
      "imovel-cadastro",
      "imovel-contrato",
      "ocupantes",
      "documentos-alojamento",
      "consumo",
      "imovel-vistorias",
    ]);
  });

  it("cita TODOS os documentos do módulo de imóveis, pelo código", () => {
    // Se o catálogo ganhar um documento e o treinamento não, este teste quebra.
    // É o único jeito de o material não envelhecer em silêncio.
    const m = TRILHA_B.modulos.find((x) => x.id === "documentos-alojamento")!;
    const texto = [m.problema, ...m.caminho, m.exemplo, ...m.exercicios].join(" ");
    const doModulo = DOCUMENTOS.filter((d) => d.modulo === "imoveis");
    expect(doModulo).toHaveLength(7);
    for (const d of doModulo) {
      const codigo = d.label.match(/\(([A-Z]{3}-RH-\d{3})\)/)?.[1];
      if (codigo) expect(texto, `falta ${codigo}`).toContain(codigo);
    }
  });

  it("o fio condutor atravessa a trilha", () => {
    const texto = TRILHA_B.modulos.map((m) => m.exemplo).join(" ");
    expect(texto).toContain("Palmeiras");
  });
});
```

- [ ] **Step 3: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/tipos.test.ts`
Expected: PASS

- [ ] **Step 4: Auditoria de PT-BR**

Run:
```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem|apos|ate) " src/lib/treinamento/trilha-b.ts
```
Expected: nada em string visível.

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test
git add src/lib/treinamento/trilha-b.ts src/lib/treinamento/tipos.test.ts
git commit -m "feat(treinamento): Trilha B — imóveis e alojamento

O teste lê DOCUMENTOS de templates.ts e exige que os sete códigos do
módulo de imóveis (FRM-RH-001 a 005, POL-RH-001, contrato) apareçam no
material. Se o catálogo ganhar um documento e o treinamento não, o teste
quebra — é o único jeito de o material não envelhecer em silêncio, que é
exatamente o que aconteceu com o manual em Markdown."
```

---

### Task 7: Gerador, os cinco checks e o arquivo publicável

**Files:**
- Create: `src/lib/treinamento/gerar.ts`
- Create: `src/lib/treinamento/gerar.test.ts`
- Create: `docs/treinamento/index.html` (gerado pelo teste)
- Modify: `.gitignore` — **nada a fazer**; o HTML gerado é o produto e vai versionado

**Interfaces:**
- Consumes: `TRILHA_0`, `TRILHA_A`, `TRILHA_B`; `validarTrilhas`, `TOTAL_MODULOS`; `CSS`, `JS`, `cabecalho`, `navTrilhas`, `secaoModulo`; `DIAGRAMAS`
- Produces: `TRILHAS: Trilha[]`, `paginaTreinamento(trilhas?: Trilha[]): string`

- [ ] **Step 1: Escrever o teste que falha — os cinco checks da spec**

```ts
// src/lib/treinamento/gerar.test.ts
import { describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { paginaTreinamento, TRILHAS } from "./gerar";
import { TOTAL_MODULOS, validarTrilhas } from "./tipos";
import { CORES_PERMITIDAS } from "./layout";

const DESTINO = "docs/treinamento";
const html = paginaTreinamento();

describe("estrutura", () => {
  it("as três trilhas passam pelo validador", () => {
    expect(validarTrilhas(TRILHAS)).toEqual([]);
  });

  it("são dezoito módulos", () => {
    expect(TRILHAS.flatMap((t) => t.modulos)).toHaveLength(TOTAL_MODULOS);
  });
});

describe("os cinco checks da spec", () => {
  it("1. nenhum buraco de dado no HTML final", () => {
    expect(html).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it("2. todo link interno tem destino", () => {
    const ancoras = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
    expect(ancoras.length).toBeGreaterThan(TOTAL_MODULOS);
    expect(ancoras.filter((a) => !ids.has(a))).toEqual([]);
  });

  it("3. nenhuma cor fora da lista permitida", () => {
    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    const usadas = [...html.matchAll(/#[0-9a-fA-F]{6}/g)].map((m) =>
      m[0].toUpperCase(),
    );
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
    expect(html.toLowerCase()).not.toContain("#cf2927");
  });

  it("4. os dezoito módulos aparecem no índice E no corpo", () => {
    for (const m of TRILHAS.flatMap((t) => t.modulos)) {
      expect(html, `índice sem ${m.id}`).toContain(`href="#${m.id}"`);
      expect(html, `corpo sem ${m.id}`).toContain(`id="${m.id}"`);
      expect(html, `título de ${m.id}`).toContain(m.titulo);
    }
  });

  it("5. nenhum recurso externo", () => {
    expect(html).not.toMatch(/src="https?:\/\/|@import|<link[^>]+href="http/);
  });
});

describe("aviso do recibo de ferramenta", () => {
  it("está ao fim da Trilha A, marcado como em construção", () => {
    // Sem isto, alguém procura no Loca uma tela que não existe.
    expect(html).toMatch(/recibo de ferramenta[\s\S]{0,400}em construção/i);
  });
});

describe("arquivo publicável", () => {
  it("escreve docs/treinamento/index.html", () => {
    // Apaga antes: arquivo de execução anterior que já não corresponde ao
    // conteúdo é pior que arquivo nenhum.
    rmSync(DESTINO, { recursive: true, force: true });
    mkdirSync(DESTINO, { recursive: true });
    writeFileSync(`${DESTINO}/index.html`, html, "utf8");
    expect(html.length).toBeGreaterThan(50_000);
  });
});
```

- [ ] **Step 2: Rodar e confirmar a falha**

Run: `npx vitest run src/lib/treinamento/gerar.test.ts`
Expected: FAIL — `Failed to resolve import "./gerar"`

- [ ] **Step 3: Escrever `gerar.ts`**

```ts
// src/lib/treinamento/gerar.ts
// Monta a página do treinamento a partir das três trilhas.
//
// O HTML resultante vive em `docs/treinamento/index.html`, escrito pelo teste, e
// é o arquivo publicado como Artifact. NUNCA editar aquele arquivo à mão: ele é
// gerado, e a próxima execução do teste desfaz a edição.

import { TRILHA_0 } from "./trilha-0";
import { TRILHA_A } from "./trilha-a";
import { TRILHA_B } from "./trilha-b";
import { DIAGRAMAS } from "./diagramas";
import { CSS, JS, cabecalho, navTrilhas, secaoModulo } from "./layout";
import type { Trilha } from "./tipos";

export const TRILHAS: Trilha[] = [TRILHA_0, TRILHA_A, TRILHA_B];

/**
 * Aviso ao fim da Trilha A.
 *
 * O recibo de ferramenta por funcionário foi pedido junto com o treinamento, e
 * o sistema não faz isso: falta tabela de colaborador independente de imóvel,
 * entrega por unidade de equipamento, numeração, PDF, RLS e telas. Dizer isso
 * aqui é o que impede alguém de procurar no Loca uma tela que não existe.
 */
function avisoRecibo(): string {
  return `<aside class="em-construcao" id="recibo-ferramenta">
    <h3>Recibo de ferramenta por funcionário — em construção</h3>
    <p>O controle de quem está com cada ferramenta <strong>ainda não existe no
    Loca</strong>. Hoje o sistema controla a ferramenta do fornecedor até a obra;
    a entrega para a pessoa que vai usá-la é feita fora do sistema.</p>
    <p>Está em projeto. Quando entrar, este treinamento ganha o módulo.</p>
  </aside>`;
}

export function paginaTreinamento(trilhas: Trilha[] = TRILHAS): string {
  const secoes = trilhas
    .map((t) => {
      const modulos = t.modulos
        .map((m) => secaoModulo(m, m.diagrama ? DIAGRAMAS[m.diagrama].svg : null))
        .join("");
      const extra = t.id === "ferramentas" ? avisoRecibo() : "";
      return `<section class="trilha" id="trilha-${t.id}">
        <header class="trilha-cab">
          <span class="trilha-n">Trilha ${t.numero}</span>
          <h2>${t.titulo}</h2>
          <p>${t.subtitulo}</p>
          <div class="barra" data-trilha="${t.id}"><span></span></div>
        </header>
        ${modulos}
        ${extra}
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Treinamento do Loca</title>
<style>${CSS}</style>
</head>
<body>
${cabecalho()}
${navTrilhas(trilhas)}
<main>${secoes}</main>
<script>${JS}</script>
</body>
</html>`;
}
```

**Nota sobre o check 5 e a tag `<style>`:** o teste proíbe `@import` e `href="http`, **não** a tag `<style>`. A regra de "estilo inline, sem `<style>`" de `src/lib/emails/` vale para **e-mail**, porque cliente de e-mail remove a tag. Isto é uma página web — `<style>` é o certo aqui.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/treinamento/gerar.test.ts`
Expected: PASS. Confirmar que `docs/treinamento/index.html` foi criado.

- [ ] **Step 5: Ritual completo, agora com build**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: os quatro verdes.

- [ ] **Step 6: Conferência humana**

Abrir `docs/treinamento/index.html` no navegador. Verificar:
- as três trilhas navegam e as âncoras saltam para o módulo certo;
- marcar um exercício, recarregar a página, e a marcação continuar lá;
- responder uma pergunta errada e o comentário aparecer;
- reduzir a janela a 390px e o conteúdo continuar legível;
- alternar o tema do sistema para escuro e nada desaparecer.

- [ ] **Step 7: Commit**

```bash
git add src/lib/treinamento/gerar.ts src/lib/treinamento/gerar.test.ts docs/treinamento/index.html
git commit -m "feat(treinamento): gerador, os cinco checks e o arquivo publicável

O HTML é gerado, não escrito: com dezoito módulos de cinco blocos, os
checks da spec — cobertura, integridade de link, paleta, ausência de
buraco de dado, ausência de recurso externo — só são verificáveis se o
conteúdo for dado. Como HTML à mão, nenhum deles existiria.

O aviso do recibo de ferramenta fecha a Trilha A dizendo que o controle
não existe. Sem ele, alguém procura no Loca uma tela que ninguém
construiu."
```

---

### Task 8: Atualizar o manual em Markdown para a 0.39.0

**Files:**
- Modify: `docs/manual-treinamento-loca.md`

**Interfaces:**
- Consumes: o conteúdo já escrito em `trilha-0.ts`, `trilha-a.ts`, `trilha-b.ts` — o manual **não** inventa fato novo
- Produces: nada em código

O manual referencia a **v0.19.3** e o sistema está em **0.39.0**. Ele continua sendo a referência de consulta (decisão da spec), então precisa dizer a verdade.

- [ ] **Step 1: Trocar a versão de referência do cabeçalho**

De `Versão do sistema de referência: **v0.19.3**.` para `**v0.39.0**`, e ajustar a frase que aponta o treinamento interativo — o manual passa a citar `docs/treinamento/index.html`.

- [ ] **Step 2: Acrescentar as seções que não existem**

Ler `src/lib/changelog.ts` das versões 0.20.0 a 0.39.0 e cobrir o que ficou de fora. O que sabidamente falta:

| Assunto | Onde entra |
|---|---|
Numeração de registro (`CTR-`, `VIS-`, `AVA-`, `REC-`…) | Seção nova, antes de §5, porque atravessa todos os módulos |
Recebimento de equipamento | Subseção nova em §8, depois de §8.2 |
Documentos do alojamento (os sete) | Ampliar §11.6; hoje é um parágrafo |
Checklist semanal de limpeza (FRM-RH-005) | Subseção nova em §11 |
Medidas disciplinares (FRM-RH-002) | Subseção nova em §11 |
Alertas por obra | Ampliar §13.2 |
Modo de teste de e-mail | §13.2 |

- [ ] **Step 3: Conferir os números que o manual afirma**

Verificar um a um, e corrigir onde estiver errado:

```bash
grep -c "    label: \"" src/lib/relatorios.ts   # relatórios: doze
grep -c "    label: \"" src/lib/templates.ts    # documentos: oito
grep -c "  { chave:" src/lib/modulos.ts         # módulos: oito
```

O manual antigo declarava um número de relatórios diferente do real. Nenhuma contagem entra por memória.

- [ ] **Step 4: Auditoria de PT-BR**

Run:
```bash
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem) " docs/manual-treinamento-loca.md
```

- [ ] **Step 5: Commit**

```bash
git add docs/manual-treinamento-loca.md
git commit -m "docs: manual de treinamento atualizado para a 0.39.0

Ele referenciava a v0.19.3 — vinte versões menores atrás — e continuava
circulando como referência. Manual desatualizado é pior que manual
nenhum: quem o lê aprende o sistema de um ano atrás e não desconfia.

Entram numeração de registro, recebimento de equipamento, os sete
documentos do alojamento, checklist de limpeza, medidas disciplinares,
alertas por obra e o modo de teste de e-mail. As contagens foram
conferidas no código, não na memória: são doze relatórios, não o número
que estava escrito."
```

---

### Task 9: Publicar o Artifact e versionar

**Files:**
- Modify: `src/lib/changelog.ts`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: `docs/treinamento/index.html`
- Produces: a URL do Artifact, que entra no texto do changelog

A ordem importa: o texto do changelog cita o link, então **publicar primeiro**.

- [ ] **Step 1: Carregar a skill de design de Artifact**

Antes de publicar, ler a skill `artifact-design`. É obrigatório pelo contrato da ferramenta Artifact, e calibra quanto investimento visual o caso pede.

- [ ] **Step 2: Publicar**

Publicar `docs/treinamento/index.html` como Artifact, com:
- `favicon`: `🎓`
- `description`: uma frase — "Treinamento do Loca em três trilhas: fundação, ferramentas e locações, imóveis e alojamento."
- `<title>` já vem no arquivo: `Treinamento do Loca`

Guardar a URL devolvida.

- [ ] **Step 3: Confirmar a versão atual antes de bumpar**

```bash
grep '"version"' package.json && grep 'APP_VERSION' src/lib/changelog.ts
```

Se a saída **não** for `0.39.0`, o `main` avançou durante a execução: rebasear e recalcular o alvo. O alvo previsto é **0.40.0** (MINOR — funcionalidade nova sem quebrar nada), mas não presuma.

- [ ] **Step 4: Bumpar os três pontos**

`src/lib/changelog.ts` — `APP_VERSION` para `0.40.0` e um `Release` novo no topo:

```ts
{
  versao: "0.40.0",
  data: "AAAA-MM-DD",   // a data real do dia da execução
  titulo: "Treinamento do Loca",
  mudancas: [
    { tipo: "novo", texto: "Treinamento interativo em três trilhas: a fundação que todos fazem, o controle de ferramentas e locações, e o de imóveis e alojamento. Com exemplos percorridos do começo ao fim, exercícios para fazer no sistema e verificação ao fim de cada módulo. Abre no celular: LINK_DO_ARTIFACT" },
    { tipo: "melhoria", texto: "O manual de consulta foi atualizado: ele descrevia o sistema de vinte versões atrás e não cobria o recebimento de equipamento, os documentos do alojamento nem a numeração dos registros." },
  ],
},
```

`CHANGELOG.md` — replicar no formato Keep a Changelog, com a URL.

`package.json` — `"version": "0.40.0"`.

- [ ] **Step 5: Ritual e commit**

```bash
npm run typecheck && npm run lint && npm test && npm run build
git add src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore(release): 0.40.0 — treinamento do Loca

O link do Artifact entra no texto da tela Novidades, e é por isso que a
publicação vem antes do bump: o changelog cita a URL."
```

- [ ] **Step 6: Push e PR**

```bash
git push -u origin feat/treinamento-interativo
gh pr create --base main --title "feat(treinamento): treinamento interativo em três trilhas (v0.40.0)" --body-file <(...)
```

O corpo do PR deve trazer: o link do Artifact, as três trilhas com os dezoito módulos, os cinco checks e o resultado do ritual, e o que ficou de fora com o motivo.

---

## Self-Review

**1. Cobertura da spec.** Percorrendo as seções do documento de desenho:

| Seção da spec | Tarefa |
|---|---|
Estrutura — três trilhas, 18 módulos | 1 (tipos e `TOTAL_MODULOS`), 4, 5, 6 |
Fio condutor | 4, 5, 6 — com teste de presença em cada uma |
Anatomia de um módulo — cinco blocos | 1 (tipo `Modulo`), 2 (`secaoModulo` e o teste dos cinco rótulos) |
Progresso em `localStorage` | 2 — incluindo o teste de `try/catch` |
Diagramas (quatro) | 3 |
Identidade visual | 2 (`CORES_PERMITIDAS`), 3, 7 — o check de paleta roda nas três |
Entrega (arquivo, Artifact, manual) | 7, 8, 9 |
Verificação (cinco checks) | 7 |
Versionamento (0.40.0 depois de publicar) | 9 |
Fora de escopo — aviso do recibo | 7 (`avisoRecibo`) |

Sem lacuna.

**2. Placeholders.** As Tarefas 4, 5 e 6 não transcrevem o texto dos dezoito módulos, e isso é deliberado — aquele texto **é** o produto, e o plano fixa o que precisa fixar: a estrutura tipada, a **fonte da verdade de cada fato** (tabela por módulo) e o teste que verifica cobertura. Não é "TODO": é a fronteira entre plano e execução. Todo passo de código traz o código.

**3. Consistência de tipos.** Conferido:
- `validarTrilhas(trilhas: Trilha[]): string[]` — mesma assinatura nas Tarefas 1, 4, 5, 6, 7
- `secaoModulo(m: Modulo, svg: string | null)` — o `null` explícito é o que a Tarefa 7 passa quando `m.diagrama` é `undefined`
- `DIAGRAMAS: Record<DiagramaKey, { titulo: string; svg: string }>` — a Tarefa 7 lê `.svg`; a Tarefa 3 testa `.titulo` dentro de `<title>`
- `CORES_PERMITIDAS: string[]` — definido na Tarefa 2, consumido nas Tarefas 3 e 7
- `TRILHA_0` / `TRILHA_A` / `TRILHA_B` — exportados nas Tarefas 4/5/6, agregados em `TRILHAS` na Tarefa 7
- `PERFIL_LABEL: Record<PerfilKey, string>` — Tarefa 2, e `PerfilKey = Papel` da Tarefa 1

**4. Uma contradição resolvida.** O check 5 ("nenhum recurso externo") poderia ser lido como a regra de e-mail "sem tag `<style>`". São coisas diferentes e a Tarefa 7 diz isso explicitamente: cliente de e-mail remove `<style>`, navegador não. Aqui `<style>` é o certo.
