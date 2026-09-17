# Busca global no Ctrl+K — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o Ctrl+K passa a encontrar registros do banco — obras, fornecedores, equipamentos, funcionários, contratos e imóveis — além das páginas e ações que já encontra.

**Architecture:** uma leitura em `src/lib/data/busca.ts` traz as colunas de identidade das seis tabelas sob RLS, e o casamento acontece **no servidor**, em memória, com o mesmo `normalizar()` que o palette já usa para páginas. A ordenação é uma função pura em `src/lib/busca.ts`, testada isoladamente. O palette ganha debounce e passa a mesclar resultados do servidor com o índice local.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, vitest, Base UI/shadcn "base-nova".

**Spec:** `docs/superpowers/specs/2026-09-17-busca-global-design.md` — leia antes da Task 1, inclusive a seção que corrige a própria spec sobre `unaccent`.

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário.** Auditoria: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **`createAdminClient()` nunca toca tabela da aplicação** — só em `src/app/api/cron/*`. Aqui é sempre `createClient()`. **Esta regra é a feature inteira:** a busca não tem caminho próprio até o dado, e é isso que impede o vazamento.
- Leituras compartilhadas vivem em `src/lib/data/<dominio>.ts`, com `import "server-only"` no topo e **tipos de retorno planos** — nunca expor a ambiguidade `T | T[] | null` do PostgREST.
- **Erro em leitura de lista: loga e devolve vazio.** Nunca derruba a tela.
- Composição de componente é **`render={<Link/>}`, NUNCA `asChild`**.
- `--brand` é restrito a logotipo e badges de crítico. A cor de ação é `--primary`. Nenhum hex literal.
- **"Hoje" é sempre `hojeISOSaoPaulo()`** — não se aplica a esta onda, que não tem datas, mas vale se alguma aparecer.
- **Versionamento nos três pontos** (`src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`) — Task 4. Versão-alvo: **0.117.0** (MINOR).
- **Ritual:** `npm run typecheck && npx eslint src && npm test && npm run build`. (`npm run lint` tem 8 erros pré-existentes em `.claude/helpers/*.cjs`, que é ferramental local fora do projeto; `npx eslint src` é a checagem que vale.)
- Estado atual da suíte: **1460 testes em 83 arquivos**, todos verdes. Versão atual: 0.116.0.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/busca.ts` | **criar** — puro: tipos, `normalizarBusca`, `classificarAcerto`, `ordenarResultados` |
| `src/lib/busca.test.ts` | **criar** — os testes do puro |
| `src/lib/data/busca.ts` | **criar** — as seis leituras, `server-only`, `createClient()` |
| `src/components/layout/busca-actions.ts` | **criar** — a ponte `"use server"` entre o palette (cliente) e a leitura (servidor) |
| `src/components/layout/command-palette.tsx` | **modificar** — debounce, estado do servidor, grupos por entidade |
| `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json` | **modificar** — v0.117.0 |

**Nenhuma migration.** A spec chegou a pedir a extensão `unaccent`, e isso foi corrigido: o PostgREST não expressa `unaccent(coluna)` num filtro `.or()`, então o casamento roda no servidor Node, não no Postgres.

---

### Task 1: o módulo puro — normalização, classificação e ordenação

**Files:**
- Create: `src/lib/busca.ts`
- Test: `src/lib/busca.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:

```ts
/** As entidades que a busca cobre, na ordem fixa de desempate. */
export const ENTIDADES = ["obra", "fornecedor", "equipamento", "funcionario", "contrato", "imovel"] as const;
export type Entidade = (typeof ENTIDADES)[number];

export type ResultadoBusca = {
  entidade: Entidade;
  id: string;
  titulo: string;
  /** Segunda linha do resultado: código, CPF, patrimônio — o que identifica. */
  detalhe: string | null;
  href: string;
  /** Em qual campo o termo bateu, e como. Decide a ordem. */
  acerto: Acerto;
};

export type Acerto = "codigo-prefixo" | "codigo-contem" | "nome-prefixo" | "nome-contem";

export const TERMO_MINIMO = 2;

export function normalizarBusca(s: string): string;
export function termoValido(s: string): boolean;
export function classificarAcerto(args: {
  termo: string;
  nome: string;
  codigos: (string | null)[];
}): Acerto | null;
export function ordenarResultados(rs: ResultadoBusca[]): ResultadoBusca[];
```

