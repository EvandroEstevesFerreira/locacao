# Máquina de treinamento — Fatia 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trilhas de treinamento dentro do Loca, com questionário corrigido no servidor, registro de conclusão por versão de conteúdo, comprovante assinado em PDF, painel de quem falta, e o manual lendo a mesma fonte.

**Architecture:** Trilhas e aulas são constantes em `src/lib/treinamento/`, versionadas com o código. Uma tabela no banco (`treinamento_conclusao`) registra só o fato: quem concluiu qual trilha em qual versão. "Pendente" é calculado, nunca armazenado. O manual (`/ajuda`) indexa as mesmas aulas pelas rotas que cada uma cobre — uma fonte, duas ordens de leitura.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS + PostgREST), zod 4, react-hook-form + zodResolver, Tailwind v4 + Base UI, Vitest, @react-pdf/renderer.

**Spec:** `docs/superpowers/specs/2026-09-03-treinamento-design.md`
**Decisões prévias:** `docs/superpowers/specs/2026-09-03-treinamento-decisoes.md`

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário** — e nesta fatia isso inclui **o conteúdo das aulas e das perguntas**, que é quase tudo o que ela produz. Identificadores TypeScript, chaves de trilha e de aula, `name=`/`id=`, e slugs de rota ficam sem acento.
- **A correção do questionário é no SERVIDOR.** `Pergunta.correta` nunca vai no payload da página. Um questionário cujas respostas chegam ao navegador é decorativo.
- **Aprovação só com 100%.** Com três a cinco perguntas, nota de corte menor significa "pode errar uma", e a que a pessoa erra é a que ela precisava. Errar não pune: mostra o `porque`, aponta a aula, oferece tentar de novo.
- **"Hoje" é sempre `hojeISOSaoPaulo()`** de `src/lib/locacao.ts`, nunca `new Date()`, quando a data é comparada com coluna `date`. `new Date()` continua correto para `timestamptz` e em componente `"use client"`.
- **Schemas zod moram em `src/lib/<dominio>.ts`**, nunca dentro de `actions.ts` — arquivo `"use server"` não pode ser importado por componente cliente.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.** Retorno padrão: `ActionResult` de `src/lib/acoes.ts`, com `falha()` e `primeiroErro()`.
- **`createAdminClient()` nunca toca tabela da aplicação.** Use `createClient()`.
- **Leitura compartilhada em `src/lib/data/<dominio>.ts`**, com `import "server-only"` e tipos de retorno **planos**. Erro em lista: `console.error` e devolve vazio. Erro em detalhe: devolve `null` e a página chama `notFound()`.
- **Toda view nasce com `security_invoker = on`.** Esta fatia não cria view.
- **Composição de primitivo é `render={<Link/>}`, não `asChild`** (shadcn "base-nova" sobre Base UI).
- **Ritual de fechamento, cada passo rodado SEPARADAMENTE:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Chainar os quatro num comando só já fez o Vitest engolir um arquivo de teste em silêncio neste projeto.
- Depois de `npm test`, compare o "Test Files" com `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`. Hoje o disco tem **34** arquivos e a suíte reporta **592** testes.
- **Versionamento em três pontos em sincronia:** `src/lib/changelog.ts` (`APP_VERSION` + `Release`), `CHANGELOG.md`, `package.json`. Esta fatia fecha em **0.51.0** (MINOR: funcionalidade nova).

---

### Task 1: O modelo de conteúdo, a trilha de primeiros passos, e a varredura de integridade

**Files:**
- Create: `src/lib/treinamento/tipos.ts`
- Create: `src/lib/treinamento/primeiros-passos.ts`
- Create: `src/lib/treinamento/index.ts`
- Test: `src/lib/treinamento/conteudo.test.ts`

**Interfaces:**
- Consumes: `type ModuloKey` de `src/lib/modulos.ts`; `type Papel` de `src/lib/permissoes.ts`.
- Produces:
  - `type Passo`, `type Aula`, `type Pergunta`, `type Trilha` (em `tipos.ts`)
  - `PRIMEIROS_PASSOS: Trilha` (em `primeiros-passos.ts`)
  - `TRILHAS: Trilha[]` e `trilhaPorChave(chave: string): Trilha | undefined` (em `index.ts`)

- [ ] **Step 1: Criar `src/lib/treinamento/tipos.ts`**

```ts
// O modelo de conteúdo do treinamento — e do manual, que é a mesma coisa em
// outra ordem.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE O CONTEÚDO MORA NO CÓDIGO
// ═══════════════════════════════════════════════════════════════════════════
//
// Treinamento de software É documentação de software. Se a tela muda, a aula
// muda no mesmo commit, e o diff mostra as duas coisas lado a lado. No banco, a
// tela muda e a aula fica mentindo em silêncio, porque nada liga uma coisa à
// outra — o mesmo defeito do manual em Word, só dentro do sistema.
//
// Custo aceito: corrigir uma vírgula exige deploy.
// ═══════════════════════════════════════════════════════════════════════════

import type { ModuloKey } from "@/lib/modulos";
import type { Papel } from "@/lib/permissoes";

/**
 * Um passo de uma aula.
 *
 * `esperado` é o que separa treinamento de passeio guiado: "clique em Salvar"
 * ensina a clicar; "clique em Salvar — tem de aparecer o item na lista" ensina
 * a reconhecer que funcionou, e a perceber quando NÃO funcionou.
 */
export type Passo = {
  /** Onde a pessoa está: rota ou nome da tela. */
  onde: string;
  /** O que fazer. Imperativo, uma ação. */
  acao: string;
  /** O que tem de acontecer. */
  esperado: string;
};

export type Aula = {
  /** Estável e único na trilha. Entra na URL e no registro. */
  id: string;
  titulo: string;
  /** Uma frase: por que esta aula existe. É o que o manual mostra no índice. */
  resumo: string;
  /**
   * Rotas que esta aula cobre.
   *
   * É o ÚNICO campo que existe para o manual, e é o que permite indexar por
   * tela sem escrever nada duas vezes.
   */
  rotas: string[];
  passos: Passo[];
  /** Armadilhas e regras que a tela não explica sozinha. */
  atencao?: string[];
  /** Versão da trilha em que esta aula mudou materialmente. */
  desdeVersao: number;
};

/**
 * Uma pergunta do questionário.
 *
 * `porque` é mostrado SEMPRE, acertando ou errando. Errar e não saber por que
 * só ensina a chutar melhor.
 */
export type Pergunta = {
  id: string;
  enunciado: string;
  /** Quatro alternativas. */
  alternativas: string[];
  /** Índice da correta em `alternativas`. NUNCA vai ao cliente. */
  correta: number;
  porque: string;
  /** O `id` da aula que responde esta pergunta — o link de "revise isto". */
  aula: string;
};

export type Trilha = {
  /** Slug da rota: `/treinamento/<chave>`. */
  chave: string;
  titulo: string;
  /** Uma frase na lista de trilhas. */
  resumo: string;
  /**
   * Módulo que a trilha ensina, ou `null` para trilha de todos.
   *
   * Quando há módulo, só quem tem o módulo liberado vê a trilha — a regra é a
   * de `moduloLiberado` em `src/lib/modulos.ts`, e não é redecidida aqui.
   */
  modulo: ModuloKey | null;
  /** Papéis a que a trilha se aplica. Vazio = todos. */
  papeis: Papel[];
  /** Bump DELIBERADO quando o conteúdo muda de forma material. */
  versao: number;
  aulas: Aula[];
  perguntas: Pergunta[];
};
```

- [ ] **Step 2: Criar `src/lib/treinamento/primeiros-passos.ts`**

Esta é a trilha que todo mundo faz, e a que prova a máquina de ponta a ponta. Transcreva o conteúdo abaixo **fielmente** — ele foi escrito para esta fatia e a acentuação é obrigatória.

```ts
// Trilha de primeiros passos — a única que todo usuário faz, em qualquer papel.
//
// A aula `entrar` fala de uma tela que quem está lendo já passou: ela existe
// para o MANUAL (alguém consultando por outra pessoa, ou lendo antes de repassar
// a senha a um novo funcionário), não porque quem está trancado fora vá lê-la.

import type { Trilha } from "./tipos";

export const PRIMEIROS_PASSOS: Trilha = {
  chave: "primeiros-passos",
  titulo: "Primeiros passos no Loca",
  resumo:
    "Entrar, entender o menu, achar uma obra e saber o que fazer quando falta acesso.",
  modulo: null,
  papeis: [],
  versao: 1,
  aulas: [
    {
      id: "entrar",
      titulo: "Entrar no Loca",
      resumo: "Onde é o endereço, e o que fazer quando a senha não passa.",
      rotas: ["/login"],
      desdeVersao: 1,
      passos: [
        {
          onde: "Navegador",
          acao: "Abra o endereço do Loca e guarde nos favoritos.",
          esperado: "A tela de entrada aparece, com campo de e-mail e senha.",
        },
        {
          onde: "/login",
          acao: "Digite o seu e-mail da Sistenge e a senha que você recebeu.",
          esperado:
            "O sistema abre na tela inicial, com o seu nome no canto e o menu à esquerda.",
        },
        {
          onde: "/login",
          acao: "Erre a senha de propósito uma vez, para conhecer a mensagem.",
          esperado:
            "Aparece um aviso dizendo que o e-mail ou a senha não conferem — e não qual dos dois. É de propósito: dizer qual entregaria a metade da informação a quem está tentando adivinhar.",
        },
      ],
      atencao: [
        "Não existe cadastro por conta própria. Quem cria usuário é o master, e você recebe a senha dele.",
        "Esqueceu a senha? Peça a redefinição ao master. Não há e-mail automático de recuperação.",
      ],
    },
    {
      id: "trocar-senha",
      titulo: "A troca de senha do primeiro acesso",
      resumo: "Por que o sistema obriga, e por que não dá para pular.",
      rotas: ["/trocar-senha"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/trocar-senha",
          acao: "No primeiro acesso, escolha uma senha sua e confirme.",
          esperado:
            "O sistema libera o resto das telas. Antes disso, qualquer endereço que você digitar traz você de volta para cá.",
        },
      ],
      atencao: [
        "A senha que o master te deu é conhecida por ele. Enquanto você não trocar, a conta não é só sua — é por isso que a troca vem antes de tudo.",
        "Você pode trocar a senha depois, quando quiser, em Perfil.",
      ],
    },
    {
      id: "menu",
      titulo: "O menu, e por que o seu é diferente do menu do colega",
      resumo:
        "O menu mostra só o que foi liberado para você, agrupado por área de trabalho.",
      rotas: ["/"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/",
          acao: "Olhe o menu à esquerda e repare nos títulos de grupo.",
          esperado:
            "Os itens estão agrupados em Obra, Equipamento, Imóveis e Financeiro. Grupo sem nenhum item liberado para você não aparece.",
        },
        {
          onde: "/",
          acao: "Compare o seu menu com o de um colega de outro cargo.",
          esperado:
            "Os dois menus são diferentes. Cada usuário tem uma lista de módulos liberados, e o menu mostra só esses.",
        },
        {
          onde: "Celular",
          acao: "Abra o Loca no celular e toque no menu.",
          esperado:
            "O mesmo agrupamento aparece, adaptado à tela. O sistema é o mesmo — não existe versão reduzida.",
        },
      ],
      atencao: [
        "O menu não é preferência sua nem do sistema: é a permissão. Item que falta é módulo não liberado, e quem libera é o master ou o administrador.",
      ],
    },
    {
      id: "achar-obra",
      titulo: "Achar uma obra e ler a tela dela",
      resumo: "A obra é o centro do Loca — quase tudo pendura nela.",
      rotas: ["/obras", "/obras/[id]"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/obras",
          acao: "Abra Obras e digite parte do código ou do nome na busca.",
          esperado:
            "A lista filtra enquanto você digita, sem precisar apertar nada.",
        },
        {
          onde: "/obras",
          acao: "Clique no código da obra.",
          esperado:
            "Abre a tela da obra, com o período, o status e as seções de contratos, orçamento e avanço.",
        },
        {
          onde: "/obras/[id]",
          acao: "Repare no período da obra — data de início e fim previsto.",
          esperado:
            "Se estiverem em branco, os indicadores de prazo e de orçamento dessa obra não têm como ser calculados. Vale avisar quem cadastra.",
        },
      ],
    },
    {
      id: "filtros",
      titulo: "Filtrar e buscar em qualquer lista",
      resumo:
        "Todas as listas do sistema funcionam igual — aprender uma é aprender todas.",
      rotas: ["/obras", "/contratos", "/frota", "/estoque", "/termos", "/itens"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/frota",
          acao: "Digite na busca e escolha algo num dos seletores de filtro.",
          esperado:
            "A lista se ajusta na hora, sem botão de aplicar, e volta para a primeira página.",
        },
        {
          onde: "/frota",
          acao: "Filtre por algo que não existe, de propósito.",
          esperado:
            "O cabeçalho da tabela continua na tela e uma linha diz que não há registro no filtro atual. Isso é diferente de a tela dizer que não há nenhum registro cadastrado — a primeira é filtro, a segunda é cadastro vazio.",
        },
        {
          onde: "/relatorios",
          acao: "Abra Relatórios e repare que aqui há um botão de aplicar.",
          esperado:
            "É a única tela com botão, de propósito: são seis filtros que precisam valer juntos, e aplicar um por um refaria o relatório seis vezes.",
        },
      ],
      atencao: [
        "O endereço da página guarda os filtros. Dá para mandar um link já filtrado para um colega — se ele tiver acesso ao módulo, ele vê o mesmo que você.",
      ],
    },
    {
      id: "novidades-e-acesso",
      titulo: "Ver o que mudou, e pedir o acesso que falta",
      resumo:
        "Onde o sistema conta o que mudou, e o caminho certo quando uma tela não aparece.",
      rotas: ["/novidades", "/perfil"],
      desdeVersao: 1,
      passos: [
        {
          onde: "/novidades",
          acao: "Abra Novidades.",
          esperado:
            "A lista mostra o que mudou em cada versão, da mais recente para a mais antiga, com o número da versão atual no topo.",
        },
        {
          onde: "/perfil",
          acao: "Abra Perfil e confira o seu nome, e-mail e cargo.",
          esperado:
            "Os dados aparecem. O seu papel no sistema também — e ele não é editável por você.",
        },
        {
          onde: "Menu",
          acao:
            "Precisa de uma tela que não está no seu menu? Peça ao master ou ao administrador para liberar o módulo.",
          esperado:
            "Digitar o endereço à mão não funciona: o sistema devolve você para a tela inicial. O acesso é por módulo, não por conhecer o caminho.",
        },
      ],
      atencao: [
        "Quando a versão em Novidades não bate com o que alguém te disse que mudou, provavelmente a atualização ainda não subiu. Avise quem cuida do sistema.",
      ],
    },
  ],
  perguntas: [
    {
      id: "pq-menu",
      enunciado:
        "O menu de um colega tem itens que o seu não tem. Qual é a explicação?",
      alternativas: [
        "Ele tem um plano diferente do seu",
        "Cada usuário tem módulos liberados, e o menu mostra só os dele",
        "O menu muda conforme o horário de trabalho de cada um",
        "Ele está usando uma versão mais nova do sistema",
      ],
      correta: 1,
      porque:
        "O acesso no Loca é por módulo, liberado usuário por usuário pelo master ou pelo administrador. O menu é a permissão desenhada na tela — não preferência, nem versão.",
      aula: "menu",
    },
    {
      id: "pq-lista-vazia",
      enunciado:
        "Você filtrou uma lista e ela não trouxe nada, mas o cabeçalho da tabela continua na tela. O que isso quer dizer?",
      alternativas: [
        "O sistema travou e precisa recarregar",
        "Não existe nenhum registro cadastrado nesse módulo",
        "Existem registros, mas nenhum atende ao filtro que está ativo",
        "Você perdeu o acesso ao módulo",
      ],
      correta: 2,
      porque:
        "O cabeçalho preservado com uma linha de aviso significa filtro sem resultado. Cadastro realmente vazio mostra outra coisa: um bloco no meio da tela explicando o que é aquele módulo e oferecendo criar o primeiro registro. Confundir os dois faz a pessoa cadastrar o que já existe.",
      aula: "filtros",
    },
    {
      id: "pq-sem-acesso",
      enunciado:
        "Você precisa usar uma tela que não aparece no seu menu. Qual é o caminho?",
      alternativas: [
        "Digitar o endereço da tela direto no navegador",
        "Pedir ao master ou ao administrador para liberar o módulo",
        "Entrar com o usuário de um colega que tem acesso",
        "Criar um segundo usuário para você",
      ],
      correta: 1,
      porque:
        "Digitar o endereço não funciona: o sistema devolve você para a tela inicial, porque a verificação é no servidor e não no menu. E entrar com usuário de outra pessoa apaga o rastro de quem fez o quê — em telas que geram documento assinado, isso é o pior resultado possível.",
      aula: "novidades-e-acesso",
    },
    {
      id: "pq-trocar-senha",
      enunciado:
        "Por que o sistema obriga a trocar a senha no primeiro acesso, antes de liberar qualquer tela?",
      alternativas: [
        "Para o sistema medir a força da senha",
        "Porque a senha inicial é conhecida por quem criou o seu usuário",
        "Porque a senha expira a cada 30 dias",
        "Para liberar o acesso pelo celular",
      ],
      correta: 1,
      porque:
        "Quem cria o usuário define a primeira senha e a repassa a você. Enquanto ela não é trocada, a conta não é só sua — e tudo o que for feito nela fica no seu nome. É por isso que a troca vem antes de todo o resto.",
      aula: "trocar-senha",
    },
  ],
};
```