- [ ] **Step 1: escrever os testes que devem falhar**

```ts
import { describe, it, expect } from "vitest";
import {
  normalizarBusca,
  termoValido,
  classificarAcerto,
  ordenarResultados,
  ENTIDADES,
  type ResultadoBusca,
} from "./busca";

describe("normalizarBusca", () => {
  it("tira acento e caixa, para que 'andre' ache 'André'", () => {
    // É POR ISTO QUE O FILTRO NÃO RODA NO BANCO. O PostgREST não expressa
    // `unaccent(coluna)` num `.or()`, e sem acento resolvido "joao" não acha
    // "João" — entre 510 funcionários brasileiros, a busca pareceria quebrada.
    expect(normalizarBusca("André")).toBe("andre");
    expect(normalizarBusca("JOÃO")).toBe("joao");
    expect(normalizarBusca("  Imóveis  ")).toBe("imoveis");
  });
});

describe("termoValido", () => {
  it("uma letra não vale: casaria com quase tudo", () => {
    expect(termoValido("a")).toBe(false);
    expect(termoValido(" a ")).toBe(false);
    expect(termoValido("")).toBe(false);
  });

  it("duas letras valem", () => {
    expect(termoValido("an")).toBe(true);
  });
});

describe("classificarAcerto", () => {
  it("prefixo no nome vence 'contém' no nome", () => {
    expect(classificarAcerto({ termo: "ande", nome: "Anderson", codigos: [] })).toBe("nome-prefixo");
    expect(
      classificarAcerto({ termo: "ande", nome: "Fernando Andrade", codigos: [] }),
    ).toBe("nome-contem");
  });

  it("acerto em código vence acerto em nome", () => {
    // Quem digita 14L4594 sabe exatamente o que quer.
    expect(
      classificarAcerto({ termo: "14l4594", nome: "Notebook", codigos: ["14L4594"] }),
    ).toBe("codigo-prefixo");
  });

  it("ignora acento também nos campos, não só no termo", () => {
    expect(classificarAcerto({ termo: "joao", nome: "João da Silva", codigos: [] })).toBe(
      "nome-prefixo",
    );
  });

  it("ignora código nulo sem quebrar", () => {
    // `cnpj`, `codigo` e `service_tag` são todos anuláveis no banco.
    expect(classificarAcerto({ termo: "silva", nome: "Silva", codigos: [null, null] })).toBe(
      "nome-prefixo",
    );
  });

  it("devolve null quando não bate em nada", () => {
    expect(classificarAcerto({ termo: "zzz", nome: "Anderson", codigos: ["A1"] })).toBeNull();
  });
});

describe("ordenarResultados", () => {
  const r = (over: Partial<ResultadoBusca>): ResultadoBusca => ({
    entidade: "obra",
    id: "1",
    titulo: "X",
    detalhe: null,
    href: "/x",
    acerto: "nome-contem",
    ...over,
  });

  it("código antes de nome, prefixo antes de contém", () => {
    const ordenado = ordenarResultados([
      r({ id: "d", acerto: "nome-contem" }),
      r({ id: "b", acerto: "codigo-contem" }),
      r({ id: "a", acerto: "codigo-prefixo" }),
      r({ id: "c", acerto: "nome-prefixo" }),
    ]);
    expect(ordenado.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("empate desempata pela ordem fixa das entidades", () => {
    // ORDEM ESTÁVEL VALE MAIS QUE ORDEM ESPERTA: o usuário aprende onde as
    // coisas caem, e a lista não dança entre uma busca e outra.
    const ordenado = ordenarResultados([
      r({ id: "imovel", entidade: "imovel", acerto: "nome-prefixo" }),
      r({ id: "obra", entidade: "obra", acerto: "nome-prefixo" }),
      r({ id: "funcionario", entidade: "funcionario", acerto: "nome-prefixo" }),
    ]);
    expect(ordenado.map((x) => x.entidade)).toEqual(["obra", "funcionario", "imovel"]);
  });

  it("não perde nem duplica resultado", () => {
    const entrada = ENTIDADES.map((e, i) => r({ id: String(i), entidade: e }));
    expect(ordenarResultados(entrada)).toHaveLength(ENTIDADES.length);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/busca.test.ts`
Expected: FAIL — `Failed to resolve import "./busca"`.

- [ ] **Step 3: implementar `src/lib/busca.ts`**

Escreva o módulo com estas decisões, e comente **o porquê** de cada uma, em português, no tom dos arquivos vizinhos (`src/lib/frota.ts`, `src/lib/mega/conciliacao.ts`):

- `normalizarBusca` faz `NFD` + remover diacríticos + `toLowerCase()` + `trim()`. É a mesma transformação que `normalizar()` em `command-palette.tsx:41` — **e isso é deliberado**: páginas são filtradas no cliente e registros no servidor, e o acerto precisa ser idêntico nos dois, senão "Imóveis" aparece e "Imóvel Centro" não.
- `classificarAcerto` normaliza o termo E os campos antes de comparar. Confere os códigos primeiro; entre eles, prefixo antes de contém; depois o nome, na mesma ordem.
- `ordenarResultados` usa um peso numérico por `Acerto` e, no empate, o índice da entidade em `ENTIDADES`. Use `[...rs].sort(...)` — **não ordene o array recebido no lugar**, ou o chamador vê a lista dele mudar por baixo.

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/busca.test.ts && npm test`
Expected: PASS nos dois.

- [ ] **Step 5: commit**

```bash
git add src/lib/busca.ts src/lib/busca.test.ts
git commit -m "feat(busca): a regra de acerto e ordenacao, pura e testada"
```

---

### Task 2: a camada de leitura

**Files:**
- Create: `src/lib/data/busca.ts`

**Interfaces:**
- Consumes: `normalizarBusca`, `classificarAcerto`, `ordenarResultados`, `termoValido`, `TERMO_MINIMO`, os tipos `ResultadoBusca` e `Entidade` — todos da Task 1.
- Produces:

```ts
export type GrupoBusca = {
  entidade: Entidade;
  /** Rótulo em PT-BR no plural: "Funcionários", "Obras". */
  rotulo: string;
  itens: ResultadoBusca[];   // no máximo 5
  total: number;             // quantos casaram no total
  /** Lista filtrada, para o "ver todos". */
  hrefTodos: string;
};