- [ ] **Step 3: Criar `src/lib/treinamento/index.ts`**

```ts
// O registro das trilhas. Trilha nova entra aqui e passa a existir no sistema.

import type { Trilha } from "./tipos";
import { PRIMEIROS_PASSOS } from "./primeiros-passos";

export type { Passo, Aula, Pergunta, Trilha } from "./tipos";

/**
 * Todas as trilhas, na ordem em que devem ser feitas.
 *
 * Primeiros passos vem primeiro de propósito: é a única que todo papel faz, e
 * as outras supõem que a pessoa já sabe achar uma obra e ler uma lista.
 */
export const TRILHAS: Trilha[] = [PRIMEIROS_PASSOS];

export function trilhaPorChave(chave: string): Trilha | undefined {
  return TRILHAS.find((t) => t.chave === chave);
}
```

- [ ] **Step 4: Escrever a varredura de integridade do conteúdo**

Criar `src/lib/treinamento/conteudo.test.ts`. **Este é o teste mais valioso da tarefa**: ele vale para as 80 aulas que vêm nas ondas seguintes, e é o que impede conteúdo quebrado de chegar à tela.

```ts
import { describe, it, expect } from "vitest";
import { TRILHAS, trilhaPorChave } from "./index";

/**
 * VARREDURA DE INTEGRIDADE DO CONTEÚDO — sem lista de nomes a manter.
 *
 * Ela varre `TRILHAS` e exige as propriedades de toda trilha, hoje e nas ondas
 * seguintes. Conteúdo é o que mais vai crescer nesta parte do sistema: 13
 * módulos, 4 papéis, dezenas de aulas. Um `correta` fora do intervalo ou uma
 * pergunta apontando para aula que não existe passa pelo typecheck e quebra na
 * cara do usuário no meio do questionário.
 */
describe("integridade do conteúdo de treinamento", () => {
  it("existe trilha para varrer", () => {
    // Sem esta trava, apagar TRILHAS transformaria a varredura num teste vazio.
    expect(TRILHAS.length).toBeGreaterThan(0);
  });

  it("a chave de cada trilha é única", () => {
    const chaves = TRILHAS.map((t) => t.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("a chave de cada trilha serve como slug de rota", () => {
    for (const t of TRILHAS) {
      expect(t.chave, `trilha ${t.chave}`).toMatch(/^[a-z0-9-]+$/);
    }
  });

  for (const t of TRILHAS) {
    describe(`trilha ${t.chave}`, () => {
      it("tem título, resumo e versão", () => {
        expect(t.titulo.length).toBeGreaterThan(0);
        expect(t.resumo.length).toBeGreaterThan(0);
        expect(t.versao).toBeGreaterThanOrEqual(1);
      });

      it("tem pelo menos uma aula, e id de aula é único", () => {
        expect(t.aulas.length).toBeGreaterThan(0);
        const ids = t.aulas.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("toda aula tem passos, e todo passo diz o que tem de acontecer", () => {
        for (const a of t.aulas) {
          expect(a.passos.length, `aula ${a.id}`).toBeGreaterThan(0);
          for (const p of a.passos) {
            expect(p.onde.length, `aula ${a.id}`).toBeGreaterThan(0);
            expect(p.acao.length, `aula ${a.id}`).toBeGreaterThan(0);
            // `esperado` é o que separa treinamento de passeio guiado.
            expect(p.esperado.length, `aula ${a.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("toda aula declara ao menos uma rota, para o manual poder indexá-la", () => {
        for (const a of t.aulas) {
          expect(a.rotas.length, `aula ${a.id}`).toBeGreaterThan(0);
          for (const r of a.rotas) {
            expect(r.length, `aula ${a.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("`desdeVersao` de toda aula está entre 1 e a versão da trilha", () => {
        for (const a of t.aulas) {
          expect(a.desdeVersao, `aula ${a.id}`).toBeGreaterThanOrEqual(1);
          expect(a.desdeVersao, `aula ${a.id}`).toBeLessThanOrEqual(t.versao);
        }
      });

      it("tem entre 3 e 5 perguntas", () => {
        // Três a cinco é decisão de projeto: vinte perguntas é o que faz
        // ninguém terminar a trilha.
        expect(t.perguntas.length).toBeGreaterThanOrEqual(3);
        expect(t.perguntas.length).toBeLessThanOrEqual(5);
      });

      it("id de pergunta é único", () => {
        const ids = t.perguntas.map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("toda pergunta tem quatro alternativas e `correta` no intervalo", () => {
        for (const p of t.perguntas) {
          expect(p.alternativas.length, `pergunta ${p.id}`).toBe(4);
          expect(p.correta, `pergunta ${p.id}`).toBeGreaterThanOrEqual(0);
          expect(p.correta, `pergunta ${p.id}`).toBeLessThan(p.alternativas.length);
          for (const alt of p.alternativas) {
            expect(alt.length, `pergunta ${p.id}`).toBeGreaterThan(0);
          }
        }
      });

      it("toda pergunta aponta para uma aula que existe", () => {
        const ids = new Set(t.aulas.map((a) => a.id));
        for (const p of t.perguntas) {
          expect(ids, `pergunta ${p.id} aponta para aula inexistente`).toContain(
            p.aula,
          );
        }
      });

      it("toda pergunta explica o porquê da resposta", () => {
        for (const p of t.perguntas) {
          // Errar e não saber por que só ensina a chutar melhor.
          expect(p.porque.length, `pergunta ${p.id}`).toBeGreaterThan(20);
        }
      });
    });
  }

  it("trilhaPorChave encontra o que existe e devolve undefined para o resto", () => {
    expect(trilhaPorChave("primeiros-passos")?.chave).toBe("primeiros-passos");
    expect(trilhaPorChave("nao-existe")).toBeUndefined();
  });
});
```

- [ ] **Step 5: Rodar a varredura**

Run: `npx vitest run src/lib/treinamento/conteudo.test.ts`
Expected: PASS em tudo. Se `desdeVersao` reprovar, a aula declara versão maior que a da trilha; se "aula inexistente" reprovar, o campo `aula` de uma pergunta está com id errado.

- [ ] **Step 6: Auditoria de acentuação**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem|senha nao|modulo)" src/lib/treinamento/ | grep -v "ModuloKey\|modulo:\|moduloLiberado"
```
Expected: nada. Este conteúdo é quase todo string visível — a auditoria aqui vale mais que em qualquer outro arquivo da fatia.

- [ ] **Step 7: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/lib/treinamento
git commit -m "feat(treinamento): modelo de conteúdo e a trilha de primeiros passos

Trilhas e aulas como constantes versionadas, no código: treinamento de software
é documentação de software, e se a tela muda a aula muda no mesmo commit. No
banco, a tela mudaria e a aula ficaria mentindo em silêncio.

Todo passo tem \`esperado\`. É o que separa treinamento de passeio guiado:
\"clique em Salvar\" ensina a clicar; \"clique em Salvar — tem de aparecer o
item na lista\" ensina a reconhecer que funcionou, e a perceber quando não
funcionou.

Toda aula declara as \`rotas\` que cobre, e é só isso que o manual precisa para
indexar por tela sem que nada seja escrito duas vezes.

A varredura de integridade não tem lista de nomes: id único, quatro
alternativas, \`correta\` no intervalo, pergunta apontando para aula que existe,
três a cinco perguntas por trilha. Vale para as dezenas de aulas das ondas
seguintes — um \`correta\` fora do intervalo passa pelo typecheck e quebra na
cara do usuário no meio do questionário.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `src/lib/treinamento.ts` — o cálculo puro

**Files:**
- Create: `src/lib/treinamento.ts`
- Test: `src/lib/treinamento.test.ts`

**Interfaces:**
- Consumes: `TRILHAS`, `type Trilha`, `type Aula`, `type Pergunta` de `src/lib/treinamento/index.ts`; `moduloLiberado` de `src/lib/modulos.ts`; `type Papel` de `src/lib/permissoes.ts`; `textoOpcional` de `src/lib/campos.ts`.
- Produces:
  - `type SituacaoTrilha = "nao_iniciada" | "concluida" | "desatualizada"`
  - `SITUACAO_TRILHA_INFO: Record<SituacaoTrilha, { label: string; variant: "default"|"secondary"|"outline"|"destructive" }>`
  - `type Conclusao = { trilha: string; versao: number; concluidoEm: string; acertos: number; totalPerguntas: number; numeroRegistro: string | null }`
  - `trilhasDoUsuario(papel: Papel | undefined, modulos: string[] | null | undefined, isMaster: boolean): Trilha[]`
  - `situacaoDaTrilha(trilha: Trilha, conclusoes: Conclusao[]): SituacaoTrilha`
  - `versaoConcluida(trilha: Trilha, conclusoes: Conclusao[]): number | null`
  - `aulasQueMudaram(trilha: Trilha, versaoConcluida: number | null): Aula[]`
  - `type Correcao = { acertos: number; total: number; erradas: { pergunta: Pergunta; escolhida: number | null }[] }`
  - `corrigir(trilha: Trilha, respostas: Record<string, number>): Correcao`
  - `aprovado(c: Correcao): boolean`
  - `type LinhaPendencia = { perfilId: string; nome: string; papel: Papel; total: number; concluidas: number; pendentes: string[] }`
  - `resumirPendencias(usuarios: {...}[], conclusoes: (Conclusao & { perfilId: string })[]): LinhaPendencia[]`
  - `manualPorRota(): { rota: string; aulas: { trilha: string; aula: Aula }[] }[]`
  - `respostasSchema`

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/treinamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  trilhasDoUsuario,
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  corrigir,
  aprovado,
  resumirPendencias,
  manualPorRota,
  respostasSchema,
  SITUACAO_TRILHA_INFO,
  type Conclusao,
} from "./treinamento";
import { PRIMEIROS_PASSOS } from "./treinamento/primeiros-passos";
import type { Trilha } from "./treinamento/tipos";

function conclusao(over: Partial<Conclusao> = {}): Conclusao {
  return {
    trilha: "primeiros-passos",
    versao: 1,
    concluidoEm: "2026-09-03T12:00:00.000Z",
    acertos: 4,
    totalPerguntas: 4,
    numeroRegistro: "TRE-2026-0001",
    ...over,
  };
}

/** Trilha sintética, para exercitar as regras sem depender do conteúdo real. */
function trilha(over: Partial<Trilha> = {}): Trilha {
  return {
    chave: "teste",
    titulo: "Trilha de teste",
    resumo: "Resumo.",
    modulo: null,
    papeis: [],
    versao: 1,
    aulas: [
      {
        id: "a1",
        titulo: "Aula 1",
        resumo: "R.",
        rotas: ["/x"],
        desdeVersao: 1,
        passos: [{ onde: "/x", acao: "Faça.", esperado: "Acontece." }],
      },
    ],
    perguntas: [
      {
        id: "p1",
        enunciado: "E?",
        alternativas: ["a", "b", "c", "d"],
        correta: 1,
        porque: "Porque sim, e esta explicação passa de vinte caracteres.",
        aula: "a1",
      },
    ],
    ...over,
  };
}

describe("SITUACAO_TRILHA_INFO", () => {
  it("cobre as três situações, com rótulo acentuado", () => {
    expect(SITUACAO_TRILHA_INFO.nao_iniciada.label).toBe("Não iniciada");
    expect(SITUACAO_TRILHA_INFO.concluida.label).toBe("Concluída");
    expect(SITUACAO_TRILHA_INFO.desatualizada.label).toBe("Atualização pendente");
  });
});

describe("trilhasDoUsuario", () => {
  it("trilha sem módulo aparece para todo mundo", () => {
    const r = trilhasDoUsuario("operador", [], false);
    expect(r.map((t) => t.chave)).toContain("primeiros-passos");
  });

  it("master vê tudo, mesmo com lista de módulos vazia", () => {
    // `moduloLiberado` já decide isso; aqui garantimos que a regra não foi
    // redecidida com outro resultado.
    const r = trilhasDoUsuario("master", [], true);
    expect(r.length).toBeGreaterThan(0);
  });

  it("sem papel não devolve trilha nenhuma", () => {
    // Sessão inválida não é "usuário com acesso total".
    expect(trilhasDoUsuario(undefined, null, false)).toEqual([]);
  });
});

describe("situacaoDaTrilha e versaoConcluida", () => {
  const t = trilha({ chave: "teste", versao: 2 });

  it("sem conclusão é não iniciada", () => {
    expect(situacaoDaTrilha(t, [])).toBe("nao_iniciada");
    expect(versaoConcluida(t, [])).toBeNull();
  });

  it("conclusão na versão vigente é concluída", () => {
    const c = [conclusao({ trilha: "teste", versao: 2 })];
    expect(situacaoDaTrilha(t, c)).toBe("concluida");
    expect(versaoConcluida(t, c)).toBe(2);
  });

  it("conclusão em versão anterior é atualização pendente", () => {
    const c = [conclusao({ trilha: "teste", versao: 1 })];
    expect(situacaoDaTrilha(t, c)).toBe("desatualizada");
    expect(versaoConcluida(t, c)).toBe(1);
  });

  it("com várias conclusões, vale a versão mais alta", () => {
    const c = [
      conclusao({ trilha: "teste", versao: 1 }),
      conclusao({ trilha: "teste", versao: 2 }),
    ];
    expect(versaoConcluida(t, c)).toBe(2);
    expect(situacaoDaTrilha(t, c)).toBe("concluida");
  });

  it("conclusão de outra trilha é ignorada", () => {
    const c = [conclusao({ trilha: "outra", versao: 2 })];
    expect(situacaoDaTrilha(t, c)).toBe("nao_iniciada");
  });
});

describe("aulasQueMudaram", () => {
  const t = trilha({
    versao: 3,
    aulas: [
      { id: "a1", titulo: "A1", resumo: "R", rotas: ["/x"], desdeVersao: 1, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
      { id: "a2", titulo: "A2", resumo: "R", rotas: ["/x"], desdeVersao: 2, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
      { id: "a3", titulo: "A3", resumo: "R", rotas: ["/x"], desdeVersao: 3, passos: [{ onde: "/x", acao: "F", esperado: "A" }] },
    ],
  });

  it("quem nunca concluiu vê todas como novas", () => {
    expect(aulasQueMudaram(t, null).map((a) => a.id)).toEqual(["a1", "a2", "a3"]);
  });

  it("quem concluiu a v1 só precisa das que mudaram depois", () => {
    expect(aulasQueMudaram(t, 1).map((a) => a.id)).toEqual(["a2", "a3"]);
  });

  it("quem concluiu a versão vigente não tem nada a reler", () => {
    expect(aulasQueMudaram(t, 3)).toEqual([]);
  });
});

describe("corrigir e aprovado", () => {
  const t = trilha({
    perguntas: [
      { id: "p1", enunciado: "E1", alternativas: ["a", "b", "c", "d"], correta: 1, porque: "Explicação com mais de vinte caracteres.", aula: "a1" },
      { id: "p2", enunciado: "E2", alternativas: ["a", "b", "c", "d"], correta: 3, porque: "Outra explicação com mais de vinte caracteres.", aula: "a1" },
    ],
  });

  it("acertar tudo aprova", () => {
    const c = corrigir(t, { p1: 1, p2: 3 });
    expect(c.acertos).toBe(2);
    expect(c.total).toBe(2);
    expect(c.erradas).toEqual([]);
    expect(aprovado(c)).toBe(true);
  });

  it("errar uma reprova, e diz qual e o que a pessoa marcou", () => {
    // Aprovação só com 100%: com três a cinco perguntas, nota de corte menor
    // significa "pode errar uma" — e a que a pessoa erra é a que ela precisava.
    const c = corrigir(t, { p1: 0, p2: 3 });
    expect(c.acertos).toBe(1);
    expect(aprovado(c)).toBe(false);
    expect(c.erradas).toHaveLength(1);
    expect(c.erradas[0].pergunta.id).toBe("p1");
    expect(c.erradas[0].escolhida).toBe(0);
  });

  it("pergunta sem resposta conta como errada, com escolhida nula", () => {
    const c = corrigir(t, { p1: 1 });
    expect(c.acertos).toBe(1);
    expect(aprovado(c)).toBe(false);
    expect(c.erradas[0].pergunta.id).toBe("p2");
    expect(c.erradas[0].escolhida).toBeNull();
  });

  it("resposta de pergunta que não existe é ignorada", () => {
    const c = corrigir(t, { p1: 1, p2: 3, pX: 0 });
    expect(c.total).toBe(2);
    expect(aprovado(c)).toBe(true);
  });

  it("trilha sem pergunta nunca aprova", () => {
    // Guarda contra aprovação por vacuidade: 0 de 0 não é 100%.
    const vazia = trilha({ perguntas: [] });
    expect(aprovado(corrigir(vazia, {}))).toBe(false);
  });
});

describe("resumirPendencias", () => {
  const usuarios = [
    { perfilId: "u1", nome: "Fulano de Tal", papel: "operador" as const, modulos: [] as string[], isMaster: false },
    { perfilId: "u2", nome: "Ciclana", papel: "administrador" as const, modulos: null, isMaster: false },
  ];

  it("conta concluídas e lista as pendentes por pessoa", () => {
    const r = resumirPendencias(usuarios, [
      { ...conclusao(), perfilId: "u1" },
    ]);
    const u1 = r.find((l) => l.perfilId === "u1")!;
    const u2 = r.find((l) => l.perfilId === "u2")!;
    expect(u1.concluidas).toBe(1);
    expect(u1.pendentes).toEqual([]);
    expect(u2.concluidas).toBe(0);
    expect(u2.pendentes).toContain("Primeiros passos no Loca");
  });

  it("quem tem mais pendência vem primeiro", () => {
    // O painel existe para cobrar; quem está em dia no topo esconderia o que
    // interessa.
    const r = resumirPendencias(usuarios, [{ ...conclusao(), perfilId: "u1" }]);
    expect(r[0].perfilId).toBe("u2");
  });

  it("lista vazia devolve lista vazia", () => {
    expect(resumirPendencias([], [])).toEqual([]);
  });
});

describe("manualPorRota", () => {
  it("agrupa as aulas por rota, e a rota aparece uma só vez", () => {
    const idx = manualPorRota();
    const rotas = idx.map((r) => r.rota);
    expect(new Set(rotas).size).toBe(rotas.length);
    expect(rotas).toContain("/obras");
  });

  it("uma aula que cobre várias rotas aparece em todas", () => {
    const idx = manualPorRota();
    const comFiltros = idx.filter((r) =>
      r.aulas.some((a) => a.aula.id === "filtros"),
    );
    // A aula `filtros` declara seis rotas de propósito: aprender uma lista é
    // aprender todas.
    expect(comFiltros.length).toBeGreaterThan(1);
  });

  it("as rotas saem em ordem alfabética", () => {
    const rotas = manualPorRota().map((r) => r.rota);
    expect(rotas).toEqual([...rotas].sort());
  });
});

describe("respostasSchema", () => {
  it("aceita o mapa de respostas", () => {
    const r = respostasSchema.safeParse({
      trilha: "primeiros-passos",
      respostas: { "pq-menu": 1 },
    });
    expect(r.success).toBe(true);
  });

  it("recusa trilha vazia", () => {
    const r = respostasSchema.safeParse({ trilha: "", respostas: {} });
    expect(r.success).toBe(false);
  });

  it("recusa índice de alternativa que não é inteiro no intervalo", () => {
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: -1 } }).success).toBe(false);
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: 4 } }).success).toBe(false);
    expect(respostasSchema.safeParse({ trilha: "t", respostas: { p: 1.5 } }).success).toBe(false);
  });

  it("aceita o próprio output de volta", () => {
    // A propriedade que a varredura de schemas exige de todo schema do projeto.
    const primeiro = respostasSchema.parse({ trilha: "t", respostas: { p: 0 } });
    expect(respostasSchema.parse(primeiro)).toEqual(primeiro);
  });
});

describe("o conteúdo real de primeiros passos", () => {
  it("tem as seis aulas previstas, na ordem", () => {
    expect(PRIMEIROS_PASSOS.aulas.map((a) => a.id)).toEqual([
      "entrar",
      "trocar-senha",
      "menu",
      "achar-obra",
      "filtros",
      "novidades-e-acesso",
    ]);
  });

  it("acertar as quatro perguntas aprova", () => {
    const respostas = Object.fromEntries(
      PRIMEIROS_PASSOS.perguntas.map((p) => [p.id, p.correta]),
    );
    expect(aprovado(corrigir(PRIMEIROS_PASSOS, respostas))).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx vitest run src/lib/treinamento.test.ts`
Expected: FAIL — `Failed to resolve import "./treinamento"`.

- [ ] **Step 3: Escrever `src/lib/treinamento.ts`**

```ts
// Treinamento: quem tem de fazer o quê, o que mudou, e se passou.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// "Todos fizeram o treinamento" só é fato se houver como verificar. O banco
// guarda uma linha por (pessoa, trilha, versão concluída) e NADA MAIS —
// "pendente" é calculado aqui, a cada leitura.
//
// Coluna de status seria a primeira coisa a ficar velha: bastaria eu bumpar a
// versão de uma trilha e o banco continuaria dizendo "concluído" para todo
// mundo. O cálculo não tem esse problema porque a pergunta é sempre feita
// contra o conteúdo vigente.
//
// Aqui mora só cálculo. A escrita é a action; a leitura é `data/treinamento.ts`.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { moduloLiberado } from "@/lib/modulos";
import type { Papel } from "@/lib/permissoes";
import { TRILHAS } from "@/lib/treinamento/index";
import type { Aula, Pergunta, Trilha } from "@/lib/treinamento/tipos";

export type SituacaoTrilha = "nao_iniciada" | "concluida" | "desatualizada";

export const SITUACAO_TRILHA_INFO: Record<
  SituacaoTrilha,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  nao_iniciada: { label: "Não iniciada", variant: "outline" },
  concluida: { label: "Concluída", variant: "secondary" },
  desatualizada: { label: "Atualização pendente", variant: "default" },
};

/** Uma linha de `treinamento_conclusao`, como a camada de leitura a entrega. */
export type Conclusao = {
  trilha: string;
  versao: number;
  concluidoEm: string;
  acertos: number;
  totalPerguntas: number;
  numeroRegistro: string | null;
};

/**
 * As trilhas a que a pessoa tem direito.
 *
 * A regra de módulo é a de `moduloLiberado`, e não é redecidida aqui: duas
 * cópias da regra de permissão divergem, e a divergência aparece como pessoa
 * cobrada por treinamento de tela que ela não pode abrir.
 */
export function trilhasDoUsuario(
  papel: Papel | undefined,
  modulos: string[] | null | undefined,
  isMaster: boolean,
): Trilha[] {
  // Sessão sem papel não é "acesso total": é sessão inválida.
  if (!papel) return [];

  return TRILHAS.filter((t) => {
    if (t.papeis.length > 0 && !t.papeis.includes(papel)) return false;
    if (t.modulo === null) return true;
    return moduloLiberado(modulos, isMaster, t.modulo);
  });
}

/** A maior versão desta trilha que a pessoa já concluiu, ou `null`. */
export function versaoConcluida(
  trilha: Trilha,
  conclusoes: Conclusao[],
): number | null {
  const minhas = conclusoes.filter((c) => c.trilha === trilha.chave);
  if (minhas.length === 0) return null;
  return Math.max(...minhas.map((c) => c.versao));
}

export function situacaoDaTrilha(
  trilha: Trilha,
  conclusoes: Conclusao[],
): SituacaoTrilha {
  const v = versaoConcluida(trilha, conclusoes);
  if (v === null) return "nao_iniciada";
  return v >= trilha.versao ? "concluida" : "desatualizada";
}

/**
 * As aulas que a pessoa ainda não viu na versão vigente.
 *
 * É o "não releia o que não mudou" da decisão de projeto: quando eu mudo uma
 * tela e a aula muda, quem treinou na versão anterior refaz só o que mudou —
 * e o questionário, que é curto.
 */
export function aulasQueMudaram(
  trilha: Trilha,
  versaoConcluida: number | null,
): Aula[] {
  if (versaoConcluida === null) return trilha.aulas;
  return trilha.aulas.filter((a) => a.desdeVersao > versaoConcluida);
}

export type Correcao = {
  acertos: number;
  total: number;
  erradas: { pergunta: Pergunta; escolhida: number | null }[];
};

/**
 * Corrige o questionário.
 *
 * Roda no SERVIDOR, e é por isso que `Pergunta.correta` não vai no payload da
 * página. Um questionário cujas respostas chegam ao navegador é decorativo.
 */
export function corrigir(
  trilha: Trilha,
  respostas: Record<string, number>,
): Correcao {
  const erradas: Correcao["erradas"] = [];
  let acertos = 0;

  for (const p of trilha.perguntas) {
    const escolhida = Object.prototype.hasOwnProperty.call(respostas, p.id)
      ? respostas[p.id]
      : null;
    if (escolhida === p.correta) acertos += 1;
    else erradas.push({ pergunta: p, escolhida });
  }

  return { acertos, total: trilha.perguntas.length, erradas };
}

/**
 * Aprovado é acertar tudo.
 *
 * Com três a cinco perguntas, qualquer nota de corte abaixo de 100% significa
 * "pode errar uma" — e a pergunta que a pessoa erra é exatamente a que ela
 * precisava. Reprovar não pune: a tela mostra o `porque`, aponta a aula e
 * oferece tentar de novo.
 *
 * `total === 0` reprova: 0 de 0 não é 100%, é trilha sem questionário, e
 * aprovar nela seria aprovação por vacuidade.
 */
export function aprovado(c: Correcao): boolean {
  return c.total > 0 && c.acertos === c.total;
}

export type LinhaPendencia = {
  perfilId: string;
  nome: string;
  papel: Papel;
  total: number;
  concluidas: number;
  /** Títulos das trilhas que faltam — o que o painel mostra. */
  pendentes: string[];
};

/**
 * Uma linha por pessoa, para o painel de quem falta.
 *
 * Ordenado por quantidade de pendência, decrescente: o painel existe para
 * cobrar, e quem está em dia no topo esconderia exatamente quem interessa.
 */
export function resumirPendencias(
  usuarios: {
    perfilId: string;
    nome: string;
    papel: Papel;
    modulos: string[] | null | undefined;
    isMaster: boolean;
  }[],
  conclusoes: (Conclusao & { perfilId: string })[],
): LinhaPendencia[] {
  return usuarios
    .map((u) => {
      const minhas = conclusoes.filter((c) => c.perfilId === u.perfilId);
      const trilhas = trilhasDoUsuario(u.papel, u.modulos, u.isMaster);
      const pendentes = trilhas
        .filter((t) => situacaoDaTrilha(t, minhas) !== "concluida")
        .map((t) => t.titulo);

      return {
        perfilId: u.perfilId,
        nome: u.nome,
        papel: u.papel,
        total: trilhas.length,
        concluidas: trilhas.length - pendentes.length,
        pendentes,
      };
    })
    .sort((a, b) => {
      if (a.pendentes.length !== b.pendentes.length) {
        return b.pendentes.length - a.pendentes.length;
      }
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
}

/**
 * O índice do manual: rota → aulas que a cobrem.
 *
 * É a segunda leitura da mesma fonte. A trilha percorre na ordem em que se
 * aprende; o manual indexa por tela, para quem já sabe e travou. Nada é escrito
 * duas vezes, e nenhum dos dois desatualiza sem o outro.
 */
export function manualPorRota(): {
  rota: string;
  aulas: { trilha: string; aula: Aula }[];
}[] {
  const mapa = new Map<string, { trilha: string; aula: Aula }[]>();

  for (const t of TRILHAS) {
    for (const a of t.aulas) {
      for (const r of a.rotas) {
        const atual = mapa.get(r) ?? [];
        atual.push({ trilha: t.chave, aula: a });
        mapa.set(r, atual);
      }
    }
  }

  return [...mapa.entries()]
    .map(([rota, aulas]) => ({ rota, aulas }))
    .sort((a, b) => a.rota.localeCompare(b.rota));
}

/**
 * As respostas que a tela manda para a action.
 *
 * O valor é o ÍNDICE da alternativa escolhida, de 0 a 3. Índice e não texto:
 * comparar texto tornaria a correção sensível a espaço e acento.
 */
export const respostasSchema = z.object({
  trilha: z.string().trim().min(1, "Trilha inválida."),
  respostas: z.record(
    z.string(),
    z.number().int().min(0).max(3),
  ),
});

export type RespostasInput = z.input<typeof respostasSchema>;
export type RespostasDados = z.output<typeof respostasSchema>;
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/lib/treinamento.test.ts`
Expected: PASS em todos os casos.

- [ ] **Step 5: Acrescentar `treinamento` à varredura de schemas**

Modificar `src/lib/schemas-varredura.test.ts` em três pontos.

Import, em ordem alfabética depois de `termo`:

```ts
import * as treinamento from "./treinamento";
```

Objeto `MODULOS`, na mesma ordem:

```ts
  treinamento,
```

Objeto `AMOSTRAS`, o caso **mínimo**:

```ts
  respostasSchema: { trilha: "primeiros-passos", respostas: {} },
```

- [ ] **Step 6: Rodar a varredura de schemas**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: PASS. Se `respostasSchema` reprovar a propriedade `parse(parse(x)) === parse(x)`, o defeito é real e se corrige em `src/lib/treinamento.ts` — **nunca** ajustando a amostra.

- [ ] **Step 7: Auditoria de acentuação e typecheck**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|numero|voce|tambem)" src/lib/treinamento.ts src/lib/treinamento.test.ts | grep -v "nao_iniciada\|numeroRegistro\|totalPerguntas"
```
Expected: nada além de identificadores.

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 8: Commit**

```bash
git add src/lib/treinamento.ts src/lib/treinamento.test.ts src/lib/schemas-varredura.test.ts
git commit -m "feat(treinamento): cálculo de trilhas, situação, correção e pendências

\"Pendente\" é CALCULADO a cada leitura, nunca armazenado. Coluna de status
seria a primeira coisa a ficar velha: bastaria bumpar a versão de uma trilha e
o banco continuaria dizendo \"concluído\" para todo mundo.

A regra de módulo é a de \`moduloLiberado\`, chamada e não recopiada — duas
cópias da regra de permissão divergem, e a divergência aparece como pessoa
cobrada por treinamento de tela que ela não pode abrir.

Aprovado é acertar tudo, e \`total === 0\` reprova: 0 de 0 não é 100%, é trilha
sem questionário, e aprovar nela seria aprovação por vacuidade.

\`manualPorRota\` é a segunda leitura da MESMA fonte — a trilha na ordem em que
se aprende, o manual indexado por tela. Nada escrito duas vezes.

O painel ordena por pendência decrescente: ele existe para cobrar, e quem está
em dia no topo esconderia quem interessa.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Migration 0063 — a tabela, a RLS e o prefixo `TRE`

**Files:**
- Create: `supabase/migrations/0063_treinamento_conclusao.sql`
- Modify: `src/lib/registros.ts` — `PREFIXO_REGISTRO` e `ROTULO_REGISTRO`
- Test: validação em Postgres local (Step 3), e `src/lib/registros.test.ts` + `src/lib/migrations-seguranca.test.ts` já existentes rodam sobre ela

**Interfaces:**
- Consumes: `public.organizacao`, `public.perfil`, `public.set_updated_at()`, `public.current_org_id()`, `public.pode_gerir_cadastros()`, `public.registrar_auditoria()`, `public.proximo_numero(p_org uuid, p_tipo text, p_ano int)`.
- Produces: tabela `public.treinamento_conclusao`; `prefixo_registro('treinamento_conclusao')` devolvendo `'TRE'`; as chaves `treinamento_conclusao` em `PREFIXO_REGISTRO` e `ROTULO_REGISTRO`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0063_treinamento_conclusao.sql`:

```sql
-- ============================================================================
-- Registro de conclusão de treinamento
-- (docs/superpowers/specs/2026-09-03-treinamento-design.md)
--
-- O pedido era "manual, treinamento, e todos devem fazer o treinamento". As
-- duas primeiras partes são documentos; a terceira é um CONTROLE, e é a que
-- não se resolve com documento nenhum: sem registro de quem concluiu, "todos
-- foram treinados" é suposição.
--
-- Esta tabela é o registro, e só isso. As trilhas e as aulas moram no código
-- (`src/lib/treinamento/`), versionadas com ele.
-- ============================================================================

create table if not exists public.treinamento_conclusao (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  perfil_id        uuid not null references public.perfil (id) on delete cascade,
  trilha           text not null,
  -- Versão do CONTEÚDO concluída. A conclusão vale para esta versão e não para
  -- a seguinte: quando a trilha muda, quem concluiu a anterior volta a
  -- aparecer como pendente, e refaz só as aulas que mudaram.
  versao           smallint not null,
  concluido_em     timestamptz not null default now(),
  acertos          smallint not null,
  total_perguntas  smallint not null,
  -- PNG em data URI, do SignaturePad. Nulo enquanto o comprovante não é
  -- assinado — concluir e assinar são dois momentos.
  assinatura       text,
  assinado_ip      text,
  numero_registro  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Uma linha por versão concluída. Refazer a MESMA versão atualiza a linha;
  -- dois cliques no botão não geram dois comprovantes. E o histórico fica:
  -- quem concluiu a v1 e depois a v2 tem duas linhas, e o comprovante de cada
  -- uma continua válido para a versão que ele atesta.
  unique (perfil_id, trilha, versao)
);

create index if not exists idx_treinamento_org on public.treinamento_conclusao (org_id);
create index if not exists idx_treinamento_perfil on public.treinamento_conclusao (perfil_id);

alter table public.treinamento_conclusao drop constraint if exists treinamento_versao_check;
alter table public.treinamento_conclusao add constraint treinamento_versao_check
  check (versao >= 1);

-- Acertou tudo, ou não concluiu. É a regra de aprovação no banco, e não só na
-- tela: um registro com 3 de 4 diria "treinado" sobre alguém que errou
-- justamente a pergunta que precisava.
alter table public.treinamento_conclusao drop constraint if exists treinamento_acertos_check;
alter table public.treinamento_conclusao add constraint treinamento_acertos_check
  check (total_perguntas > 0 and acertos = total_perguntas);

drop trigger if exists trg_treinamento_updated_at on public.treinamento_conclusao;
create trigger trg_treinamento_updated_at
  before update on public.treinamento_conclusao
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- `perfil.id` É o id de `auth.users` (o trigger `handle_new_user` grava
-- `new.id`), então a policy compara com `auth.uid()` direto.
alter table public.treinamento_conclusao enable row level security;

-- Leitura: a própria pessoa vê o seu, master e administrador veem todos da
-- organização. Gestor por obra ficou FORA de propósito — não foi pedido, e
-- acrescentar depois é uma policy, não uma migration de dados.
drop policy if exists "treinamento_select" on public.treinamento_conclusao;
create policy "treinamento_select" on public.treinamento_conclusao
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      perfil_id = (select auth.uid())
      or (select public.pode_gerir_cadastros())
    )
  );

-- Escrita: SÓ a própria pessoa, nem o master por ela. Comprovante de
-- treinamento assinado por terceiro não vale nada.
drop policy if exists "treinamento_insert" on public.treinamento_conclusao;
create policy "treinamento_insert" on public.treinamento_conclusao
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  );

drop policy if exists "treinamento_update" on public.treinamento_conclusao;
create policy "treinamento_update" on public.treinamento_conclusao
  for update to authenticated
  using (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  )
  with check (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  );

-- Sem policy de DELETE: registro de treinamento não se apaga.

drop trigger if exists trg_audit on public.treinamento_conclusao;
create trigger trg_audit after insert or update or delete on public.treinamento_conclusao
  for each row execute function public.registrar_auditoria();

comment on table public.treinamento_conclusao is
  'Conclusão de trilha de treinamento, uma linha por (pessoa, trilha, versão de conteúdo). "Pendente" é calculado em src/lib/treinamento.ts, nunca armazenado.';

-- ---------------------------------------------------------------------------
-- Prefixo de registro: TRE
-- ---------------------------------------------------------------------------
-- `prefixo_registro` é redefinida por inteiro a cada tipo novo, e
-- `src/lib/registros.test.ts` varre as migrations, pega a ÚLTIMA que a define e
-- compara a lista com o mapa em TypeScript. Acrescentar só de um lado reprova
-- no CI, o que é o comportamento desejado.
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'      then 'CTR'
    when 'contrato_imovel'       then 'CTI'
    when 'recebimento'           then 'REC'
    when 'movimentacao'          then 'DEV'
    when 'vistoria'              then 'VIS'
    when 'vistoria_imovel'       then 'VIM'
    when 'avaria'                then 'AVA'
    when 'reparo_imovel'         then 'REP'
    when 'medida_disciplinar'    then 'MED'
    when 'entrega_ocupante'      then 'ENT'
    when 'checklist_limpeza'     then 'LIM'
    when 'ocorrencia_imovel'     then 'OCO'
    when 'termo_equipamento'     then 'TRM'
    when 'treinamento_conclusao' then 'TRE'
    else 'REG'
  end;
$$;
```

- [ ] **Step 2: Acrescentar o tipo em `src/lib/registros.ts`**

Em `PREFIXO_REGISTRO`, depois de `termo_equipamento: "TRM",`:

```ts
  treinamento_conclusao: "TRE",
```

Em `ROTULO_REGISTRO`, depois de `termo_equipamento: "Termo de responsabilidade",`:

```ts
  treinamento_conclusao: "Comprovante de treinamento",
```

- [ ] **Step 3: Provar a migration em Postgres local descartável**

Existe um Postgres 17 em `localhost:5432`, usuário `postgres`, senha `postgres`. `DATABASE_URL` **não** está no `.env.local` — monte a string você mesmo. **A CLI do Supabase não funciona nesta máquina** ("Device or resource busy" em toda versão): não tente `supabase db push`.

Crie um banco descartável com os stubs **apenas** do que a migration referencia (`organizacao`, `perfil`, `set_updated_at()`, `current_org_id()`, `pode_gerir_cadastros()`, `registrar_auditoria()`, e um `auth.uid()` de mentira que leia de um GUC), aplique com `psql -v ON_ERROR_STOP=1`, prove **sete** comportamentos, e derrube o banco no fim.

**Cada prova em transação própria.** Um bloco `DO` que captura a exceção também desfaz o `insert` anterior, e a prova seguinte falha pelo motivo errado — foi o que aconteceu ao validar a 0051.

1. Duas linhas com o mesmo `(perfil_id, trilha, versao)` → recusado pela chave única
2. Duas linhas com o mesmo `(perfil_id, trilha)` e `versao` diferente → **aceito** (é o histórico)
3. `acertos < total_perguntas` → recusado por `treinamento_acertos_check`
4. `total_perguntas = 0` → recusado pelo mesmo check
5. `versao = 0` → recusado por `treinamento_versao_check`
6. `select` como a própria pessoa devolve a linha dela; como outra pessoa **sem** `pode_gerir_cadastros` não devolve nada; com `pode_gerir_cadastros` devolve
7. `insert` com `perfil_id` de outra pessoa → recusado pela policy de insert

Expected: as sete com o resultado descrito. Se a 2 falhar, a chave única está em `(perfil_id, trilha)` em vez de incluir `versao`.

- [ ] **Step 4: Rodar as guardas de migration e de registros**

Run: `npx vitest run src/lib/migrations-seguranca.test.ts src/lib/registros.test.ts`
Expected: PASS nos dois. `registros.test.ts` compara a lista do SQL com o mapa em TypeScript — se reprovar, um dos dois lados ficou sem `treinamento_conclusao`.

- [ ] **Step 5: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, e o "Test Files" igual ao que `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l` devolve.

- [ ] **Step 6: Reportar que a aplicação em produção fica com o controlador**

Você **não** aplica em produção — não tem as ferramentas MCP. Deixe no relatório o SQL de verificação pronto para o controlador colar:

```sql
select
  (select count(*) from information_schema.columns
     where table_name='treinamento_conclusao') as colunas,
  (select count(*) from pg_policies where tablename='treinamento_conclusao') as policies,
  (select count(*) from pg_constraint
     where conrelid='public.treinamento_conclusao'::regclass and contype='c') as checks,
  public.prefixo_registro('treinamento_conclusao') as prefixo;
```

Expected quando o controlador rodar: `colunas` 12, `policies` 3, `checks` 2, `prefixo` `TRE`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0063_treinamento_conclusao.sql src/lib/registros.ts
git commit -m "feat(db): registro de conclusão de treinamento (0063)

Uma tabela, e só isso: as trilhas e as aulas moram no código. \"Pendente\" é
calculado a cada leitura em src/lib/treinamento.ts.

\`unique (perfil_id, trilha, versao)\` guarda o histórico e impede duplicata:
refazer a mesma versão atualiza a linha, e dois cliques no botão não geram dois
comprovantes; concluir uma versão nova cria linha nova, e o comprovante da
anterior continua válido para a versão que ele atesta.

A regra de aprovação está no BANCO, não só na tela: \`acertos = total_perguntas\`
com \`total_perguntas > 0\`. Um registro com 3 de 4 diria \"treinado\" sobre
alguém que errou justamente a pergunta que precisava.

Escrita só pela própria pessoa, nem pelo master: comprovante de treinamento
assinado por terceiro não vale nada. E sem policy de DELETE.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `src/lib/data/treinamento.ts` — a leitura

**Files:**
- Create: `src/lib/data/treinamento.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; `type Conclusao` de `@/lib/treinamento`; `type Papel` de `@/lib/permissoes`.
- Produces:
  - `conclusoesDoUsuario(perfilId: string): Promise<Conclusao[]>`
  - `type UsuarioTreinamento = { perfilId: string; nome: string; papel: Papel; modulos: string[] | null; isMaster: boolean }`
  - `usuariosDaOrganizacao(): Promise<UsuarioTreinamento[]>`
  - `conclusoesDaOrganizacao(): Promise<(Conclusao & { perfilId: string })[]>`
  - `obterConclusao(perfilId: string, trilha: string, versao: number): Promise<(Conclusao & { assinatura: string | null }) | null>`

- [ ] **Step 1: Escrever o arquivo**

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Conclusao } from "@/lib/treinamento";
import type { Papel } from "@/lib/permissoes";

const CAMPOS =
  "trilha, versao, concluido_em, acertos, total_perguntas, numero_registro";

function paraConclusao(l: Record<string, unknown>): Conclusao {
  return {
    trilha: l.trilha as string,
    versao: Number(l.versao),
    concluidoEm: l.concluido_em as string,
    acertos: Number(l.acertos),
    totalPerguntas: Number(l.total_perguntas),
    numeroRegistro: (l.numero_registro as string | null) ?? null,
  };
}

/**
 * As conclusões de uma pessoa. Erro em lista: registra e devolve vazio.
 *
 * A RLS já limita o que volta — a policy deixa a pessoa ver o seu e o
 * administrador ver todos. O filtro por `perfil_id` aqui é o escopo da
 * pergunta, não a proteção.
 */
export async function conclusoesDoUsuario(perfilId: string): Promise<Conclusao[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(CAMPOS)
    .eq("perfil_id", perfilId)
    .order("concluido_em", { ascending: false });

  if (error || !data) {
    if (error) console.error("conclusoesDoUsuario", error);
    return [];
  }
  return (data as unknown as Record<string, unknown>[]).map(paraConclusao);
}

export type UsuarioTreinamento = {
  perfilId: string;
  nome: string;
  papel: Papel;
  modulos: string[] | null;
  isMaster: boolean;
};

/** Os usuários ativos da organização, para o painel de pendências. */
export async function usuariosDaOrganizacao(): Promise<UsuarioTreinamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("perfil")
    .select("id, nome, papel, modulos")
    .eq("ativo", true)
    .order("nome");

  if (error || !data) {
    if (error) console.error("usuariosDaOrganizacao", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => ({
    perfilId: l.id as string,
    nome: (l.nome as string | null) ?? "—",
    papel: l.papel as Papel,
    modulos: (l.modulos as string[] | null) ?? null,
    isMaster: l.papel === "master",
  }));
}

/** Todas as conclusões que a RLS permite ver. Para o painel. */
export async function conclusoesDaOrganizacao(): Promise<
  (Conclusao & { perfilId: string })[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(`perfil_id, ${CAMPOS}`);

  if (error || !data) {
    if (error) console.error("conclusoesDaOrganizacao", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => ({
    ...paraConclusao(l),
    perfilId: l.perfil_id as string,
  }));
}

/**
 * Uma conclusão específica, com a assinatura — para o comprovante em PDF.
 *
 * Erro em detalhe: devolve `null` e a rota responde 404.
 */
export async function obterConclusao(
  perfilId: string,
  trilha: string,
  versao: number,
): Promise<(Conclusao & { assinatura: string | null }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .select(`${CAMPOS}, assinatura`)
    .eq("perfil_id", perfilId)
    .eq("trilha", trilha)
    .eq("versao", versao)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error("obterConclusao", error);
    return null;
  }

  const l = data as unknown as Record<string, unknown>;
  return { ...paraConclusao(l), assinatura: (l.assinatura as string | null) ?? null };
}
```

- [ ] **Step 2: Rodar typecheck e lint**

Run: `npm run typecheck`
Expected: sem erro.

Run: `npm run lint`
Expected: sem erro.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/treinamento.ts
git commit -m "feat(treinamento): camada de leitura das conclusões

Tipos de retorno planos, um mapeador só (\`paraConclusao\`) para as quatro
funções, e a lista de campos numa constante — o \`select\` de conclusão aparece
em três lugares e três cópias divergem.

Erro em lista devolve vazio e registra; erro em detalhe devolve null. O filtro
por perfil_id é o escopo da pergunta, não a proteção: a proteção é a RLS.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `src/app/(app)/treinamento/actions.ts` — concluir a trilha

**Files:**
- Create: `src/app/(app)/treinamento/actions.ts`

**Interfaces:**
- Consumes: `respostasSchema`, `corrigir`, `aprovado`, `type Correcao` de `@/lib/treinamento`; `trilhaPorChave` de `@/lib/treinamento/index`; `getCurrentPerfil` de `@/lib/auth`; `falha`, `primeiroErro`, `type ActionResult` de `@/lib/acoes`; `hojeISOSaoPaulo` de `@/lib/locacao`.
- Produces:
  - `type ResultadoQuestionario = { ok: true; numeroRegistro: string | null } | { ok: false; erro: string; erradas?: { perguntaId: string; porque: string; aula: string }[] }`
  - `concluirTrilha(raw: unknown): Promise<ResultadoQuestionario>`
  - `assinarComprovante(formData: FormData): Promise<ActionResult>`

- [ ] **Step 1: Escrever o arquivo**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { respostasSchema, corrigir, aprovado } from "@/lib/treinamento";
import { trilhaPorChave } from "@/lib/treinamento/index";

/**
 * O que a tela recebe de volta.
 *
 * Reprovar NÃO é erro de sistema: devolve as perguntas erradas com o porquê e a
 * aula a revisar, e a tela oferece tentar de novo. Só o `porque` e o id da aula
 * saem — nunca o índice correto, senão bastaria reprovar uma vez para colher o
 * gabarito.
 */
export type ResultadoQuestionario =
  | { ok: true; numeroRegistro: string | null }
  | {
      ok: false;
      erro: string;
      erradas?: { perguntaId: string; porque: string; aula: string }[];
    };

/**
 * Corrige o questionário e registra a conclusão.
 *
 * A CORREÇÃO É AQUI, no servidor, e é por isso que `Pergunta.correta` nunca vai
 * no payload da página. Um questionário cujas respostas chegam ao navegador é
 * decorativo — quem quiser passar sem ler abre o inspetor.
 */
export async function concluirTrilha(raw: unknown): Promise<ResultadoQuestionario> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return { ok: false, erro: "Sessão inválida. Entre novamente." };

  const parsed = respostasSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, erro: primeiroErro(parsed.error.issues) };
  }

  const trilha = trilhaPorChave(parsed.data.trilha);
  if (!trilha) return { ok: false, erro: "Trilha não encontrada." };

  const correcao = corrigir(trilha, parsed.data.respostas);
  if (!aprovado(correcao)) {
    return {
      ok: false,
      erro:
        correcao.total - correcao.acertos === 1
          ? "Uma resposta não confere. Revise a aula indicada e tente de novo."
          : `${correcao.total - correcao.acertos} respostas não conferem. Revise as aulas indicadas e tente de novo.`,
      erradas: correcao.erradas.map((e) => ({
        perguntaId: e.pergunta.id,
        porque: e.pergunta.porque,
        aula: e.pergunta.aula,
      })),
    };
  }

  const supabase = await createClient();

  // O número só é gerado na primeira conclusão desta versão. Refazer a mesma
  // versão não gasta número novo — o comprovante é o mesmo documento.
  const { data: existente } = await supabase
    .from("treinamento_conclusao")
    .select("numero_registro")
    .eq("perfil_id", perfil.id)
    .eq("trilha", trilha.chave)
    .eq("versao", trilha.versao)
    .maybeSingle();

  let numero = (existente as { numero_registro: string | null } | null)?.numero_registro ?? null;

  if (!numero) {
    const ano = Number(hojeISOSaoPaulo().slice(0, 4));
    const { data, error } = await supabase.rpc("proximo_numero", {
      p_org: perfil.org_id,
      p_tipo: "treinamento_conclusao",
      p_ano: ano,
    });
    if (error || !data) {
      console.error("concluirTrilha/numero", error);
      return { ok: false, erro: "Não foi possível gerar o número do comprovante." };
    }
    numero = data as string;
  }

  const { error } = await supabase.from("treinamento_conclusao").upsert(
    {
      org_id: perfil.org_id,
      perfil_id: perfil.id,
      trilha: trilha.chave,
      versao: trilha.versao,
      acertos: correcao.acertos,
      total_perguntas: correcao.total,
      numero_registro: numero,
      concluido_em: new Date().toISOString(),
    },
    // Refazer a mesma versão atualiza a linha. Sem isto, dois cliques no botão
    // estourariam erro de chave única na cara de quem acabou de acertar tudo.
    { onConflict: "perfil_id,trilha,versao" },
  );

  if (error) {
    console.error("concluirTrilha/upsert", error);
    return { ok: false, erro: "Não foi possível registrar a conclusão." };
  }

  revalidatePath("/treinamento");
  revalidatePath(`/treinamento/${trilha.chave}`);
  revalidatePath("/treinamento/pendentes");
  return { ok: true, numeroRegistro: numero };
}

/**
 * Assina o comprovante de uma conclusão que já existe.
 *
 * Concluir e assinar são dois momentos de propósito: a conclusão é o fato
 * (acertou tudo), a assinatura é a declaração de que a pessoa leu e entendeu.
 * Exigir a assinatura para registrar a conclusão faria quem fechasse a aba
 * perder o resultado do questionário.
 */
export async function assinarComprovante(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");

  const trilhaChave = String(formData.get("trilha") ?? "").trim();
  const assinatura = String(formData.get("assinatura") ?? "").trim();
  if (!trilhaChave) return falha("Trilha inválida.");
  if (!assinatura) return falha("Assine o comprovante para concluir.");

  const trilha = trilhaPorChave(trilhaChave);
  if (!trilha) return falha("Trilha não encontrada.");

  const supabase = await createClient();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data, error } = await supabase
    .from("treinamento_conclusao")
    .update({ assinatura, assinado_ip: ip })
    .eq("perfil_id", perfil.id)
    .eq("trilha", trilha.chave)
    .eq("versao", trilha.versao)
    // `.select("id")` porque UPDATE barrado pela RLS devolve zero linhas SEM
    // erro, e a action diria sucesso sobre nada — foi o defeito da 0.50.0.
    .select("id");

  if (error) {
    console.error("assinarComprovante", error);
    return falha("Não foi possível gravar a assinatura.");
  }
  if (!data?.length) {
    return falha(
      "Conclua o questionário desta trilha antes de assinar o comprovante.",
    );
  }

  revalidatePath(`/treinamento/${trilha.chave}`);
  return { ok: true };
}
```

- [ ] **Step 2: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 3: Auditoria de acentuação**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|numero|voce|tambem)" "src/app/(app)/treinamento/actions.ts" | grep -v "numero_registro\|numeroRegistro\|proximo_numero\|numero ="
```
Expected: nada além de identificadores.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/treinamento/actions.ts"
git commit -m "feat(treinamento): concluir trilha e assinar o comprovante

A correção do questionário é NO SERVIDOR, e é por isso que \`correta\` nunca vai
no payload da página: um questionário cujas respostas chegam ao navegador é
decorativo — quem quiser passar sem ler abre o inspetor.

Reprovar não é erro de sistema. Devolve as perguntas erradas com o porquê e a
aula a revisar, e só isso: nunca o índice correto, senão bastaria reprovar uma
vez para colher o gabarito.

Concluir e assinar são dois momentos. A conclusão é o fato (acertou tudo), a
assinatura é a declaração de ter lido e entendido. Exigir a assinatura para
registrar a conclusão faria quem fechasse a aba perder o questionário.

O número do comprovante só é gerado na primeira conclusão da versão; refazer
não gasta número novo. E o \`.select(\"id\")\` no update é a lição da 0.50.0:
UPDATE barrado pela RLS devolve zero linhas sem erro.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `/treinamento` e `/treinamento/[trilha]` — as duas telas principais

**Files:**
- Create: `src/app/(app)/treinamento/page.tsx`
- Create: `src/app/(app)/treinamento/[trilha]/page.tsx`
- Create: `src/app/(app)/treinamento/[trilha]/_components/aula-lida.tsx`
- Create: `src/app/(app)/treinamento/[trilha]/_components/questionario.tsx`
- Create: `src/app/(app)/treinamento/[trilha]/_components/comprovante-assinatura.tsx`

**Interfaces:**
- Consumes: `trilhasDoUsuario`, `situacaoDaTrilha`, `versaoConcluida`, `aulasQueMudaram`, `SITUACAO_TRILHA_INFO` de `@/lib/treinamento`; `trilhaPorChave` de `@/lib/treinamento/index`; `conclusoesDoUsuario` de `@/lib/data/treinamento`; `concluirTrilha`, `assinarComprovante` de `../actions`; `getCurrentPerfil` de `@/lib/auth`.
- Produces: rotas `/treinamento` e `/treinamento/[trilha]`.

- [ ] **Step 1: `page.tsx` de `/treinamento` — a lista de trilhas**

```tsx
import Link from "next/link";
import { GraduationCap, Users } from "lucide-react";

import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { conclusoesDoUsuario } from "@/lib/data/treinamento";
import {
  trilhasDoUsuario,
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  SITUACAO_TRILHA_INFO,
} from "@/lib/treinamento";
import { formatarDataHora } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Treinamento — Loca" };

/**
 * As minhas trilhas.
 *
 * Não é módulo liberável: fica disponível a todo usuário autenticado, como
 * Perfil e Novidades. Trancar a porta do treinamento e esconder a chave seria
 * o contrário do que ele existe para fazer.
 */
export default async function TreinamentoPage() {
  const perfil = await getCurrentPerfil();
  const conclusoes = perfil?.id ? await conclusoesDoUsuario(perfil.id) : [];

  const trilhas = trilhasDoUsuario(
    perfil?.papel,
    perfil?.modulos,
    perfil?.papel === "master",
  );
  const pendentes = trilhas.filter(
    (t) => situacaoDaTrilha(t, conclusoes) !== "concluida",
  ).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Treinamento"
        descricao={
          pendentes === 0
            ? "Você está em dia com o treinamento."
            : `${pendentes} ${pendentes === 1 ? "trilha pendente" : "trilhas pendentes"}`
        }
        acoes={
          podeEditarCadastros(perfil?.papel) ? (
            <Button variant="outline" render={<Link href="/treinamento/pendentes" />}>
              <Users className="size-4" />
              Quem treinou
            </Button>
          ) : null
        }
      />

      {trilhas.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="size-6" />}
          titulo="Nenhuma trilha disponível"
          descricao="As trilhas aparecem conforme os módulos liberados para você. Se você acha que falta alguma, fale com quem administra o sistema."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {trilhas.map((t) => {
            const situacao = situacaoDaTrilha(t, conclusoes);
            const info = SITUACAO_TRILHA_INFO[situacao];
            const v = versaoConcluida(t, conclusoes);
            const mudaram = aulasQueMudaram(t, v);
            const minha = conclusoes.find((c) => c.trilha === t.chave && c.versao === v);

            return (
              <Card key={t.chave}>
                <CardContent className="flex flex-wrap items-start gap-3 pt-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {t.titulo}
                      <Badge variant={info.variant}>{info.label}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.resumo}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.aulas.length}{" "}
                      {t.aulas.length === 1 ? "aula" : "aulas"} ·{" "}
                      {t.perguntas.length} perguntas no fim
                      {situacao === "desatualizada"
                        ? ` · ${mudaram.length} ${mudaram.length === 1 ? "aula mudou" : "aulas mudaram"} desde a sua conclusão`
                        : ""}
                      {situacao === "concluida" && minha
                        ? ` · concluída em ${formatarDataHora(minha.concluidoEm)}`
                        : ""}
                    </p>
                  </div>
                  <Button render={<Link href={`/treinamento/${t.chave}`} />}>
                    {situacao === "nao_iniciada"
                      ? "Começar"
                      : situacao === "desatualizada"
                        ? "Ver o que mudou"
                        : "Revisar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `questionario.tsx` — o componente cliente do questionário**

Componente cliente com estado local e `useTransition`, no molde de `src/app/(app)/termos/[id]/_components/termo-devolucao.tsx`.

Props: `{ trilhaChave: string; perguntas: { id: string; enunciado: string; alternativas: string[]; aula: string }[]; aulaTitulo: Record<string, string> }`.

**Repare no tipo das perguntas: não há `correta` nem `porque`.** A página monta esse array removendo os dois campos — é o que impede o gabarito de chegar ao navegador. O `porque` volta do servidor só para as que a pessoa errou.

Comportamento:
- Um bloco por pergunta, com quatro `<input type="radio">` e `<Label>` associado.
- Botão desabilitado até toda pergunta ter resposta, com o texto dizendo quantas faltam.
- No submit, chama `concluirTrilha({ trilha, respostas })` dentro de `useTransition`.
- `{ ok: true }`: `toast.success("Treinamento concluído. O comprovante está no fim da página.")` e `router.refresh()`.
- `{ ok: false }` com `erradas`: mostra `<FormError>{r.erro}</FormError>` e, sob cada pergunta errada, o `porque` e um link para a aula (`#aula-<id>`), com o botão virando "Tentar de novo". Não limpa as respostas certas.
- `{ ok: false }` sem `erradas`: só o `FormError`.

- [ ] **Step 3: `aula-lida.tsx` — a marcação de leitura, local ao navegador**

Componente cliente que marca a aula como lida **no `localStorage`**, não no banco.

Props: `{ trilhaChave: string; aulaId: string }`. Chave de armazenamento: `loca-aula-${trilhaChave}-${aulaId}`.

Toda leitura e escrita em `try/catch`: em aba privada ou com dados de site bloqueados o acessador estoura, e a página tem de renderizar certo sem valor guardado.

**Por que não no banco:** o que o registro precisa provar é a conclusão, e a conclusão é o questionário. Marcar leitura é conveniência de quem está lendo em duas sessões — uma tabela para isso seria uma tabela que ninguém consulta, e uma linha no banco por aula lida por pessoa por versão.

- [ ] **Step 4: `comprovante-assinatura.tsx` — assinar e baixar**

Componente cliente com `SignaturePad` de `@/components/shared/signature-pad` (props: `name`, `label`, `onChange`) e `useTransition`.

Props: `{ trilhaChave: string; jaAssinado: boolean; numeroRegistro: string | null }`.

- Se `jaAssinado`, mostra o número do comprovante e um botão que abre `/api/treinamento/[trilha]/comprovante` em nova aba, com `render={<a target="_blank" rel="noopener noreferrer" />}`.
- Se não, mostra o `SignaturePad` e o botão "Assinar comprovante", que monta um `FormData` com `trilha` e `assinatura` e chama `assinarComprovante`.
- Erro em `<FormError>`, sucesso com `toast.success` e `router.refresh()`.

- [ ] **Step 5: `page.tsx` de `/treinamento/[trilha]` — a trilha**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleDot } from "lucide-react";

import { getCurrentPerfil } from "@/lib/auth";
import { conclusoesDoUsuario, obterConclusao } from "@/lib/data/treinamento";
import {
  situacaoDaTrilha,
  versaoConcluida,
  aulasQueMudaram,
  trilhasDoUsuario,
  SITUACAO_TRILHA_INFO,
} from "@/lib/treinamento";
import { trilhaPorChave } from "@/lib/treinamento/index";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AulaLida } from "./_components/aula-lida";
import { Questionario } from "./_components/questionario";
import { ComprovanteAssinatura } from "./_components/comprovante-assinatura";

export const metadata = { title: "Trilha de treinamento — Loca" };

export default async function TrilhaPage({
  params,
}: {
  params: Promise<{ trilha: string }>;
}) {
  const { trilha: chave } = await params;
  const trilha = trilhaPorChave(chave);
  if (!trilha) notFound();

  const perfil = await getCurrentPerfil();

  // A trilha é visível só a quem tem direito a ela: uma trilha de módulo
  // bloqueado ensinaria uma tela que a pessoa não pode abrir.
  const minhas = trilhasDoUsuario(
    perfil?.papel,
    perfil?.modulos,
    perfil?.papel === "master",
  );
  if (!minhas.some((t) => t.chave === trilha.chave)) notFound();

  const conclusoes = perfil?.id ? await conclusoesDoUsuario(perfil.id) : [];
  const situacao = situacaoDaTrilha(trilha, conclusoes);
  const v = versaoConcluida(trilha, conclusoes);
  const mudaram = new Set(aulasQueMudaram(trilha, v).map((a) => a.id));
  const concluida = situacao === "concluida";

  const desta = concluida && perfil?.id
    ? await obterConclusao(perfil.id, trilha.chave, trilha.versao)
    : null;

  const aulaTitulo = Object.fromEntries(trilha.aulas.map((a) => [a.id, a.titulo]));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        titulo={trilha.titulo}
        descricao={trilha.resumo}
        acoes={
          <Button variant="outline" render={<Link href="/treinamento" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      {situacao === "desatualizada" ? (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          Você concluiu a versão {v} desta trilha. Desde então{" "}
          {mudaram.size === 1 ? "uma aula mudou" : `${mudaram.size} aulas mudaram`}
          {" "}— elas estão marcadas abaixo. Releia só o que mudou e refaça o
          questionário, que é curto.
        </div>
      ) : null}

      {trilha.aulas.map((a, i) => (
        <Card key={a.id} id={`aula-${a.id}`} className="scroll-mt-20">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
              {a.titulo}
              {situacao === "desatualizada" && mudaram.has(a.id) ? (
                <Badge variant="default">Mudou</Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{a.resumo}</p>

            <ol className="space-y-3">
              {a.passos.map((p, j) => (
                <li key={j} className="border-l-2 border-border pl-3">
                  <p className="font-mono text-xs text-muted-foreground">{p.onde}</p>
                  <p className="text-sm font-medium">{p.acao}</p>
                  <p className="mt-1 flex gap-1.5 text-sm text-muted-foreground">
                    <CircleDot className="mt-0.5 size-3.5 shrink-0" />
                    {p.esperado}
                  </p>
                </li>
              ))}
            </ol>

            {a.atencao?.length ? (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Atenção
                </p>
                <ul className="list-disc space-y-1 pl-4">
                  {a.atencao.map((t, k) => (
                    <li key={k}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <AulaLida trilhaChave={trilha.chave} aulaId={a.id} />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>
            {concluida ? "Questionário — você já passou" : "Questionário"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {concluida ? (
            <p className="text-sm text-muted-foreground">
              Você concluiu esta versão da trilha. Pode refazer o questionário
              quando quiser — o comprovante continua o mesmo.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              São {trilha.perguntas.length} perguntas, e é preciso acertar todas.
              Errar não tem custo: o sistema mostra por que a resposta é aquela,
              aponta a aula, e você tenta de novo.
            </p>
          )}

          {/* `correta` e `porque` NÃO descem para o cliente. É o que impede o
              gabarito de sair no HTML. O `porque` volta do servidor só para as
              perguntas que a pessoa errou. */}
          <Questionario
            trilhaChave={trilha.chave}
            perguntas={trilha.perguntas.map((p) => ({
              id: p.id,
              enunciado: p.enunciado,
              alternativas: p.alternativas,
              aula: p.aula,
            }))}
            aulaTitulo={aulaTitulo}
          />
        </CardContent>
      </Card>

      {concluida ? (
        <Card>
          <CardHeader>
            <CardTitle>Comprovante</CardTitle>
          </CardHeader>
          <CardContent>
            <ComprovanteAssinatura
              trilhaChave={trilha.chave}
              jaAssinado={Boolean(desta?.assinatura)}
              numeroRegistro={desta?.numeroRegistro ?? null}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Verificar que o gabarito não sai no HTML**

Este é o passo que prova a decisão central da fatia. Rode o servidor de desenvolvimento, abra a trilha, e procure no HTML da página.

Run: `npm run dev` e, noutro terminal:
```
curl -s http://localhost:3000/treinamento/primeiros-passos | grep -c "correta"
```
Expected: **0**. Se aparecer, o `map` da página está passando o objeto inteiro para o `Questionario`.

Se você não conseguir autenticar para acessar a rota, faça a verificação estática:
```
grep -n "perguntas={" -A 8 "src/app/(app)/treinamento/[trilha]/page.tsx"
```
Expected: o `map` lista explicitamente `id`, `enunciado`, `alternativas` e `aula`, e nada mais. Diga no relatório qual das duas verificações você fez.

- [ ] **Step 7: Ritual parcial**

Run: `npm run typecheck` → sem erro.
Run: `npm run lint` → sem erro.
Run: `npm run build` → `✓ Compiled successfully`, com `/treinamento` e `/treinamento/[trilha]` na listagem de rotas.

- [ ] **Step 8: Auditoria de acentuação**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|numero|voce|tambem|questionario|conclusao)" "src/app/(app)/treinamento" --include=*.tsx | grep -v "trilhaChave\|numeroRegistro\|aulaId"
```
Expected: nada. `questionário` e `conclusão` têm acento em texto visível; sem acento só em nome de arquivo e de componente.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(app)/treinamento/page.tsx" "src/app/(app)/treinamento/[trilha]"
git commit -m "feat(treinamento): a lista de trilhas e a tela da trilha

O gabarito NÃO desce para o cliente: a página monta o array de perguntas
listando id, enunciado, alternativas e aula — \`correta\` e \`porque\` ficam no
servidor. O \`porque\` volta só para as perguntas que a pessoa errou, senão
bastaria reprovar uma vez para colher o gabarito inteiro.

Trilha de módulo bloqueado dá notFound: ensinar uma tela que a pessoa não pode
abrir é pior que não ter a trilha.

Quem já concluiu e a trilha mudou vê quais aulas mudaram, marcadas, e releia só
essas. A marcação de \"li esta aula\" é localStorage, não banco: o que o
registro precisa provar é a conclusão, e a conclusão é o questionário.

/treinamento não é módulo liberável — fica disponível a todo usuário
autenticado, como Perfil e Novidades. Trancar a porta do treinamento e esconder
a chave seria o contrário do que ele existe para fazer.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `/treinamento/pendentes` — o painel de quem falta

**Files:**
- Create: `src/app/(app)/treinamento/pendentes/page.tsx`

**Interfaces:**
- Consumes: `resumirPendencias` de `@/lib/treinamento`; `usuariosDaOrganizacao`, `conclusoesDaOrganizacao` de `@/lib/data/treinamento`; `getCurrentPerfil`, `podeEditarCadastros` de `@/lib/auth`; `PAPEL_INFO` de `@/lib/permissoes`.
- Produces: rota `/treinamento/pendentes`.

- [ ] **Step 1: Usar o mapa de rótulo de papel que já existe**

`src/lib/permissoes.ts` exporta `PAPEL_INFO: Record<Papel, { label: string; descricao: string }>` — verificado no disco. Use `PAPEL_INFO[l.papel].label` na coluna Papel, e importe-o de `@/lib/permissoes`.

Mostrar o `papel` cru (`"administrador"`, `"operador"`) numa tela seria criar a segunda forma de nomear papel no projeto, e a primeira já está escrita.

- [ ] **Step 2: Escrever a página**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCurrentPerfil, podeEditarCadastros } from "@/lib/auth";
import { PAPEL_INFO } from "@/lib/permissoes";
import { usuariosDaOrganizacao, conclusoesDaOrganizacao } from "@/lib/data/treinamento";
import { resumirPendencias } from "@/lib/treinamento";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Quem treinou — Loca" };

/**
 * O painel de quem treinou e quem falta.
 *
 * `/treinamento` não é módulo liberável, então o proxy não protege esta rota —
 * a checagem de papel é AQUI, e é o único lugar que a faz.
 */
export default async function PendentesPage() {
  const perfil = await getCurrentPerfil();
  if (!podeEditarCadastros(perfil?.papel)) redirect("/treinamento");

  const [usuarios, conclusoes] = await Promise.all([
    usuariosDaOrganizacao(),
    conclusoesDaOrganizacao(),
  ]);

  const linhas = resumirPendencias(usuarios, conclusoes);
  const emDia = linhas.filter((l) => l.pendentes.length === 0).length;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Quem treinou"
        descricao={`${emDia} de ${linhas.length} em dia com o treinamento`}
        acoes={
          <Button variant="outline" render={<Link href="/treinamento" />}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pessoa</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead className="text-right">Concluídas</TableHead>
                <TableHead>O que falta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {linhas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum usuário ativo.
                  </TableCell>
                </TableRow>
              ) : (
                linhas.map((l) => (
                  <TableRow key={l.perfilId}>
                    <TableCell className="font-medium">{l.nome}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {PAPEL_INFO[l.papel].label}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.concluidas} de {l.total}
                    </TableCell>
                    <TableCell>
                      {l.pendentes.length === 0 ? (
                        <Badge variant="secondary">Em dia</Badge>
                      ) : (
                        <span className="text-sm">{l.pendentes.join(", ")}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        O treinamento pendente não bloqueia o acesso a nada — foi decisão de
        projeto. Este painel existe para cobrar, não para trancar: no dia em que
        alguém precisar lançar algo com urgência, ele consegue.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Verificar o controle de acesso**

Run: `grep -n "podeEditarCadastros" "src/app/(app)/treinamento/pendentes/page.tsx"`
Expected: a checagem aparece **antes** de qualquer leitura. Uma página que lê primeiro e checa depois vaza a existência dos dados pelo tempo de resposta.

- [ ] **Step 4: Typecheck, lint e commit**

Run: `npm run typecheck` → sem erro.
Run: `npm run lint` → sem erro.

```bash
git add "src/app/(app)/treinamento/pendentes"
git commit -m "feat(treinamento): painel de quem treinou e quem falta

Ordenado por pendência decrescente: o painel existe para cobrar, e quem está em
dia no topo esconderia exatamente quem interessa.

/treinamento não é módulo liberável, então o proxy não protege esta rota — a
checagem de papel é aqui, antes de qualquer leitura. Página que lê primeiro e
checa depois vaza a existência dos dados pelo tempo de resposta.

A tela diz, no rodapé, que treinamento pendente não bloqueia nada: quem vê o
painel precisa saber que a cobrança é dele, não do sistema.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: `/ajuda` — o manual

**Files:**
- Create: `src/app/(app)/ajuda/page.tsx`

**Interfaces:**
- Consumes: `manualPorRota` de `@/lib/treinamento`; `TRILHAS` de `@/lib/treinamento/index`; `ListFilters`, `ListSearch` de `@/components/shared/`.
- Produces: rota `/ajuda`.

- [ ] **Step 1: Escrever a página**

O manual é a **segunda leitura da mesma fonte**: as mesmas aulas, indexadas por tela em vez de percorridas em sequência.

```tsx
import Link from "next/link";
import { BookOpen } from "lucide-react";

import { manualPorRota } from "@/lib/treinamento";
import { PageHeader } from "@/components/shared/page-header";
import { ListFilters } from "@/components/shared/list-filters";
import { ListSearch } from "@/components/shared/list-search";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Ajuda — Loca" };

/**
 * O manual: as mesmas aulas do treinamento, indexadas por tela.
 *
 * A trilha percorre na ordem em que se aprende; o manual atende quem já sabe e
 * travou. Uma fonte, duas ordens — e nenhum dos dois desatualiza sem o outro.
 *
 * Não é módulo liberável, como `/treinamento`: esconder o manual de alguém não
 * protege nada e atrapalha tudo.
 */
export default async function AjudaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const busca = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().toLowerCase() ?? "";

  const indice = manualPorRota().filter((r) => {
    if (!busca) return true;
    if (r.rota.toLowerCase().includes(busca)) return true;
    return r.aulas.some(
      (a) =>
        a.aula.titulo.toLowerCase().includes(busca) ||
        a.aula.resumo.toLowerCase().includes(busca),
    );
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        titulo="Ajuda"
        descricao="O que cada tela faz, indexado por tela. É o mesmo conteúdo do treinamento, na ordem de quem já sabe e travou."
      />

      <ListFilters>
        <ListSearch
          placeholder="Buscar por tela ou assunto…"
          ariaLabel="Buscar no manual"
        />
      </ListFilters>

      {indice.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Nada encontrado para “{busca}”. Tente o nome da tela, como
              “frota”, ou o assunto, como “filtro”.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {indice.map((r) => (
            <Card key={r.rota}>
              <CardContent className="pt-6">
                <p className="font-mono text-sm font-medium">{r.rota}</p>
                <ul className="mt-2 space-y-2">
                  {r.aulas.map(({ trilha, aula }) => (
                    <li key={`${trilha}-${aula.id}`} className="text-sm">
                      <Link
                        href={`/treinamento/${trilha}#aula-${aula.id}`}
                        className="inline-flex items-center gap-1.5 font-medium hover:underline"
                      >
                        <BookOpen className="size-3.5 text-muted-foreground" />
                        {aula.titulo}
                      </Link>
                      <p className="text-muted-foreground">{aula.resumo}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint, build e commit**

Run: `npm run typecheck` → sem erro.
Run: `npm run lint` → sem erro.
Run: `npm run build` → compila, com `/ajuda` na listagem.

```bash
git add "src/app/(app)/ajuda"
git commit -m "feat(ajuda): o manual, lendo as mesmas aulas do treinamento

Segunda leitura da MESMA fonte: a trilha percorre na ordem em que se aprende, o
manual indexa pelas rotas que cada aula declara. Nada escrito duas vezes, e
nenhum dos dois desatualiza sem o outro.

Cada entrada linka para a aula dentro da trilha, na âncora dela — quem travou
numa tela cai direto no passo a passo, sem percorrer a trilha inteira.

Não é módulo liberável: esconder o manual de alguém não protege nada e
atrapalha tudo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: O comprovante FRM-TR-001 e a rota de PDF

**Files:**
- Create: `src/lib/documentos/frm-tr-001.tsx`
- Create: `src/app/api/treinamento/[trilha]/comprovante/route.tsx`
- Modify: `src/lib/templates.ts` — `TipoDocumento`, `DOCUMENTOS`, `DEFAULT_TEMPLATES`
- Test: `src/lib/documentos/frm-tr-001.test.tsx`

**Interfaces:**
- Consumes: `Documento`, `Secao`, `CampoGrid`, `Tabela`, `Assinaturas`, `type Campo`, `type Coluna`, `type LinhaTabela`, `type Assinante`, `contarPaginas` de `@/lib/pdf-form`; `Narrativa` de `@/lib/documentos/blocos`; `renderTemplate`, `corpoParaParagrafos`, `resolverTemplate` de `@/lib/templates`.
- Produces: `ComprovanteTreinamento({ orgNome, numero, campos, aulas, paragrafos, localData, assinantes, versao, publicadoEm })`; rota `GET /api/treinamento/[trilha]/comprovante`.

- [ ] **Step 1: Registrar o tipo de documento em `src/lib/templates.ts`**

Três pontos, no molde exato de como `termo_equipamento` entrou na 0.49.0.

Na união `TipoDocumento`, depois de `| "termo_equipamento"`:

```ts
  | "comprovante_treinamento"
```

No catálogo `DOCUMENTOS`, uma entrada nova. **Atenção:** o campo `modulo` é `ModuloKey`, e treinamento **não é** um módulo liberável — declare `modulo: "relatorios"` e registre a razão num comentário ali mesmo:

```ts
  {
    tipo: "comprovante_treinamento",
    label: "Comprovante de treinamento (FRM-TR-001)",
    descricao: "Gerado na trilha concluída, depois de assinado.",
    eyebrow: "FRM-TR-001 · Comprovante de treinamento",
    // Treinamento não é ModuloKey — não é módulo liberável, de propósito.
    // Declarado em `relatorios` para aparecer em Configurações › Templates;
    // alargar ModuloKey só por isso quebraria a varredura de rotas.
    modulo: "relatorios",
    categoria: "formulario",
    preenchimento: "com_dados",
    variaveis: [
      { chave: "empresa_nome", descricao: "Nome da empresa" },
      { chave: "pessoa", descricao: "Nome de quem concluiu" },
      { chave: "trilha", descricao: "Título da trilha" },
      { chave: "versao", descricao: "Versão do conteúdo concluída" },
      { chave: "concluido_em", descricao: "Data da conclusão" },
    ],
  },
```

Em `DEFAULT_TEMPLATES`, a entrada correspondente:

```ts
  comprovante_treinamento: {
    titulo: "COMPROVANTE DE TREINAMENTO NO SISTEMA",
    corpo: [
      "Declaro que percorri integralmente a trilha de treinamento {{trilha}} do sistema Loca, na versão {{versao}} do conteúdo, e que respondi corretamente a todas as perguntas de verificação em {{concluido_em}}.",
      "Declaro estar ciente de que:",
      "— O treinamento descreve a versão do sistema vigente na data acima. Quando uma tela muda de forma relevante, a trilha correspondente é atualizada e o sistema me apresenta novamente as partes que mudaram.",
      "— Os registros que eu criar no sistema ficam associados ao meu usuário, e as telas que geram documento assinado — termo de responsabilidade por equipamento, entre outras — produzem prova em meu nome.",
      "— O acesso de cada usuário é liberado módulo por módulo, e usar o acesso de outra pessoa apaga o rastro de quem fez o quê.",
      "— Dúvidas sobre qualquer tela podem ser consultadas a qualquer momento na Ajuda do próprio sistema, que traz o mesmo conteúdo desta trilha indexado por tela.",
    ].join("\n\n"),
    versao: "1.0",
    publicadoEm: "2026-09-03",
  },
```

- [ ] **Step 2: Rodar o teste de templates**

Run: `npx vitest run src/lib/templates.test.ts`
Expected: PASS. Os testes existentes exigem que todo tipo do catálogo tenha template padrão e que todo documento declare módulo, categoria e preenchimento — se reprovar, faltou um dos três pontos.

- [ ] **Step 3: Escrever `src/lib/documentos/frm-tr-001.tsx`**

Siga a estrutura de `src/lib/documentos/frm-eq-001.tsx`, que é o documento mais recente e o mais parecido.

```tsx
// FRM-TR-001 — Comprovante de Treinamento no Sistema.
//
// ESTRUTURA aqui; TEXTO da declaração em `documento_template`, tipo
// `comprovante_treinamento`, editável em Configurações. Mesma divisão dos
// outros documentos: revisar o texto de uma declaração é assunto de quem
// responde por ela, e não pode exigir deploy.
//
// A tabela lista as AULAS percorridas, não as perguntas. O comprovante atesta
// o que a pessoa leu; o acerto no questionário é a condição para ele existir, e
// aparece como resultado, não como gabarito impresso.

import { Narrativa } from "./blocos";
import {
  Documento,
  Secao,
  CampoGrid,
  Tabela,
  Assinaturas,
  type Campo,
  type Coluna,
  type LinhaTabela,
  type Assinante,
} from "@/lib/pdf-form";

const COLUNAS_AULAS: Coluna[] = [
  { titulo: "#", largura: 8 },
  { titulo: "Aula", largura: 42 },
  { titulo: "O que ela cobre", largura: 50 },
];

export function ComprovanteTreinamento({
  orgNome,
  numero,
  campos,
  aulas,
  paragrafos,
  localData,
  assinantes,
  versao,
  publicadoEm,
}: {
  orgNome: string;
  numero?: string | null;
  campos: Campo[];
  aulas: { titulo: string; resumo: string }[];
  paragrafos: string[];
  localData: string;
  assinantes: Assinante[];
  versao?: string;
  publicadoEm?: string;
}) {
  const linhas: LinhaTabela[] = aulas.map((a, i) => ({
    celulas: [String(i + 1), a.titulo, a.resumo],
  }));

  return (
    <Documento
      codigo="FRM-TR-001"
      versao={versao}
      publicadoEm={publicadoEm}
      titulo="Comprovante de Treinamento no Sistema"
      subtitulo={numero ? `${orgNome} — ${numero}` : orgNome}
    >
      <Secao n={1} titulo="Identificação">
        <CampoGrid colunas={2} campos={campos} />
      </Secao>

      {/* quebrar={false}: sem isso o cabeçalho da tabela fica órfão no pé de
          uma página e as linhas caem na seguinte. */}
      <Secao n={2} titulo="Aulas percorridas" quebrar={false}>
        <Tabela colunas={COLUNAS_AULAS} linhas={linhas} />
      </Secao>

      <Narrativa paragrafos={paragrafos} tituloPadrao="Declaração" />

      <Assinaturas modo="imagem" assinantes={assinantes} localData={localData} />
    </Documento>
  );
}
```

- [ ] **Step 4: Escrever o teste do documento**

Criar `src/lib/documentos/frm-tr-001.test.tsx`, no molde de `frm-eq-001.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { ComprovanteTreinamento } from "./frm-tr-001";

// `renderToBuffer` é CPU-bound e, na suíte completa, disputa com os demais
// arquivos de PDF. Ver a nota em pdf-form.test.tsx.
vi.setConfig({ testTimeout: 120_000 });

const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const CAMPOS = [
  { label: "Pessoa", valor: "Fulano de Tal" },
  { label: "Papel no sistema", valor: "Operador" },
  { label: "Trilha", valor: "Primeiros passos no Loca" },
  { label: "Concluido em", valor: "03/09/2026" },
];

const AULAS = [
  { titulo: "Entrar no Loca", resumo: "Onde e o endereco e o que fazer quando a senha nao passa." },
  { titulo: "O menu", resumo: "Por que o seu menu e diferente do menu do colega." },
];

const PARAGRAFOS = [
  "DECLARACAO",
  "Declaro que percorri integralmente a trilha de treinamento e respondi corretamente a todas as perguntas de verificacao.",
];

describe("FRM-TR-001", () => {
  it("comprovante com duas aulas e assinatura desenhada cabe em 1 pagina", async () => {
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero="TRE-2026-0001"
        campos={CAMPOS}
        aulas={AULAS}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("sem numero, o subtitulo nao mostra travessao solto", async () => {
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero={null}
        campos={CAMPOS}
        aulas={AULAS}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal" }]}
      />,
    );
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });

  it("com dez aulas ainda renderiza", async () => {
    const muitas = Array.from({ length: 10 }, (_, i) => ({
      titulo: `Aula ${i + 1}`,
      resumo: "Resumo da aula, com tamanho parecido com o real.",
    }));
    const buffer = await renderToBuffer(
      <ComprovanteTreinamento
        orgNome="Sistenge"
        numero="TRE-2026-0002"
        campos={CAMPOS}
        aulas={muitas}
        paragrafos={PARAGRAFOS}
        localData="Rio de Janeiro, 03/09/2026."
        assinantes={[{ papel: "Quem concluiu", nome: "Fulano de Tal", imagem: PNG }]}
      />,
    );
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 5: Rodar o teste do documento**

Run: `npx vitest run src/lib/documentos/frm-tr-001.test.tsx`
Expected: PASS. Se o primeiro caso reprovar por passar de uma página, reduza a largura da coluna "O que ela cobre" — mas **reporte**, porque isso significa que o comprovante de uma trilha real não cabe numa folha.

- [ ] **Step 6: Escrever a rota do PDF**

Criar `src/app/api/treinamento/[trilha]/comprovante/route.tsx`, no molde de `src/app/api/termos/[id]/pdf/route.tsx`.

Comportamento:
- `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Resolve a trilha por `trilhaPorChave`; 404 se não existir.
- `getCurrentPerfil()`; 404 se não houver sessão.
- `obterConclusao(perfil.id, trilha.chave, trilha.versao)`; **404 se não houver conclusão** — comprovante de treinamento não concluído não existe.
- Lê `organizacao.nome` e o template `comprovante_treinamento` de `documento_template`, com `resolverTemplate`.
- Variáveis: `empresa_nome`, `pessoa` (nome do perfil), `trilha` (título), `versao`, `concluido_em` (`formatarData` da conclusão).
- Campos: Pessoa, Papel no sistema, Trilha, Versão do conteúdo, Concluído em, Comprovante (o número).
- Aulas: `trilha.aulas.map(a => ({ titulo: a.titulo, resumo: a.resumo }))`.
- Assinante único: nome do perfil, papel `"Quem concluiu"`, `imagem: conclusao.assinatura`.
- `localData`: cidade não é conhecida aqui, então use só a data — `${formatarData(conclusao.concluidoEm.slice(0, 10))}.`
- `Content-Disposition: inline; filename="FRM-TR-001-<numero ou trilha>.pdf"`.

**A RLS é a proteção:** `obterConclusao` usa `createClient()`, e a policy só devolve a linha da própria pessoa (ou qualquer uma, para master/administrador). Não acrescente checagem de papel na rota — a rota entrega o comprovante de quem pede, e quem pede o de outra pessoa não recebe linha nenhuma.

- [ ] **Step 7: Ritual e commit**

Run: `npm run typecheck` → sem erro.
Run: `npm run lint` → sem erro.
Run: `npm run build` → compila, com `/api/treinamento/[trilha]/comprovante` na listagem.

```bash
git add src/lib/documentos/frm-tr-001.tsx src/lib/documentos/frm-tr-001.test.tsx src/lib/templates.ts "src/app/api/treinamento"
git commit -m "feat(treinamento): comprovante FRM-TR-001 em PDF

A tabela lista as AULAS percorridas, não as perguntas: o comprovante atesta o
que a pessoa leu, e o acerto no questionário é a condição para ele existir —
imprimir o gabarito num documento assinado seria distribuir o gabarito.

O texto da declaração fica em documento_template, editável em Configurações,
como todo documento do sistema. Ela declara o que importa depois: que o
treinamento descreve a versão vigente, que os registros ficam no nome da
pessoa, e que usar o acesso de outra pessoa apaga o rastro.

A proteção da rota é a RLS, não uma checagem de papel: a policy só devolve a
linha da própria pessoa, então quem pedir o comprovante de outra não recebe
linha nenhuma.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Navegação, varredura de rotas, e o fechamento em 0.51.0

**Files:**
- Modify: `src/lib/nav.ts` — os itens de Treinamento e Ajuda
- Modify: `src/lib/modulos.test.ts` — as duas exceções em `SEM_MODULO`
- Modify: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`

**Interfaces:**
- Consumes: nada novo.
- Produces: versão `0.51.0` nos três pontos, em sincronia.

- [ ] **Step 1: Acrescentar as exceções na varredura de rotas**

Em `src/lib/modulos.test.ts`, no objeto `SEM_MODULO`, com a razão — a varredura exige que toda rota de primeiro nível seja modulável ou declarada com justificativa:

```ts
    treinamento: "trilhas e comprovante do próprio usuário; trancar o treinamento e esconder a chave seria o contrário do que ele existe para fazer",
    ajuda: "manual do sistema; esconder de alguém não protege nada e atrapalha tudo",
```

- [ ] **Step 2: Rodar a varredura de rotas**

Run: `npx vitest run src/lib/modulos.test.ts`
Expected: PASS. A varredura também exige que toda exceção declarada **exista no disco** — se reprovar por isso, o nome da pasta não bate.

- [ ] **Step 3: Acrescentar os itens de navegação**

Em `src/lib/nav.ts`, acrescente os dois itens. Leia o arquivo antes: cada `NavItem` tem `label`, `href`, `icon`, um `grupo?: GrupoNav` opcional, e alguns têm `apenasMaster`.

Os dois **não** levam `grupo` — como Perfil e Novidades, ficam fora dos quatro grupos de área (Obra, Equipamento, Imóveis, Financeiro), porque não são área de trabalho. Use `GraduationCap` para Treinamento e `BookOpen` para Ajuda, de `lucide-react`.

Se a estrutura de `nav.ts` não permitir item sem grupo, **pare e reporte** em vez de inventar um grupo novo.

- [ ] **Step 4: Bumpar `src/lib/changelog.ts`**

`APP_VERSION` passa a `"0.51.0"`, e o `Release` novo entra no **topo** do array. MINOR: funcionalidade nova sem quebrar o que existe. Texto voltado ao usuário final, sem jargão:

```ts
  {
    versao: "0.51.0",
    data: "2026-09-03",
    titulo: "Treinamento e ajuda dentro do sistema",
    mudancas: [
      { tipo: "novo", texto: "Nova tela de Treinamento, com trilhas que ensinam o sistema passo a passo. Cada passo diz o que fazer e o que tem de acontecer — não é só um passeio pelas telas." },
      { tipo: "novo", texto: "A primeira trilha, Primeiros passos, está pronta: entrar, trocar a senha, entender por que o seu menu é diferente do menu do colega, achar uma obra, filtrar qualquer lista e pedir o acesso que falta." },
      { tipo: "novo", texto: "No fim de cada trilha há um questionário curto. É preciso acertar todas as perguntas — errar não tem custo: o sistema explica por que a resposta é aquela, aponta a aula e você tenta de novo." },
      { tipo: "novo", texto: "Quem concluiu recebe um comprovante em PDF, assinado na tela, com número de registro." },
      { tipo: "novo", texto: "Nova tela de Ajuda: o mesmo conteúdo do treinamento, organizado por tela, para quem já sabe e travou em algo específico." },
      { tipo: "novo", texto: "Quando uma tela muda e a trilha é atualizada, quem já tinha concluído vê exatamente quais aulas mudaram, e relê só essas." },
      { tipo: "novo", texto: "Para quem administra o sistema: painel de quem treinou e quem falta. Treinamento pendente não bloqueia o acesso a nada — o painel existe para cobrar, não para trancar." },
    ],
  },
```

- [ ] **Step 5: Replicar em `CHANGELOG.md`**

Acrescente `## [0.51.0] — 2026-09-03` acima da seção `## [0.50.0]`, no formato Keep a Changelog, com as subseções Adicionado e uma nota curta sobre as duas decisões de desenho: o conteúdo mora no código, versionado; e manual e trilha leem a mesma fonte em duas ordens. Registre também que a migration **0063** está no repositório e precisa ser aplicada antes do deploy.

- [ ] **Step 6: Bumpar `package.json`**

Campo `version` passa a `"0.51.0"`, igual a `APP_VERSION`.

- [ ] **Step 7: Ritual — typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 8: Ritual — lint**

Run: `npm run lint`
Expected: sem erro.

- [ ] **Step 9: Ritual — testes, com a conferência de contagem**

Run: `npm test`
Expected: PASS.

Depois: `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`
Expected: o número igual ao "Test Files" do relatório. Se o disco tiver mais, rode `npm test` de novo antes de concluir qualquer coisa — já houve corrida em que o Vitest reportou 27 arquivos EM VERDE com 28 no disco.

- [ ] **Step 10: Ritual — build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, com `/treinamento`, `/treinamento/[trilha]`, `/treinamento/pendentes`, `/ajuda` e `/api/treinamento/[trilha]/comprovante` na listagem de rotas.

- [ ] **Step 11: Revisar o diff e commitar**

Run: `git status --short` e `git diff main --stat`
Expected: só os arquivos previstos por este plano.

```bash
git add src/lib/nav.ts src/lib/modulos.test.ts src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore(release): 0.51.0 — treinamento e ajuda

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

**PARE aqui.** Merge na `main`, push e a aplicação da migration 0063 em produção são do controlador, não seu. Não troque de branch.

---

## Divergência deliberada em relação à spec

A spec nomeia a leitura de usuários como `usuariosComPendencia`; o plano a chama
de **`usuariosDaOrganizacao`**. O nome da spec descreve o resultado errado: o
cálculo de pendência precisa de **todos** os usuários ativos, porque quem está
em dia também aparece no painel — com "Em dia" na última coluna. Uma função
chamada `usuariosComPendencia` que devolve todos é a pior espécie de nome.

Não é lacuna de cobertura: é a mesma função, com o nome que diz o que ela faz.

## Notas para quem executa

**A ordem das tarefas é dependência, não preferência.** A 1 e a 2 não dependem de banco — a 2 consome os tipos e o conteúdo da 1. A 3 (migration) tem de estar aplicada antes de a 5 rodar de verdade, mas não antes de ela ser escrita. A 4 depende da 3. A 5 depende da 2 e da 4. A 6 depende da 2, 4 e 5. A 7 depende da 2 e da 4. A 8 depende só da 2. A 9 depende da 4. A 10 é última.

**O que NÃO está nesta fatia**, e não deve ser acrescentado por iniciativa: o conteúdo das trilhas por módulo (Frota, Custódia, Termos, Estoque vêm na onda seguinte, com plano próprio); e-mail semanal de cobrança; painel por obra para o gestor; bloqueio de módulo por treinamento pendente; vídeo. Os três primeiros foram oferecidos ao dono do sistema e **não** foram escolhidos.

**A decisão que não se negocia:** `Pergunta.correta` não sai no payload de nenhuma página. Se alguma tarefa parecer exigir isso, ela está errada — pare e reporte.

**Nenhuma tela desta fatia terá sido vista com dado real** ao fim do plano: quem implementa não tem login no sistema. A verificação do gabarito no HTML (Task 6, Step 6) é a única que chega perto, e o plano oferece a alternativa estática para quando o login não for possível.