export async function buscarGlobal(termo: string): Promise<GrupoBusca[]>;
```

Grupo sem nenhum acerto **não entra** no retorno. Termo inválido devolve `[]` sem tocar o banco.

- [ ] **Step 1: ler os padrões antes de escrever**

Leia `src/lib/data/fornecedores.ts` e `src/lib/data/conciliacao.ts`. Repare em três coisas que você vai repetir: `import "server-only"` no topo, `createClient()` de `@/lib/supabase/server`, e o tratamento de erro de lista — `logger.error` mais `erroMeta(error)`, devolvendo vazio.

- [ ] **Step 2: escrever o módulo**

Seis leituras num `Promise.all`, cada uma trazendo **só** as colunas de identidade — nunca `select("*")`, que traria CPF e dados que a busca não usa e que não precisam sair da tabela:

| Entidade | Tabela | Colunas | `href` do resultado | `hrefTodos` |
| --- | --- | --- | --- | --- |
| obra | `obra` | `id, nome, codigo` | `/obras/<id>` | `/obras?q=<termo>` |
| fornecedor | `fornecedor` | `id, nome, cnpj` | `/fornecedores/<id>` | `/fornecedores?q=<termo>` |
| equipamento | `equipamento_unidade` | `id, identificador, numero_serie, service_tag` | `/frota/<id>` | `/frota?q=<termo>` |
| funcionario | `funcionario` | `id, nome, cpf` | `/termos/funcionarios` | `/termos/funcionarios` |
| contrato | `contrato_locacao` | `id, numero, numero_registro` | `/contratos/<id>` | `/contratos?q=<termo>` |
| imovel | `imovel` | `id, apelido, proprietario_nome` | `/imoveis/<id>` | `/imoveis?q=<termo>` |

Regras que o código precisa respeitar, e cada uma merece um comentário dizendo por quê:

- **Não há ficha individual de funcionário.** `/termos/funcionarios` é uma listagem; o resultado leva a ela. Não invente `/funcionarios/<id>` — a rota não existe e daria 404.
- **Confira o parâmetro de busca de cada listagem antes de montar `hrefTodos`.** `parseListaParams` em `src/lib/lista.ts` diz qual é; se uma listagem não aceitar busca, `hrefTodos` é a lista sem parâmetro. Não invente `?q=` onde ele é ignorado.
- **Filtre as tabelas com soft delete** por `deleted_at is null`. Verifique quais das seis têm a coluna — `fornecedor` **não tem**, usa `ativo`, e confundir as duas faz o PostgREST recusar a consulta inteira e devolver `data` nulo, fazendo a entidade sumir da busca em silêncio. Isso já aconteceu neste repositório (ver o comentário em `src/lib/mega/servidor.ts`).
- **O título do equipamento** é o `identificador`; `numero_serie` e `service_tag` entram como códigos e como `detalhe`.
- **Cada consulta falha sozinha.** Envolva cada uma de modo que um erro logue e devolva grupo vazio, sem derrubar as outras cinco.

- [ ] **Step 3: conferir que nada vaza por client errado**

Run: `grep -n "createAdminClient" src/lib/data/busca.ts || echo "(limpo)"`
Expected: `(limpo)`. Um client admin aqui faria a busca devolver registros de todas as organizações, sem erro e sem teste vermelho.

- [ ] **Step 4: typecheck**

Run: `npm run typecheck && npx eslint src && npm test`
Expected: PASS nos três.

- [ ] **Step 5: commit**

```bash
git add src/lib/data/busca.ts
git commit -m "feat(busca): as seis leituras, sob a RLS que ja existe"
```

---

### Task 3: o palette passa a buscar

**Files:**
- Modify: `src/components/layout/command-palette.tsx`

**Interfaces:**
- Consumes: `buscarGlobal` e `GrupoBusca` da Task 2; `TERMO_MINIMO` da Task 1.
- Produces: nada que outra task consuma.

- [ ] **Step 1: o comentário do topo mente e precisa ser reescrito**

O cabeçalho do arquivo diz hoje:

> "Não indexamos registros do banco (obras/contratos por nome): exigiria endpoint de busca com debounce, e as listas já têm o ListSearch."

Isso deixa de ser verdade. **Não apague o parágrafo — reescreva-o** para dizer o que passou a valer e por quê: que os registros agora entram, que o filtro roda no servidor porque o PostgREST não expressa `unaccent`, e que a permissão vem da RLS e não de checagem no palette. Comentário que mente é pior que comentário nenhum.

- [ ] **Step 2: como o cliente chama o servidor**

O palette é `"use client"` e `src/lib/data/busca.ts` é `server-only` — **não dá para importar direto**. Você precisa de uma ponte. Duas formas existem no Next: uma server action ou um route handler.

**Use uma server action**, num arquivo `"use server"` próprio, e não um route handler: é o padrão que o repositório inteiro usa para ir do cliente ao servidor, e um route handler novo traria autenticação e desserialização por conta própria.

A action é uma casca: confere a sessão com `getCurrentPerfil()`, e delega para `buscarGlobal`. **Sem sessão, devolve `[]`** — nunca resultados.

- [ ] **Step 3: o estado no cliente**

- `resultadosServidor: GrupoBusca[]`, começando vazio.
- `buscando: boolean`, para a linha de "Buscando…".
- Um `useEffect` sobre `busca` com `setTimeout` de **200 ms**; o `clearTimeout` no cleanup é o debounce.
- Termo com menos de `TERMO_MINIMO` caracteres limpa os resultados e **não chama** a action.
- **Descartar resposta fora de ordem.** Guarde o termo que originou a chamada e, ao voltar, compare com o termo atual; se mudou, ignore. Sem isso o resultado de "and" sobrescreve o de "anderson" e a lista mostra o que o usuário já parou de procurar.
- Ao fechar o palette, limpe também os resultados do servidor, junto com `busca` e `indiceAtivo` — o `alternar(false)` já faz os outros dois.

- [ ] **Step 4: a lista**

O tipo `Entrada` de hoje é `{ label, href, grupo }` e `Grupo` é `"Páginas" | "Ações"`. Alargue os dois para caberem os registros, mantendo a navegação por teclado funcionando sobre a lista **inteira** — setas e Enter já percorrem `resultados`, e isso precisa continuar valendo com os registros no meio.

Ordem dos grupos: **Ações**, **Páginas**, depois um por entidade, na ordem de `ENTIDADES`. Páginas antes porque são instantâneas: a lista já é útil enquanto os registros carregam.

Cada resultado de registro mostra o `titulo` e, abaixo, o `detalhe` em `text-xs text-muted-foreground`. O cabeçalho do grupo mostra o rótulo e, quando `total > itens.length`, o texto **"(5 de 40)"** com um link para `hrefTodos`.

Enquanto `buscando` for verdadeiro e ainda não houver registros, mostre **"Buscando…"** no fim da lista — nunca troque as páginas por um spinner, que é o que faria a lista piscar a cada tecla.

O placeholder e o `aria-label` do campo dizem hoje "Buscar páginas e ações…". Passe os dois para **"Buscar páginas, ações e registros…"**.

- [ ] **Step 5: auditoria de PT-BR**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/components/layout/command-palette.tsx
```
Expected: só identificadores (`numero_serie`, `numero_registro`). Texto visível sem acento é erro.

- [ ] **Step 6: ritual completo**

Run: `npm run typecheck && npx eslint src && npm test && npm run build`
Expected: tudo PASS. Este é o ponto do plano em que `npm run build` importa, porque é onde o componente de cliente muda.

- [ ] **Step 7: commit**

```bash
git add src/components/layout/command-palette.tsx src/components/layout
git commit -m "feat(busca): o Ctrl+K passa a achar registro, nao so pagina"
```

---

### Task 4: versão e changelog

**Files:**
- Modify: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`

- [ ] **Step 1: bumpar para `0.117.0`**

MINOR: funcionalidade nova sem quebrar o que existe. A versão atual é 0.116.0.

- `src/lib/changelog.ts`: `APP_VERSION = "0.117.0"` e um `Release` novo no topo, data `2026-09-17`. Itens em texto de usuário, sem jargão — por exemplo: *"A busca do Ctrl+K agora encontra obras, fornecedores, equipamentos, funcionários, contratos e imóveis, e não só as páginas do menu."* e *"Buscar sem acento funciona: digitar 'joao' encontra 'João'."*
- `CHANGELOG.md`: o mesmo resumo em Keep a Changelog.
- `package.json`: `"version": "0.117.0"`.

- [ ] **Step 2: conferir a sincronia**

Run: `node -e "const p=require('./package.json');const s=require('fs').readFileSync('src/lib/changelog.ts','utf8');const c=require('fs').readFileSync('CHANGELOG.md','utf8');console.log(p.version, s.includes('APP_VERSION = \"'+p.version+'\"')?'ok':'DIVERGENTE', c.includes('['+p.version+']')?'ok':'DIVERGENTE')"`
Expected: `0.117.0 ok ok`

- [ ] **Step 3: ritual e commit**

Run: `npm run typecheck && npx eslint src && npm test && npm run build`

Atualize também a seção **Estado da implementação** da spec para refletir o que ficou pronto e o que continua fora de escopo.

```bash
git add src/lib/changelog.ts CHANGELOG.md package.json docs/
git commit -m "chore: v0.117.0 — a busca global no Ctrl+K"
```

---

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Busca global | Spec e plano escritos | Tasks 1 a 4 | 15% |

Próximo passo único: executar a Task 1.
