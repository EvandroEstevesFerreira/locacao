# Custódia da peça — Fatia 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar em livro somente-inclusão quem está e quem ficou com cada peça de equipamento, por quanto tempo, e criar o ato de mover a peça — que hoje não existe.

**Architecture:** Uma tabela `custodia_peca` com uma linha por período de posse e `fim` nulo marcando a posse aberta, garantida por índice único parcial. Todo cálculo mora em `src/lib/custodia.ts` (puro, testável); toda escrita passa por `src/lib/custodia-servidor.ts`, o escritor único, chamado pelo termo e pela Frota. Posse de funcionário nasce **só** por termo assinado, e isso é check no banco, não regra de tela.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS + PostgREST), zod 4, react-hook-form + zodResolver, Tailwind v4 + Base UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-02-custodia-peca-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário** — rótulo, placeholder, texto de JSX, toast, mensagem de erro de action, título. Identificadores TypeScript, chaves de enum e de banco, `name=`/`id=`, slugs de rota e `console` ficam sem acento.
- **"Hoje" é sempre `hojeISOSaoPaulo()` de `src/lib/locacao.ts`**, nunca `new Date()`, quando a data é comparada com coluna `date`. O Vercel roda em UTC e das 21h à meia-noite em Brasília a contagem de dias sai um dia maior.
- **Schemas zod moram em `src/lib/<dominio>.ts`**, nunca dentro de `actions.ts` — arquivo `"use server"` não pode ser importado por componente cliente.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.**
- **`createAdminClient()` nunca toca tabela da aplicação.** Use `createClient()`.
- **Toda view nasce com `security_invoker = on`.** Esta fatia não cria view nenhuma.
- **Retorno padrão de action:** `ActionResult` de `src/lib/acoes.ts` — `{ ok: true; id?: string } | { ok: false; erro: string }`, com `falha()` e `primeiroErro()`.
- **Composição de primitivo é `render={<Link/>}`, não `asChild`** (shadcn "base-nova" sobre Base UI).
- **Ritual de fechamento, cada passo rodado SEPARADAMENTE:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Chainar os quatro num comando só já fez o Vitest engolir um arquivo de teste em silêncio.
- **Versionamento em três pontos em sincronia:** `src/lib/changelog.ts` (`APP_VERSION` + `Release` no topo de `CHANGELOG`), `CHANGELOG.md`, `package.json`.

---

### Task 1: `src/lib/custodia.ts` — o cálculo puro

**Files:**
- Create: `src/lib/custodia.ts`
- Test: `src/lib/custodia.test.ts`

**Interfaces:**
- Consumes: `uuidOpcional`, `textoOpcional` de `src/lib/campos.ts`.
- Produces:
  - `TIPOS_DETENTOR: readonly ["almoxarifado","obra","funcionario","fornecedor"]`
  - `type TipoDetentor = (typeof TIPOS_DETENTOR)[number]`
  - `DETENTOR_INFO: Record<TipoDetentor, { label: string; variant: "default"|"secondary"|"outline"|"destructive" }>`
  - `type Posse` e `type PosseNaLinha` (definidos no Step 3)
  - `descreverDetentor(p: Posse): string`
  - `diasDePosse(inicio: string, fim: string | null, hoje: string): number`
  - `descreverPeriodo(dias: number): string`
  - `montarLinhaDoTempo(posses: Posse[], hoje: string): PosseNaLinha[]`
  - `moverPecaSchema`, `editarPecaSchema` (ZodObject exportados — a varredura de schemas os encontra por existirem)

- [ ] **Step 1: Escrever o teste que falha**

Criar `src/lib/custodia.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  TIPOS_DETENTOR,
  DETENTOR_INFO,
  descreverDetentor,
  diasDePosse,
  descreverPeriodo,
  montarLinhaDoTempo,
  moverPecaSchema,
  editarPecaSchema,
  type Posse,
} from "./custodia";

const UUID = "11111111-2222-4333-8444-555555555555";

function posse(over: Partial<Posse> = {}): Posse {
  return {
    id: UUID,
    tipo: "obra",
    obraRotulo: "800 — Administração",
    funcionarioNome: null,
    fornecedorNome: null,
    inicio: "2026-08-01",
    fim: null,
    origem: "manual",
    termoId: null,
    termoNumero: null,
    termoCancelado: false,
    observacoes: null,
    ...over,
  };
}

describe("DETENTOR_INFO", () => {
  it("cobre os quatro tipos, com rótulo acentuado", () => {
    for (const t of TIPOS_DETENTOR) {
      expect(DETENTOR_INFO[t].label.length).toBeGreaterThan(0);
    }
    expect(DETENTOR_INFO.almoxarifado.label).toBe("Almoxarifado central");
    expect(DETENTOR_INFO.fornecedor.label).toBe("Em manutenção");
  });
});

describe("descreverDetentor", () => {
  it("obra usa o rótulo da obra", () => {
    expect(descreverDetentor(posse())).toBe("800 — Administração");
  });

  it("almoxarifado não depende de vínculo nenhum", () => {
    expect(
      descreverDetentor(posse({ tipo: "almoxarifado", obraRotulo: null })),
    ).toBe("Almoxarifado central");
  });

  it("funcionário usa o nome", () => {
    expect(
      descreverDetentor(
        posse({ tipo: "funcionario", obraRotulo: null, funcionarioNome: "Fulano de Tal" }),
      ),
    ).toBe("Fulano de Tal");
  });

  it("fornecedor diz que é manutenção", () => {
    expect(
      descreverDetentor(
        posse({ tipo: "fornecedor", obraRotulo: null, fornecedorNome: "Mecânica Silva" }),
      ),
    ).toBe("Mecânica Silva (manutenção)");
  });

  it("vínculo apagado não vira string vazia", () => {
    // `on delete set null` nas três FK: apagar a obra não pode apagar a
    // história, e a tela não pode mostrar um espaço em branco no lugar dela.
    expect(descreverDetentor(posse({ obraRotulo: null }))).toBe("Obra não identificada");
  });
});

describe("diasDePosse", () => {
  it("posse fechada conta os dias de calendário", () => {
    expect(diasDePosse("2026-08-01", "2026-08-24", "2026-09-02")).toBe(23);
  });

  it("posse aberta conta até hoje", () => {
    expect(diasDePosse("2026-08-01", null, "2026-09-02")).toBe(32);
  });

  it("entrou e saiu no mesmo dia dá zero", () => {
    expect(diasDePosse("2026-09-02", "2026-09-02", "2026-09-02")).toBe(0);
  });

  it("atravessa a virada do ano sem erro de fuso", () => {
    // Aritmética em UTC: `inicio` e `fim` vêm de coluna `date`, não de instante.
    expect(diasDePosse("2025-12-31", "2026-01-01", "2026-09-02")).toBe(1);
  });

  it("fim anterior ao início nunca devolve negativo", () => {
    // O check do banco recusa, mas a leitura não pode produzir "-3 dias" se
    // algum dia entrar linha torta por outro caminho.
    expect(diasDePosse("2026-08-10", "2026-08-07", "2026-09-02")).toBe(0);
  });
});

describe("descreverPeriodo", () => {
  it("zero dia é 'menos de 1 dia', nunca '0 dias'", () => {
    // "0 dias" se lê como dado faltando. A peça esteve com alguém.
    expect(descreverPeriodo(0)).toBe("menos de 1 dia");
  });

  it("singular e plural de dia", () => {
    expect(descreverPeriodo(1)).toBe("1 dia");
    expect(descreverPeriodo(23)).toBe("23 dias");
  });

  it("a partir de um mês fala em meses", () => {
    expect(descreverPeriodo(30)).toBe("1 mês");
    expect(descreverPeriodo(75)).toBe("2 meses");
  });

  it("a partir de um ano fala em anos, com o resto em meses", () => {
    expect(descreverPeriodo(365)).toBe("1 ano");
    expect(descreverPeriodo(425)).toBe("1 ano e 1 mês");
    expect(descreverPeriodo(800)).toBe("2 anos e 2 meses");
  });
});

describe("montarLinhaDoTempo", () => {
  it("a posse aberta vem primeiro, e o resto da mais nova para a mais antiga", () => {
    const linha = montarLinhaDoTempo(
      [
        posse({ id: "a", inicio: "2026-06-01", fim: "2026-07-01" }),
        posse({ id: "b", inicio: "2026-08-01", fim: null }),
        posse({ id: "c", inicio: "2026-07-01", fim: "2026-08-01" }),
      ],
      "2026-09-02",
    );
    expect(linha.map((l) => l.id)).toEqual(["b", "c", "a"]);
    expect(linha[0].aberta).toBe(true);
  });

  it("calcula dias e período de cada posse", () => {
    const linha = montarLinhaDoTempo([posse({ inicio: "2026-08-01", fim: null })], "2026-09-02");
    expect(linha[0].dias).toBe(32);
    expect(linha[0].periodo).toBe("1 mês");
  });

  it("marca o período de termo cancelado", () => {
    // Documento anulado não some do histórico: "esteve com o Fulano" e "houve
    // um termo que não valeu" são fatos diferentes.
    const linha = montarLinhaDoTempo(
      [posse({ tipo: "funcionario", funcionarioNome: "Fulano", termoCancelado: true })],
      "2026-09-02",
    );
    expect(linha[0].anulada).toBe(true);
  });

  it("lista vazia devolve lista vazia, sem estourar", () => {
    expect(montarLinhaDoTempo([], "2026-09-02")).toEqual([]);
  });
});

describe("moverPecaSchema", () => {
  it("mover para obra exige a obra", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "obra",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Selecione a obra.");
  });

  it("mandar para manutenção exige o fornecedor", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "fornecedor",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("Selecione o fornecedor.");
  });

  it("almoxarifado não exige vínculo nenhum", () => {
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "almoxarifado",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(true);
  });

  it("NÃO aceita mover para funcionário", () => {
    // Decisão de projeto no sistema de tipos: posse de pessoa nasce só por
    // termo assinado. Um caminho manual seria a segunda fonte de verdade.
    const r = moverPecaSchema.safeParse({
      unidade_id: UUID,
      tipo: "funcionario",
      obra_id: "",
      fornecedor_id: "",
      data: "2026-09-02",
      observacoes: "",
    });
    expect(r.success).toBe(false);
  });
});

describe("editarPecaSchema", () => {
  it("não tem obra nem situação", () => {
    // Editar não move. Um formulário de edição com `obra_id` dentro seria a
    // primeira porta a furar o livro de custódia.
    const chaves = Object.keys(editarPecaSchema.shape);
    expect(chaves).not.toContain("obra_id");
    expect(chaves).not.toContain("situacao");
  });

  it("aceita os campos de TI vazios", () => {
    const r = editarPecaSchema.safeParse({
      id: UUID,
      identificador: "PAT-0431",
      numero_serie: "",
      ano: "",
      estado: "",
      observacoes: "",
      imei: "",
      imei_2: "",
      linha_telefonica: "",
      operadora: "",
      service_tag: "",
      memoria_gb: "",
      configuracao: "",
    });
    expect(r.success).toBe(true);
  });

  it("recusa IMEI que não tenha 15 dígitos", () => {
    const r = editarPecaSchema.safeParse({
      id: UUID,
      identificador: "PAT-0431",
      numero_serie: "",
      ano: "",
      estado: "",
      observacoes: "",
      imei: "123",
      imei_2: "",
      linha_telefonica: "",
      operadora: "",
      service_tag: "",
      memoria_gb: "",
      configuracao: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("IMEI tem 15 dígitos.");
  });
});
```

- [ ] **Step 2: Rodar o teste para confirmar que falha**

Run: `npx vitest run src/lib/custodia.test.ts`
Expected: FAIL — `Failed to resolve import "./custodia"`.

- [ ] **Step 3: Escrever `src/lib/custodia.ts`**

```ts
// Custódia da peça: quem está com ela, quem ficou, e por quanto tempo.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `equipamento_unidade.obra_id` responde "onde está" e sobrescreve a resposta
// anterior. Mover a peça da Obra A para a Obra B apagava o fato de ela ter
// estado na A — e a pergunta que o almoxarifado faz de verdade é "quem ficou
// com ela e por quanto tempo", que um campo sobrescrito não responde.
//
// O livro (`custodia_peca`) guarda uma linha por PERÍODO de posse, com `fim`
// nulo marcando a posse aberta. É o que faz "com quem está" e "com quem ficou"
// serem a mesma tabela lida de dois jeitos, e o tempo sair de `fim - inicio`
// sem janela nem cálculo esperto.
//
// Aqui mora só cálculo e rótulo — nada de banco. A escrita mora em
// `custodia-servidor.ts`, o escritor único.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { idOpcional, opcional, textoOpcional, uuidOpcional } from "@/lib/campos";
import { ESTADOS } from "@/lib/frota";

export const TIPOS_DETENTOR = [
  "almoxarifado",
  "obra",
  "funcionario",
  "fornecedor",
] as const;
export type TipoDetentor = (typeof TIPOS_DETENTOR)[number];

export const DETENTOR_INFO: Record<
  TipoDetentor,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  almoxarifado: { label: "Almoxarifado central", variant: "secondary" },
  obra: { label: "Em obra", variant: "default" },
  funcionario: { label: "Com funcionário", variant: "default" },
  fornecedor: { label: "Em manutenção", variant: "outline" },
};

/** Uma linha do livro, com os vínculos já resolvidos pela camada de leitura. */
export type Posse = {
  id: string;
  tipo: TipoDetentor;
  obraRotulo: string | null;
  funcionarioNome: string | null;
  fornecedorNome: string | null;
  /** 'yyyy-mm-dd' — coluna `date`, não instante. */
  inicio: string;
  /** NULO = posse aberta. */
  fim: string | null;
  origem: "termo" | "manual";
  termoId: string | null;
  termoNumero: string | null;
  termoCancelado: boolean;
  observacoes: string | null;
};

export type PosseNaLinha = Posse & {
  dias: number;
  periodo: string;
  aberta: boolean;
  /** Posse que veio de termo cancelado: existiu no papel e não valeu. */
  anulada: boolean;
};

/**
 * Quem detém a peça, em uma linha de texto.
 *
 * As três FK são `on delete set null`: apagar a obra não pode apagar a
 * história. Quando o vínculo sumiu, dizemos isso — espaço em branco na tela
 * faria quem confere achar que ninguém preencheu.
 */
export function descreverDetentor(p: Posse): string {
  switch (p.tipo) {
    case "almoxarifado":
      return DETENTOR_INFO.almoxarifado.label;
    case "obra":
      return p.obraRotulo ?? "Obra não identificada";
    case "funcionario":
      return p.funcionarioNome ?? "Funcionário não identificado";
    case "fornecedor":
      return `${p.fornecedorNome ?? "Fornecedor não identificado"} (manutenção)`;
  }
}

/** 'yyyy-mm-dd' como milissegundos UTC de meia-noite. */
function emUTC(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/**
 * Dias de calendário de uma posse. Posse aberta conta até `hoje`.
 *
 * `hoje` é PARÂMETRO, e quem chama passa `hojeISOSaoPaulo()`. Nunca
 * `new Date()` aqui dentro: `inicio` e `fim` vêm de coluna `date`, o Vercel
 * roda em UTC, e das 21h à meia-noite em Brasília a contagem sairia um dia
 * maior — em cima dela está o tempo que alguém ficou com o equipamento.
 */
export function diasDePosse(inicio: string, fim: string | null, hoje: string): number {
  const fimEfetivo = fim ?? hoje;
  const dias = Math.round((emUTC(fimEfetivo) - emUTC(inicio)) / 86_400_000);
  // Nunca negativo: o check do banco recusa `fim < inicio`, mas a leitura não
  // pode produzir "-3 dias" se linha torta entrar por outro caminho.
  return Math.max(0, dias);
}

/**
 * O tempo em português, aproximado de propósito.
 *
 * Mês é 30 dias e ano é 365: ninguém no almoxarifado precisa saber que a
 * betoneira ficou 1 ano, 2 meses e 4 dias na obra. Precisão de dia existe em
 * `dias`, para quem quiser somar.
 */
export function descreverPeriodo(dias: number): string {
  if (dias <= 0) return "menos de 1 dia";
  if (dias === 1) return "1 dia";
  if (dias < 30) return `${dias} dias`;

  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return meses === 1 ? "1 mês" : `${meses} meses`;
  }

  const anos = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  const parteAnos = anos === 1 ? "1 ano" : `${anos} anos`;
  if (meses === 0) return parteAnos;
  return `${parteAnos} e ${meses === 1 ? "1 mês" : `${meses} meses`}`;
}

/**
 * A linha do tempo da peça: posse aberta no topo, resto da mais nova para a
 * mais antiga.
 *
 * A aberta vem primeiro porque a pergunta mais frequente é "onde está AGORA".
 * Ordenar tudo por data deixaria a resposta atual no meio da lista quando
 * houvesse posse retroativa.
 */
export function montarLinhaDoTempo(posses: Posse[], hoje: string): PosseNaLinha[] {
  return posses
    .map((p) => {
      const dias = diasDePosse(p.inicio, p.fim, hoje);
      return {
        ...p,
        dias,
        periodo: descreverPeriodo(dias),
        aberta: p.fim === null,
        anulada: p.termoCancelado,
      };
    })
    .sort((a, b) => {
      if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
      if (a.inicio !== b.inicio) return a.inicio < b.inicio ? 1 : -1;
      // Desempate estável por id: sem ele a ordem de duas posses do mesmo dia
      // muda entre renderizações e a tela "pisca".
      return a.id < b.id ? 1 : -1;
    });
}

const anoOpcional = z
  .union([z.literal(""), z.null(), z.coerce.number()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v >= 1950 && v <= 2100), {
    message: "Ano deve estar entre 1950 e 2100.",
  });

const memoriaOpcional = z
  .union([z.literal(""), z.null(), z.coerce.number()])
  .optional()
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 1024), {
    message: "Memória em GB, entre 1 e 1024.",
  });

const imeiOpcional = opcional.refine((v) => v === null || /^\d{15}$/.test(v), {
  message: "IMEI tem 15 dígitos.",
});

const estadoOpcional = z
  .union([z.literal(""), z.null(), z.enum(ESTADOS)])
  .optional()
  .transform((v) => (v === "" || v == null ? null : v));

/**
 * Mover a peça — e `funcionario` NÃO está entre os destinos.
 *
 * Posse de pessoa nasce só por termo assinado (decisão de 02/09/2026). O botão
 * de entregar leva a `/termos/novo`. Duas portas para "entregar ao Fulano",
 * uma com assinatura e outra sem, produziriam a divergência que o Loca existe
 * para eliminar — então a porta sem assinatura não existe nem no tipo.
 */
export const moverPecaSchema = z
  .object({
    unidade_id: z.string().uuid("Peça inválida."),
    tipo: z.enum(["almoxarifado", "obra", "fornecedor"]),
    obra_id: uuidOpcional,
    fornecedor_id: uuidOpcional,
    data: z.string().min(1, "Informe a data da movimentação."),
    observacoes: textoOpcional(300),
  })
  .refine((v) => v.tipo !== "obra" || v.obra_id !== null, {
    message: "Selecione a obra.",
    path: ["obra_id"],
  })
  .refine((v) => v.tipo !== "fornecedor" || v.fornecedor_id !== null, {
    message: "Selecione o fornecedor.",
    path: ["fornecedor_id"],
  });

export type MoverPecaInput = z.input<typeof moverPecaSchema>;
export type MoverPecaDados = z.output<typeof moverPecaSchema>;

/**
 * Editar a peça — sem obra e sem situação, de propósito.
 *
 * Esses dois mudam só por Mover, Mandar para manutenção e Baixar, que passam
 * pelo escritor de custódia. Um formulário de edição genérico com `obra_id`
 * dentro seria a primeira porta a furar o livro, e a divergência apareceria em
 * silêncio.
 */
export const editarPecaSchema = z.object({
  id: z.string().uuid("Peça inválida."),
  identificador: z.string().trim().min(1, "Informe o patrimônio.").max(80),
  numero_serie: textoOpcional(80),
  ano: anoOpcional,
  estado: estadoOpcional,
  observacoes: opcional.refine((v) => v === null || v.length <= 300, {
    message: "Use no máximo 300 caracteres.",
  }),
  imei: imeiOpcional,
  imei_2: imeiOpcional,
  linha_telefonica: textoOpcional(20),
  operadora: textoOpcional(40),
  service_tag: textoOpcional(60),
  memoria_gb: memoriaOpcional,
  configuracao: textoOpcional(200),
});

export type EditarPecaInput = z.input<typeof editarPecaSchema>;
export type EditarPecaDados = z.output<typeof editarPecaSchema>;

/** Schema do livro, para a action que grava. */
export const custodiaSchema = z.object({
  id: idOpcional,
  unidade_id: z.string().uuid("Peça inválida."),
  tipo: z.enum(TIPOS_DETENTOR),
  obra_id: uuidOpcional,
  funcionario_id: uuidOpcional,
  fornecedor_id: uuidOpcional,
  inicio: z.string().min(1, "Informe a data de início da posse."),
  observacoes: textoOpcional(300),
});

export type CustodiaInput = z.input<typeof custodiaSchema>;
export type CustodiaDados = z.output<typeof custodiaSchema>;
```

- [ ] **Step 4: Rodar o teste para confirmar que passa**

Run: `npx vitest run src/lib/custodia.test.ts`
Expected: PASS, todos os casos.

- [ ] **Step 5: Acrescentar as amostras na varredura de schemas**

Modificar `src/lib/schemas-varredura.test.ts` em três pontos.

Import, em ordem alfabética entre `config` e `custoItem`:

```ts
import * as custodia from "./custodia";
```

Objeto `MODULOS`, na mesma ordem:

```ts
  custodia,
```

Objeto `AMOSTRAS`, junto das amostras de frota:

```ts
  moverPecaSchema: {
    unidade_id: UUID,
    tipo: "almoxarifado",
    data: "2026-09-02",
  },
  editarPecaSchema: { id: UUID, identificador: "PAT-0431" },
  custodiaSchema: { unidade_id: UUID, tipo: "almoxarifado", inicio: "2026-09-02" },
```

- [ ] **Step 6: Rodar a varredura**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: PASS. A varredura exige `parse(parse(x)) === parse(x)` de todo `ZodObject` exportado — se algum dos três novos reprovar, o defeito é real (campo opcional que não aceita o próprio `null` de volta) e se corrige em `custodia.ts`, não na amostra.

- [ ] **Step 7: Auditoria de acentuação**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/lib/custodia.ts src/lib/custodia.test.ts
```
Expected: só identificadores (`numero_serie`, `funcionario_id`, `funcionarioNome`). Nenhuma string visível sem acento.

- [ ] **Step 8: Commit**

```bash
git add src/lib/custodia.ts src/lib/custodia.test.ts src/lib/schemas-varredura.test.ts
git commit -m "feat(custodia): cálculo puro de posse, tempo e linha do tempo

Livro de custódia guarda uma linha por PERÍODO de posse, com fim nulo na
aberta — é o que faz \"com quem está\" e \"com quem ficou\" serem a mesma
tabela lida de dois jeitos.

\`hoje\` é parâmetro, nunca new Date(): inicio e fim vêm de coluna date e o
Vercel roda em UTC. Das 21h à meia-noite em Brasília a contagem de dias sairia
um dia maior, e em cima dela está o tempo que alguém ficou com o equipamento.

moverPecaSchema NÃO aceita destino \`funcionario\`: posse de pessoa nasce só
por termo assinado, e a porta sem assinatura não existe nem no tipo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration 0059 — o livro, a guarda e os campos de TI

**Files:**
- Create: `supabase/migrations/0059_custodia_peca.sql`
- Test: validação em Postgres local descartável (Step 3), e `src/lib/migrations-seguranca.test.ts` já existente roda sobre ela sem alteração

**Interfaces:**
- Consumes: `public.organizacao`, `public.equipamento_unidade`, `public.obra`, `public.funcionario`, `public.fornecedor`, `public.termo_equipamento`, `public.categoria_equipamento`, `public.set_updated_at()`, `public.current_org_id()`, `public.pode_operar()`, `public.registrar_auditoria()`.
- Produces: tabela `public.custodia_peca`; colunas `imei`, `imei_2`, `linha_telefonica`, `operadora`, `service_tag`, `memoria_gb`, `configuracao` em `equipamento_unidade`; coluna `perfil_campos` em `categoria_equipamento`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0059_custodia_peca.sql`:

```sql
-- ============================================================================
-- Custódia da peça: quem está, quem ficou, e por quanto tempo
-- (docs/superpowers/specs/2026-09-02-custodia-peca-design.md)
--
-- `equipamento_unidade.obra_id` responde "onde está" e SOBRESCREVE a resposta
-- anterior. Mover a peça da Obra A para a Obra B apagava o fato de ela ter
-- estado na A. Este livro guarda uma linha por PERÍODO de posse, com `fim`
-- nulo na posse aberta.
--
-- Nada aqui altera dado existente: uma tabela nova, colunas opcionais, e uma
-- semeadura a partir dos termos já emitidos.
-- ============================================================================

create table if not exists public.custodia_peca (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  unidade_id     uuid not null references public.equipamento_unidade (id) on delete cascade,
  tipo           text not null,
  -- `on delete set null` nas três: apagar a obra não pode apagar a história.
  obra_id        uuid references public.obra (id) on delete set null,
  funcionario_id uuid references public.funcionario (id) on delete set null,
  fornecedor_id  uuid references public.fornecedor (id) on delete set null,
  inicio         date not null,
  -- NULO = posse aberta.
  fim            date,
  origem         text not null,
  termo_id       uuid references public.termo_equipamento (id) on delete set null,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Uma só posse aberta por peça. Índice PARCIAL, e não constraint, porque é o
-- que permite N posses encerradas convivendo com uma aberta — o mesmo recurso
-- que segura "um orçamento vigente por obra" na 0051. Peça sem linha nenhuma é
-- estado legítimo: é o de todas as peças já cadastradas.
create unique index if not exists idx_custodia_aberta
  on public.custodia_peca (unidade_id) where fim is null;

create index if not exists idx_custodia_unidade on public.custodia_peca (unidade_id);
create index if not exists idx_custodia_org on public.custodia_peca (org_id);
create index if not exists idx_custodia_funcionario
  on public.custodia_peca (funcionario_id) where funcionario_id is not null;
create index if not exists idx_custodia_obra
  on public.custodia_peca (obra_id) where obra_id is not null;

alter table public.custodia_peca drop constraint if exists custodia_tipo_check;
alter table public.custodia_peca add constraint custodia_tipo_check
  check (tipo in ('almoxarifado','obra','funcionario','fornecedor'));

alter table public.custodia_peca drop constraint if exists custodia_origem_check;
alter table public.custodia_peca add constraint custodia_origem_check
  check (origem in ('termo','manual'));

-- Sem este check nasce a linha que diz "funcionário" e aponta para uma obra, e
-- a leitura passa a ter de adivinhar de quem é a posse.
--
-- `tipo = 'funcionario'` admite `obra_id` de propósito: o notebook está com a
-- pessoa, e a pessoa está numa obra. As duas coisas são verdade ao mesmo
-- tempo, e é o que faz a tela "o que está na obra" encontrar o notebook.
alter table public.custodia_peca drop constraint if exists custodia_detentor_coerente;
alter table public.custodia_peca add constraint custodia_detentor_coerente
  check (
    case tipo
      when 'almoxarifado' then obra_id is null and funcionario_id is null and fornecedor_id is null
      when 'obra'         then obra_id is not null and funcionario_id is null and fornecedor_id is null
      when 'funcionario'  then funcionario_id is not null and fornecedor_id is null
      when 'fornecedor'   then fornecedor_id is not null and funcionario_id is null
      else false
    end
  );

alter table public.custodia_peca drop constraint if exists custodia_periodo_check;
alter table public.custodia_peca add constraint custodia_periodo_check
  check (fim is null or fim >= inicio);

-- Posse de funcionário só nasce por termo assinado. No BANCO, e não só na
-- tela: a tela pode estar velha, e o valor do termo é justamente ser a única
-- fonte de verdade sobre quem respondeu pelo equipamento.
alter table public.custodia_peca drop constraint if exists custodia_funcionario_exige_termo;
alter table public.custodia_peca add constraint custodia_funcionario_exige_termo
  check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null));

drop trigger if exists trg_custodia_updated_at on public.custodia_peca;
create trigger trg_custodia_updated_at
  before update on public.custodia_peca
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imutabilidade: só o fechamento pode mudar
-- ---------------------------------------------------------------------------
-- Somente-inclusão com UMA exceção — encerrar uma posse aberta gravando `fim`.
-- A comparação é por jsonb e NÃO lista colunas: coluna acrescentada amanhã
-- fica protegida sem ninguém lembrar de voltar aqui.
create or replace function public.guard_custodia_peca()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Posse não pode ser apagada. Encerre a posse e abra a seguinte.';
  end if;

  if old.fim is not null then
    raise exception 'Esta posse já foi encerrada e não pode ser reaberta.';
  end if;

  if new.fim is null then
    raise exception 'Nada a alterar: só o encerramento da posse pode ser gravado.';
  end if;

  if (to_jsonb(new) - 'fim' - 'updated_at') is distinct from
     (to_jsonb(old) - 'fim' - 'updated_at') then
    raise exception 'Numa posse, só a data de fim pode ser gravada.';
  end if;

  return new;
end;
$$;

-- `from public`, e não só de anon/authenticated: EXECUTE é concedido a PUBLIC
-- por padrão e os dois roles herdam de lá. Revogar só deles retorna sucesso e
-- não revoga nada — foi o incidente da 0.45.1.
revoke execute on function public.guard_custodia_peca() from public;

drop trigger if exists trg_custodia_imutavel on public.custodia_peca;
create trigger trg_custodia_imutavel
  before update or delete on public.custodia_peca
  for each row execute function public.guard_custodia_peca();

-- ---------------------------------------------------------------------------
-- Campos de TI, na PEÇA
-- ---------------------------------------------------------------------------
-- Na peça e não no catálogo: o mesmo "Notebook Dell Latitude 3490" tem
-- unidades com 8 e com 16 GB, e a verdade fica onde as duas divergem.
--
-- `memoria_gb` é coluna própria porque é por ela que se filtra ("quais
-- notebooks têm 8 GB para trocar este ano"). Processador, armazenamento e SO
-- são descritivos e vivem melhor numa linha escrita como o TI já escreve.
--
-- `imei_2` existe porque celular corporativo com dois chips é comum, e o
-- segundo IMEI é o que a operadora pede no bloqueio por roubo.
alter table public.equipamento_unidade
  add column if not exists imei             text,
  add column if not exists imei_2           text,
  add column if not exists linha_telefonica text,
  add column if not exists operadora        text,
  add column if not exists service_tag      text,
  add column if not exists memoria_gb       smallint,
  add column if not exists configuracao     text;

alter table public.equipamento_unidade drop constraint if exists equip_unidade_memoria_check;
alter table public.equipamento_unidade add constraint equip_unidade_memoria_check
  check (memoria_gb is null or (memoria_gb between 1 and 1024));

-- IMEI é único no mundo por definição, e uma linha telefônica está num
-- aparelho só. Índice parcial para não colidir nas peças sem nenhum dos dois.
create unique index if not exists idx_unidade_imei
  on public.equipamento_unidade (org_id, imei) where imei is not null;
create unique index if not exists idx_unidade_linha
  on public.equipamento_unidade (org_id, linha_telefonica) where linha_telefonica is not null;

comment on column public.equipamento_unidade.obra_id is
  'NULO = almoxarifado central. Escrito SÓ pelo escritor de custódia (src/lib/custodia-servidor.ts) e por adicionarUnidade. Histórico em custodia_peca.';

-- ---------------------------------------------------------------------------
-- Perfil de campos da categoria
-- ---------------------------------------------------------------------------
-- Governa quais campos o formulário da peça mostra. Por PERFIL e não pelo
-- nome: acoplar a UI a `nome = 'TI'` quebra quando alguém renomeia para
-- "Tecnologia".
alter table public.categoria_equipamento
  add column if not exists perfil_campos text not null default 'geral';

alter table public.categoria_equipamento drop constraint if exists categoria_perfil_check;
alter table public.categoria_equipamento add constraint categoria_perfil_check
  check (perfil_campos in ('geral','ti'));

-- `update` por nome é aceitável UMA vez, sobre as 8 categorias semeadas em
-- 0055 — é dado conhecido, não regra permanente.
update public.categoria_equipamento set perfil_campos = 'ti' where nome = 'TI';

-- ---------------------------------------------------------------------------
-- Semeadura retroativa a partir dos termos já emitidos
-- ---------------------------------------------------------------------------
-- Hoje há ZERO termos em produção, então este insert é no-op — e é exatamente
-- por isso que tem de ser agora. Dentro de seis meses seria script de correção
-- com termo real em cima.
--
-- Só termo EMITIDO e NÃO cancelado, e só linha com peça: rascunho não entregou
-- nada, e item por quantidade não tem peça a rastrear.
insert into public.custodia_peca
  (org_id, unidade_id, tipo, obra_id, funcionario_id, inicio, fim, origem, termo_id)
select
  t.org_id,
  i.unidade_id,
  'funcionario',
  t.obra_id,
  t.funcionario_id,
  t.data_entrega,
  coalesce(i.data_devolucao, t.encerrado_em::date),
  'termo',
  t.id
from public.termo_equipamento t
join public.termo_equipamento_item i on i.termo_id = t.id
where t.emitido_em is not null
  and t.cancelado_em is null
  and i.unidade_id is not null
  -- Idempotência: reaplicar a migration não duplica linha.
  and not exists (
    select 1 from public.custodia_peca c
    where c.termo_id = t.id and c.unidade_id = i.unidade_id
  );

-- ---------------------------------------------------------------------------
-- RLS — acompanha `equipamento_unidade`, não o escopo por obra
-- ---------------------------------------------------------------------------
-- Leitura livre na organização. É a mesma exceção consciente registrada na
-- spec de frota, pela mesma razão: um gestor precisa ver que a betoneira
-- ESTEVE na Obra B justamente para ir buscá-la, e escopo por obra na leitura
-- tornaria impossível a pergunta que a tela existe para responder.
alter table public.custodia_peca enable row level security;

drop policy if exists "custodia_select" on public.custodia_peca;
create policy "custodia_select" on public.custodia_peca
  for select to authenticated
  using (org_id = (select public.current_org_id()));

drop policy if exists "custodia_insert" on public.custodia_peca;
create policy "custodia_insert" on public.custodia_peca
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- UPDATE liberado na policy e ESTREITADO pela trigger: a policy diz quem pode
-- encostar na linha, a trigger diz o que pode mudar.
drop policy if exists "custodia_update" on public.custodia_peca;
create policy "custodia_update" on public.custodia_peca
  for update to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (org_id = (select public.current_org_id()));

-- Sem policy de DELETE: livro somente-inclusão não tem exclusão nem para o
-- master. A trigger recusaria, e a ausência de policy recusa antes.

drop trigger if exists trg_audit on public.custodia_peca;
create trigger trg_audit after insert or update or delete on public.custodia_peca
  for each row execute function public.registrar_auditoria();

comment on table public.custodia_peca is
  'Livro de custódia da peça, somente-inclusão. Uma linha por período de posse; fim nulo = posse aberta. Escrito só por src/lib/custodia-servidor.ts.';
```

- [ ] **Step 2: Rodar a guarda de segurança das migrations**

Run: `npx vitest run src/lib/migrations-seguranca.test.ts`
Expected: PASS. A migration não cria view e não desliga RLS, então a guarda existente aprova sem alteração.

- [ ] **Step 3: Provar a migration em Postgres local descartável**

Criar o banco com os stubs do que a migration referencia (organizacao, equipamento_unidade, obra, funcionario, fornecedor, termo_equipamento, termo_equipamento_item, categoria_equipamento, `set_updated_at()`, `current_org_id()`, `pode_operar()`, `registrar_auditoria()`), aplicar com `psql -v ON_ERROR_STOP=1`, e provar **nove** comportamentos. Derrubar o banco no fim.

As nove provas, cada uma um `DO` block ou um par insert/expect em transação **própria** — não reaproveite transação, porque a exceção capturada por um `DO` desfaz o insert anterior e o teste seguinte falha pelo motivo errado (foi o que aconteceu ao validar a 0051):

1. Duas posses abertas na mesma peça → recusado por `idx_custodia_aberta`
2. `delete` em qualquer posse → recusado por `trg_custodia_imutavel`
3. `update` numa posse já encerrada → recusado ("não pode ser reaberta")
4. `update` mudando `tipo` junto com `fim` → recusado ("só a data de fim")
5. `update` gravando só `fim` numa posse aberta → **aceito**
6. `tipo = 'funcionario'` com `origem = 'manual'` → recusado por `custodia_funcionario_exige_termo`
7. `tipo = 'obra'` com `funcionario_id` preenchido → recusado por `custodia_detentor_coerente`
8. `fim` anterior a `inicio` → recusado por `custodia_periodo_check`
9. IMEI repetido na mesma organização → recusado por `idx_unidade_imei`

Expected: as nove com o resultado descrito. Se a 5 falhar, a comparação por jsonb está pegando `updated_at` — confirme que os dois campos estão subtraídos.

- [ ] **Step 4: Aplicar em produção**

Aplicar via MCP do Supabase (`apply_migration`, nome `custodia_peca`) — a CLI do Supabase não roda nesta máquina ("Device or resource busy" em toda versão).

- [ ] **Step 5: Verificar o que foi aplicado**

Run, via `execute_sql`:
```sql
select
  (select count(*) from information_schema.columns
     where table_name = 'custodia_peca') as colunas_livro,
  (select count(*) from pg_indexes
     where indexname = 'idx_custodia_aberta') as indice_parcial,
  (select count(*) from information_schema.columns
     where table_name = 'equipamento_unidade' and column_name = 'imei') as coluna_imei,
  (select perfil_campos from public.categoria_equipamento where nome = 'TI') as perfil_ti,
  (select count(*) from public.custodia_peca) as posses_semeadas;
```
Expected: `colunas_livro` 14, `indice_parcial` 1, `coluna_imei` 1, `perfil_ti` `ti`, `posses_semeadas` 0 (não há termo emitido em produção).

- [ ] **Step 6: Rodar o advisor de segurança**

Run: `get_advisors` com `type: "security"`.
Expected: **nenhum lint novo** em relação ao estado atual. O estado atual tem 1 INFO (`numero_sequencia` sem policy) e WARNs pré-existentes de `search_path` e de funções SECURITY DEFINER chamáveis por RPC. Qualquer ERROR é regressão desta migration e tem de ser corrigido antes de seguir.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0059_custodia_peca.sql
git commit -m "feat(db): livro de custódia da peça e campos de TI (0059)

Uma linha por período de posse, fim nulo na aberta, índice único parcial
garantindo uma só posse aberta por peça.

Somente-inclusão com uma exceção: gravar fim numa posse aberta. A guarda
compara to_jsonb(new) - 'fim' - 'updated_at' com o antigo e NÃO lista colunas
— coluna acrescentada amanhã fica protegida sem ninguém voltar aqui.

Posse de funcionário exige origem 'termo' e termo_id, por check. No banco e não
só na tela: a tela pode estar velha, e o valor do termo é ser a única fonte de
verdade sobre quem respondeu pelo equipamento.

Semeadura retroativa dos termos emitidos roda agora que são zero. Em seis meses
seria script de correção com termo real em cima.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `src/lib/custodia-servidor.ts` — o escritor único

**Files:**
- Create: `src/lib/custodia-servidor.ts`
- Modify: `AGENTS.md` (registrar a convenção nova, junto da regra de `src/lib/data/`)

**Interfaces:**
- Consumes: `TipoDetentor` de `src/lib/custodia.ts`; `SupabaseClient` do cliente já criado por quem chama.
- Produces:
  - `type ResultadoCustodia = { ok: true } | { ok: false; erro: string }`
  - `abrirCustodia(supabase, entrada: AberturaCustodia): Promise<ResultadoCustodia>`
  - `fecharCustodia(supabase, { unidadeId, fim }): Promise<ResultadoCustodia>`
  - `type AberturaCustodia = { orgId: string; unidadeId: string; tipo: TipoDetentor; obraId?: string | null; funcionarioId?: string | null; fornecedorId?: string | null; inicio: string; origem: "termo" | "manual"; termoId?: string | null; observacoes?: string | null }`

- [ ] **Step 1: Escrever o arquivo**

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TipoDetentor } from "@/lib/custodia";

// ═══════════════════════════════════════════════════════════════════════════
// O ESCRITOR ÚNICO DO LIVRO DE CUSTÓDIA
// ═══════════════════════════════════════════════════════════════════════════
//
// Por que este arquivo existe, e por que fora de `src/lib/data/`:
//
// O AGENTS.md dá endereço para LEITURA compartilhada (`src/lib/data/`) e não dá
// para ESCRITA compartilhada. Este escritor é chamado de dois grupos de rota —
// `termos/actions.ts` e `frota/actions.ts` — e copiá-lo nos dois é exatamente
// como as duas cópias divergem.
//
// Recebe o `supabase` de quem chama, e não cria o seu: a action já criou um, e
// dois clientes na mesma requisição gastam duas resoluções de sessão. Nunca
// `createAdminClient()` — o isolamento por organização depende de RLS.
//
// MODO DE FALHA DESTA ARQUITETURA: um `.update({ obra_id })` novo em qualquer
// action faz o campo e o livro divergirem sem estourar erro. A varredura de
// `src/lib/custodia-varredura.test.ts` é o que reprova isso no CI.
// ═══════════════════════════════════════════════════════════════════════════

export type ResultadoCustodia = { ok: true } | { ok: false; erro: string };

export type AberturaCustodia = {
  orgId: string;
  unidadeId: string;
  tipo: TipoDetentor;
  obraId?: string | null;
  funcionarioId?: string | null;
  fornecedorId?: string | null;
  /** 'yyyy-mm-dd'. Quem chama passa `hojeISOSaoPaulo()` ou a data do documento. */
  inicio: string;
  origem: "termo" | "manual";
  termoId?: string | null;
  observacoes?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- este projeto
// não tem tipos gerados do Supabase; `data/frota.ts` e `data/termo.ts` fazem o
// mesmo por meio de casts. O tipo do cliente não é o que dá segurança aqui.
type Cliente = SupabaseClient<any, "public", any>;

/**
 * Encerra a posse aberta da peça, se houver.
 *
 * Idempotente de propósito: sem posse aberta não faz nada e NÃO é erro. Quem
 * chama vem de eventos que podem repetir — dois cliques em "encerrar termo",
 * uma devolução registrada duas vezes — e transformar repetição em erro faria
 * a segunda tentativa parecer falha na cara de quem está com o funcionário na
 * frente.
 */
export async function fecharCustodia(
  supabase: Cliente,
  { unidadeId, fim }: { unidadeId: string; fim: string },
): Promise<ResultadoCustodia> {
  const { data: aberta, error: erroLeitura } = await supabase
    .from("custodia_peca")
    .select("id, inicio")
    .eq("unidade_id", unidadeId)
    .is("fim", null)
    .maybeSingle();

  if (erroLeitura) {
    console.error("fecharCustodia/leitura", erroLeitura);
    return { ok: false, erro: "Não foi possível ler a posse atual da peça." };
  }
  if (!aberta) return { ok: true };

  const linha = aberta as unknown as { id: string; inicio: string };

  // O check `fim >= inicio` do banco recusaria com erro cru de Postgres. Aqui
  // a recusa vira frase que quem digitou entende.
  if (fim < linha.inicio) {
    return {
      ok: false,
      erro: `A data informada (${fim}) é anterior ao início desta posse (${linha.inicio}).`,
    };
  }

  const { error } = await supabase
    .from("custodia_peca")
    .update({ fim })
    .eq("id", linha.id);

  if (error) {
    console.error("fecharCustodia/update", error);
    return { ok: false, erro: "Não foi possível encerrar a posse atual." };
  }
  return { ok: true };
}

/**
 * Abre uma posse nova, fechando a anterior na MESMA data.
 *
 * Fechar antes de abrir é o que impede o buraco de um dia entre duas posses —
 * e é obrigatório de todo jeito: o índice único parcial recusa a segunda posse
 * aberta na mesma peça.
 *
 * Também atualiza `equipamento_unidade.obra_id`, que continua existindo porque
 * o filtro e o índice de `/frota` dependem dele. Aqui é o único escritor
 * daquele campo fora de `adicionarUnidade` — duas telas escrevendo a mesma
 * verdade é como se cria divergência silenciosa.
 */
export async function abrirCustodia(
  supabase: Cliente,
  e: AberturaCustodia,
): Promise<ResultadoCustodia> {
  const fechou = await fecharCustodia(supabase, {
    unidadeId: e.unidadeId,
    fim: e.inicio,
  });
  if (!fechou.ok) return fechou;

  const { error } = await supabase.from("custodia_peca").insert({
    org_id: e.orgId,
    unidade_id: e.unidadeId,
    tipo: e.tipo,
    obra_id: e.obraId ?? null,
    funcionario_id: e.funcionarioId ?? null,
    fornecedor_id: e.fornecedorId ?? null,
    inicio: e.inicio,
    origem: e.origem,
    termo_id: e.termoId ?? null,
    observacoes: e.observacoes ?? null,
  });

  if (error) {
    console.error("abrirCustodia/insert", error);
    return { ok: false, erro: "Não foi possível registrar a posse da peça." };
  }

  const { error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .update({ obra_id: e.obraId ?? null })
    .eq("id", e.unidadeId);

  if (erroPeca) {
    // A posse JÁ foi gravada e é a verdade. O campo é cache do livro, e a
    // divergência aparece na tela de Frota, que é onde alguém a resolve.
    console.error("abrirCustodia/cache", erroPeca);
  }

  return { ok: true };
}
```

- [ ] **Step 2: Registrar a convenção no AGENTS.md**

Modificar `AGENTS.md`, na seção "Camada de leitura", logo depois do bloco que
termina com "Fora disso, e **sempre** em `src/lib/data/`, use `createClient()`."
e antes da regra de `security_invoker`:

```markdown
- **Escrita compartilhada entre grupos de rota mora em `src/lib/<dominio>-servidor.ts`**,
  com `import "server-only"` no topo e recebendo o `supabase` de quem chama.
  `src/lib/data/` é só leitura. O primeiro caso é
  `src/lib/custodia-servidor.ts`, chamado por `termos/actions.ts` e por
  `frota/actions.ts`: copiar o escritor nos dois é como as duas cópias
  divergem, e a divergência num livro de custódia aparece como equipamento
  que consta com duas pessoas.
```

- [ ] **Step 3: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 4: Rodar lint**

Run: `npm run lint`
Expected: sem erro. Se o `eslint-disable-next-line` do tipo `Cliente` for
apontado como não usado, é porque a regra `no-explicit-any` não está ativa
neste projeto — remova o comentário em vez de mantê-lo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/custodia-servidor.ts AGENTS.md
git commit -m "feat(custodia): escritor único do livro de posse

abrirCustodia fecha a posse anterior na mesma data antes de abrir a nova — é o
que impede o buraco de um dia entre duas posses, e é obrigatório de todo jeito
porque o índice único parcial recusa a segunda posse aberta.

fecharCustodia é idempotente: sem posse aberta não faz nada e não é erro. Vem
de eventos que repetem (dois cliques em encerrar termo), e transformar
repetição em erro faria a segunda tentativa parecer falha.

Convenção nova registrada no AGENTS.md: escrita compartilhada entre grupos de
rota vive em src/lib/<dominio>-servidor.ts. data/ é só leitura, e não havia
endereço para escrita compartilhada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Ganchos no termo, e a validação de data que faltava

**Files:**
- Modify: `src/app/(app)/termos/actions.ts` — `moverPecasDoTermo` (linha ~161), `registrarDevolucao`, `encerrarTermo`, `cancelarTermo`
- Modify: `src/lib/termo.ts` — `devolucaoItemSchema`
- Test: `src/lib/termo.test.ts` (já existe)

**Interfaces:**
- Consumes: `abrirCustodia`, `fecharCustodia` de `src/lib/custodia-servidor.ts`; `hojeISOSaoPaulo` de `src/lib/locacao.ts`.
- Produces: nenhuma assinatura nova exportada. `devolucaoItemSchema` ganha o campo `data_entrega` (só para validação cruzada, não vai ao banco).

- [ ] **Step 1: Escrever o teste que falha, em `src/lib/termo.test.ts`**

Acrescentar ao fim do arquivo:

```ts
describe("devolucaoItemSchema — data de devolução", () => {
  it("recusa devolução anterior à entrega", () => {
    // Sem isto o check `fim >= inicio` do livro de custódia estoura como erro
    // cru de Postgres na cara do almoxarife.
    const r = devolucaoItemSchema.safeParse({
      item_id: "11111111-2222-4333-8444-555555555555",
      data_entrega: "2026-09-02",
      data_devolucao: "2026-08-28",
      estado_devolucao: "bom",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe(
        "A devolução não pode ser anterior à entrega.",
      );
    }
  });

  it("aceita devolução no mesmo dia da entrega", () => {
    const r = devolucaoItemSchema.safeParse({
      item_id: "11111111-2222-4333-8444-555555555555",
      data_entrega: "2026-09-02",
      data_devolucao: "2026-09-02",
      estado_devolucao: "bom",
    });
    expect(r.success).toBe(true);
  });

  it("sem data de entrega informada, não bloqueia", () => {
    // A validação cruzada só vale quando a outra ponta é conhecida. Bloquear
    // sem referência transformaria dado ausente em erro.
    const r = devolucaoItemSchema.safeParse({
      item_id: "11111111-2222-4333-8444-555555555555",
      data_devolucao: "2026-08-28",
      estado_devolucao: "bom",
    });
    expect(r.success).toBe(true);
  });
});
```

Garantir que `devolucaoItemSchema` está entre os imports do topo do arquivo de
teste; se não estiver, acrescentá-lo.

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npx vitest run src/lib/termo.test.ts`
Expected: FAIL nos dois primeiros casos — hoje o schema aceita qualquer data.

- [ ] **Step 3: Corrigir `devolucaoItemSchema` em `src/lib/termo.ts`**

Substituir o schema atual por:

```ts
/**
 * Devolução de um item do termo.
 *
 * `data_entrega` NÃO vai ao banco: entra só para a validação cruzada. Sem ela,
 * devolução retrodatada passava aqui e estourava adiante no check
 * `fim >= inicio` do livro de custódia, como erro cru de Postgres.
 */
export const devolucaoItemSchema = z
  .object({
    item_id: z.string().uuid(),
    data_entrega: dataOpcional,
    data_devolucao: z.string().min(1, "Informe a data da devolução."),
    estado_devolucao: z.enum(ESTADOS),
    observacoes: textoOpcional(300),
  })
  .refine(
    (v) => v.data_entrega === null || v.data_devolucao >= v.data_entrega,
    {
      message: "A devolução não pode ser anterior à entrega.",
      path: ["data_devolucao"],
    },
  );
```

Comparação de string `'yyyy-mm-dd'` é comparação de data correta e não passa
por fuso nenhum — é o mesmo recurso usado em `intervaloDoMes`.

- [ ] **Step 4: Rodar para confirmar que passa**

Run: `npx vitest run src/lib/termo.test.ts`
Expected: PASS.

- [ ] **Step 5: Passar `data_entrega` no componente de devolução**

Modificar `src/app/(app)/termos/[id]/_components/termo-devolucao.tsx`, na função
`devolver()`. O componente já recebe `itens: TermoItemLinha[]`, mas a data de
entrega é do TERMO, não do item — então acrescentar a prop.

Na assinatura do componente, acrescentar `dataEntrega: string;` ao tipo de
props e ao destructuring. Na chamada de `registrarDevolucao`:

```tsx
        marcadosIds.map((id) => ({
          item_id: id,
          data_entrega: dataEntrega,
          data_devolucao: marcados[id].data,
          estado_devolucao: marcados[id].estado,
        })),
```

E em `src/app/(app)/termos/[id]/page.tsx`, no uso de `<TermoDevolucao>`,
acrescentar:

```tsx
              dataEntrega={termo.data_entrega}
```

- [ ] **Step 6: Ligar o livro em `moverPecasDoTermo`**

Modificar `src/app/(app)/termos/actions.ts`. Acrescentar aos imports:

```ts
import { abrirCustodia, fecharCustodia } from "@/lib/custodia-servidor";
```

Substituir o corpo de `moverPecasDoTermo` pela versão que também escreve o
livro. Ela passa a precisar do termo (funcionário, obra, datas), então lê o
termo junto:

```ts
async function moverPecasDoTermo(termoId: string, momento: "entrega" | "devolucao") {
  const supabase = await createClient();
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return;

  const { data: termo, error: erroTermo } = await supabase
    .from("termo_equipamento")
    .select("funcionario_id, obra_id, data_entrega, encerrado_em, cancelado_em")
    .eq("id", termoId)
    .single();
  if (erroTermo || !termo) {
    console.error("moverPecasDoTermo/termo", erroTermo);
    return;
  }
  const t = termo as unknown as {
    funcionario_id: string;
    obra_id: string | null;
    data_entrega: string;
    encerrado_em: string | null;
    cancelado_em: string | null;
  };

  const { data: itens, error } = await supabase
    .from("termo_equipamento_item")
    .select("unidade_id, data_devolucao, unidade:unidade_id(situacao)")
    .eq("termo_id", termoId)
    .not("unidade_id", "is", null);

  if (error || !itens) {
    console.error("moverPecasDoTermo/leitura", error);
    return;
  }

  type Linha = {
    unidade_id: string;
    data_devolucao: string | null;
    unidade: { situacao: SituacaoPeca } | null;
  };
  const destino: SituacaoPeca = momento === "entrega" ? "em_uso" : "disponivel";

  // Data do fechamento: a do fim do documento, não "hoje". Encerrar em
  // 05/09 um termo cujo encerrado_em é 03/09 gravaria dois dias de posse que
  // não houve. `hojeISOSaoPaulo()` é o último recurso, nunca `new Date()`.
  const fimDoDocumento =
    (t.cancelado_em ?? t.encerrado_em)?.slice(0, 10) ?? hojeISOSaoPaulo();

  for (const l of itens as unknown as Linha[]) {
    const de = l.unidade?.situacao;
    if (!de || !podeTransicionar(de, destino, "evento")) continue;

    const { error: erroUpd } = await supabase
      .from("equipamento_unidade")
      .update({ situacao: destino })
      .eq("id", l.unidade_id);
    if (erroUpd) console.error("moverPecasDoTermo/update", erroUpd);

    if (momento === "entrega") {
      await abrirCustodia(supabase, {
        orgId: perfil.org_id,
        unidadeId: l.unidade_id,
        tipo: "funcionario",
        obraId: t.obra_id,
        funcionarioId: t.funcionario_id,
        inicio: t.data_entrega,
        origem: "termo",
        termoId: termoId,
      });
    } else {
      // Fecha e devolve a peça ao almoxarifado. `origem: "termo"` e não
      // "manual": o evento que produziu esta posse foi o fim de um termo, e é
      // isso que permite a linha do tempo dizer POR QUE a peça voltou.
      await abrirCustodia(supabase, {
        orgId: perfil.org_id,
        unidadeId: l.unidade_id,
        tipo: "almoxarifado",
        inicio: l.data_devolucao ?? fimDoDocumento,
        origem: "termo",
        termoId: termoId,
      });
    }
  }
}
```

Conferir que `hojeISOSaoPaulo` já está importado no arquivo (está — `emitirTermo`
o usa para o ano do número). Conferir que `getCurrentPerfil` já está importado
(está).

- [ ] **Step 7: Ligar o livro em `liberarPecas` (devolução parcial)**

Na mesma `src/app/(app)/termos/actions.ts`, dentro de `liberarPecas`, o loop já
lê a peça e transiciona. Acrescentar, depois do `update` de situação bem
sucedido e dentro do mesmo `for`:

```ts
    // A peça volta ao almoxarifado na data em que foi devolvida — não hoje.
    await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: l.unidade_id,
      tipo: "almoxarifado",
      inicio: l.data_devolucao ?? hojeISOSaoPaulo(),
      origem: "termo",
      termoId,
    });
```

Para isso `liberarPecas` precisa de três coisas que hoje não tem: o `termoId`, o
`perfil`, e a `data_devolucao` de cada linha. Ajustar a assinatura para
`liberarPecas(termoId: string, itemIds: string[])`, incluir
`data_devolucao` no `select`, obter `perfil` com `getCurrentPerfil()` no topo e
retornar cedo se não houver `org_id`. Atualizar a chamada em
`registrarDevolucao` para `await liberarPecas(termoId, devolvidos)`.

- [ ] **Step 8: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro. Se aparecer erro de propriedade inexistente em `l`, o
`select` de `liberarPecas` não recebeu `data_devolucao`.

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, e a contagem de arquivos igual ao que `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l` devolve. Contagem menor significa que o Vitest engoliu um arquivo — rode de novo antes de concluir qualquer coisa.

- [ ] **Step 10: Commit**

```bash
git add src/lib/termo.ts src/lib/termo.test.ts "src/app/(app)/termos/actions.ts" "src/app/(app)/termos/[id]/_components/termo-devolucao.tsx" "src/app/(app)/termos/[id]/page.tsx"
git commit -m "feat(termo): emissão e devolução escrevem o livro de custódia

Emitir abre posse de funcionário na data de entrega; devolver, encerrar e
cancelar fecham e devolvem a peça ao almoxarifado na data do documento — não
em \"hoje\". Encerrar em 05/09 um termo cujo encerramento foi 03/09 gravaria
dois dias de posse que não houve.

A posse de almoxarifado leva origem 'termo' e o termo_id, não 'manual': é o que
permite a linha do tempo dizer POR QUE a peça voltou.

devolucaoItemSchema passa a recusar devolução anterior à entrega. Faltava
independentemente da custódia — e com o check fim >= inicio do livro, passaria
a estourar como erro cru de Postgres na cara do almoxarife.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `src/app/(app)/frota/actions.ts` — o ato de mover, que não existia

**Files:**
- Create: `src/app/(app)/frota/actions.ts`

**Interfaces:**
- Consumes: `moverPecaSchema`, `editarPecaSchema` de `src/lib/custodia.ts`; `abrirCustodia` de `src/lib/custodia-servidor.ts`; `podeTransicionar`, `motivoBloqueio`, `type Situacao` de `src/lib/frota.ts`; `getCurrentPerfil`, `podeOperar`, `podeEditarCadastros` de `src/lib/auth.ts`; `falha`, `primeiroErro`, `type ActionResult` de `src/lib/acoes.ts`.
- Produces:
  - `moverPeca(raw: unknown): Promise<ActionResult>`
  - `editarPeca(raw: unknown): Promise<ActionResult>`
  - `mudarSituacao(formData: FormData): Promise<ActionResult>`

- [ ] **Step 1: Escrever o arquivo**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import { falha, primeiroErro, type ActionResult } from "@/lib/acoes";
import { moverPecaSchema, editarPecaSchema } from "@/lib/custodia";
import { abrirCustodia } from "@/lib/custodia-servidor";
import {
  podeTransicionar,
  motivoBloqueio,
  SITUACOES,
  type Situacao,
} from "@/lib/frota";

/**
 * Move a peça entre almoxarifado, obra e fornecedor em manutenção.
 *
 * Esta action é o ato que NÃO EXISTIA: `adicionarUnidade` gravava situação e
 * obra no cadastro e nenhum caminho humano os alterava depois. O "Onde está"
 * da tela de Frota era um valor digitado uma vez e nunca mais atualizado.
 *
 * `funcionario` não é destino possível — o schema não o aceita. Entregar a
 * pessoa é `/termos/novo`, com assinatura.
 */
export async function moverPeca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeOperar(perfil.papel)) {
    return falha("Você não tem permissão para movimentar peças.");
  }

  const parsed = moverPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();

  const { data: peca, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .select("id, situacao")
    .eq("id", d.unidade_id)
    .single();
  if (erroPeca || !peca) return falha("Peça não encontrada.");

  const de = (peca as unknown as { situacao: Situacao }).situacao;

  // Peça em uso não se move pela Frota: alguém assinou por ela. A matriz de
  // `frota.ts` é a fonte única dessa regra, e a devolução do termo é o
  // caminho.
  const destinoSituacao: Situacao = d.tipo === "fornecedor" ? "manutencao" : "disponivel";
  if (!podeTransicionar(de, destinoSituacao, "manual")) {
    return falha(
      motivoBloqueio(de, destinoSituacao) ??
        "Esta peça não pode ser movimentada na situação atual.",
    );
  }

  const r = await abrirCustodia(supabase, {
    orgId: perfil.org_id,
    unidadeId: d.unidade_id,
    tipo: d.tipo,
    obraId: d.tipo === "obra" ? d.obra_id : null,
    fornecedorId: d.tipo === "fornecedor" ? d.fornecedor_id : null,
    inicio: d.data,
    origem: "manual",
    observacoes: d.observacoes,
  });
  if (!r.ok) return falha(r.erro);

  const { error } = await supabase
    .from("equipamento_unidade")
    .update({ situacao: destinoSituacao })
    .eq("id", d.unidade_id);
  if (error) {
    console.error("moverPeca/situacao", error);
    return falha("A posse foi registrada, mas a situação da peça não mudou.");
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${d.unidade_id}`);
  return { ok: true };
}

/**
 * Edita a peça — e NÃO move.
 *
 * Sem `obra_id` e sem `situacao`, de propósito: os dois mudam só por
 * `moverPeca` e `mudarSituacao`, que passam pelo livro. Um formulário de
 * edição genérico com `obra_id` dentro seria a primeira porta a furar a
 * custódia, e a divergência apareceria em silêncio.
 */
export async function editarPeca(raw: unknown): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Você não tem permissão para editar o cadastro da peça.");
  }

  const parsed = editarPecaSchema.safeParse(raw);
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("equipamento_unidade")
    .update({
      identificador: d.identificador,
      numero_serie: d.numero_serie,
      ano: d.ano,
      estado: d.estado,
      observacoes: d.observacoes,
      imei: d.imei,
      imei_2: d.imei_2,
      linha_telefonica: d.linha_telefonica,
      operadora: d.operadora,
      service_tag: d.service_tag,
      memoria_gb: d.memoria_gb,
      configuracao: d.configuracao,
    })
    .eq("id", d.id);

  if (error) {
    if (error.code === "23505") {
      // Três índices únicos podem colidir aqui, e dizer qual poupa a pessoa de
      // adivinhar entre patrimônio, IMEI e linha.
      const alvo = error.message.includes("imei")
        ? "IMEI"
        : error.message.includes("linha")
          ? "número de linha"
          : "patrimônio";
      return falha(`Já existe outra peça com esse ${alvo}.`);
    }
    console.error("editarPeca", error);
    return falha("Não foi possível salvar as alterações da peça.");
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${d.id}`);
  return { ok: true };
}

/**
 * Baixa, marca como perdida, ou traz de volta a disponível.
 *
 * Situação é condição da peça, não posse: baixar não muda quem está com ela.
 * Por isso esta action NÃO escreve no livro — e é o único caminho que muda
 * `situacao` sem custódia, o que a varredura precisa saber.
 */
export async function mudarSituacao(formData: FormData): Promise<ActionResult> {
  const perfil = await getCurrentPerfil();
  if (!perfil?.org_id) return falha("Sessão inválida. Entre novamente.");
  if (!podeEditarCadastros(perfil.papel)) {
    return falha("Somente master ou administrador pode baixar uma peça.");
  }

  const id = String(formData.get("id") ?? "").trim();
  const paraBruto = String(formData.get("situacao") ?? "").trim();
  if (!id) return falha("Peça inválida.");
  if (!SITUACOES.includes(paraBruto as Situacao)) return falha("Situação inválida.");
  const para = paraBruto as Situacao;

  const supabase = await createClient();
  const { data: peca, error: erroPeca } = await supabase
    .from("equipamento_unidade")
    .select("situacao")
    .eq("id", id)
    .single();
  if (erroPeca || !peca) return falha("Peça não encontrada.");

  const de = (peca as unknown as { situacao: Situacao }).situacao;
  if (!podeTransicionar(de, para, "manual")) {
    return falha(motivoBloqueio(de, para) ?? "Mudança de situação não permitida.");
  }

  const { error } = await supabase
    .from("equipamento_unidade")
    .update({ situacao: para })
    .eq("id", id);
  if (error) {
    console.error("mudarSituacao", error);
    return falha("Não foi possível mudar a situação da peça.");
  }

  revalidatePath("/frota");
  revalidatePath(`/frota/${id}`);
  return { ok: true };
}
```

- [ ] **Step 2: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 3: Auditoria de acentuação**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/frota/actions.ts"
```
Expected: só `numero_serie` e `funcionario`, que são chaves de banco.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/frota/actions.ts"
git commit -m "feat(frota): mover, editar e baixar peça

O ato de mover NÃO EXISTIA: adicionarUnidade gravava situação e obra no
cadastro e nenhum caminho humano os alterava depois. O \"Onde está\" da tela de
Frota era um valor digitado uma vez e nunca mais atualizado — e é por isso que
\"com quem ficou\" era impossível de responder.

moverPeca passa pelo livro de custódia e pela matriz de transição: peça em uso
não se move pela Frota, porque alguém assinou por ela.

editarPeca não tem obra nem situação, de propósito. mudarSituacao muda condição
e não posse, e é o único caminho que altera situacao sem escrever no livro.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `src/lib/data/custodia.ts` — a leitura do detalhe

**Files:**
- Create: `src/lib/data/custodia.ts`

**Interfaces:**
- Consumes: `createClient` de `src/lib/supabase/server`; `type Posse`, `type TipoDetentor` de `src/lib/custodia.ts`; `type Situacao`, `type Propriedade`, `type Estado` de `src/lib/frota.ts`.
- Produces:
  - `type PecaDetalhe` (definido no Step 1)
  - `obterPeca(id: string): Promise<PecaDetalhe | null>`
  - `listarPossesDaPeca(unidadeId: string): Promise<Posse[]>`
  - `listarObrasEFornecedores(): Promise<{ obras: { id: string; rotulo: string }[]; fornecedores: { id: string; nome: string }[] }>`

- [ ] **Step 1: Escrever o arquivo**

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Posse, TipoDetentor } from "@/lib/custodia";
import type { Situacao, Propriedade, Estado } from "@/lib/frota";

export type PecaDetalhe = {
  id: string;
  identificador: string;
  numeroSerie: string | null;
  situacao: Situacao;
  propriedade: Propriedade;
  estado: Estado | null;
  ano: number | null;
  observacoes: string | null;
  itemId: string;
  itemDescricao: string;
  categoriaNome: string | null;
  /** 'geral' | 'ti' — governa se o bloco de campos de TI aparece. */
  perfilCampos: string;
  obraId: string | null;
  obraRotulo: string | null;
  imei: string | null;
  imei2: string | null;
  linhaTelefonica: string | null;
  operadora: string | null;
  serviceTag: string | null;
  memoriaGb: number | null;
  configuracao: string | null;
};

/** Erro em detalhe: devolve null e a página chama `notFound()`. */
export async function obterPeca(id: string): Promise<PecaDetalhe | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamento_unidade")
    .select(
      "id, identificador, numero_serie, situacao, propriedade, estado, ano, observacoes, " +
        "obra_id, item_id, imei, imei_2, linha_telefonica, operadora, service_tag, " +
        "memoria_gb, configuracao, " +
        "item:item_id(descricao, categoria:categoria_id(nome, perfil_campos)), " +
        "obra:obra_id(codigo, nome)",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    if (error) console.error("obterPeca", error);
    return null;
  }

  // Tipagem explícita: este projeto não tem tipos gerados do Supabase, então a
  // inferência do PostgREST é por análise da string do select e cai para
  // `GenericStringError` com join aninhado. Mesmo padrão de `data/termo.ts`.
  const b = data as unknown as Record<string, unknown>;
  const item = b.item as {
    descricao: string;
    categoria: { nome: string; perfil_campos: string } | null;
  } | null;
  const obra = b.obra as { codigo: string; nome: string } | null;

  return {
    id: b.id as string,
    identificador: b.identificador as string,
    numeroSerie: (b.numero_serie as string | null) ?? null,
    situacao: b.situacao as Situacao,
    propriedade: b.propriedade as Propriedade,
    estado: (b.estado as Estado | null) ?? null,
    ano: b.ano === null || b.ano === undefined ? null : Number(b.ano),
    observacoes: (b.observacoes as string | null) ?? null,
    itemId: b.item_id as string,
    itemDescricao: item?.descricao ?? "—",
    categoriaNome: item?.categoria?.nome ?? null,
    perfilCampos: item?.categoria?.perfil_campos ?? "geral",
    obraId: (b.obra_id as string | null) ?? null,
    obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
    imei: (b.imei as string | null) ?? null,
    imei2: (b.imei_2 as string | null) ?? null,
    linhaTelefonica: (b.linha_telefonica as string | null) ?? null,
    operadora: (b.operadora as string | null) ?? null,
    serviceTag: (b.service_tag as string | null) ?? null,
    memoriaGb:
      b.memoria_gb === null || b.memoria_gb === undefined ? null : Number(b.memoria_gb),
    configuracao: (b.configuracao as string | null) ?? null,
  };
}

/**
 * As posses da peça, mais novas primeiro. A ordenação FINAL é de
 * `montarLinhaDoTempo`, que põe a aberta no topo — aqui só garantimos ordem
 * estável antes do cálculo.
 *
 * Erro em lista: registra e devolve vazio.
 */
export async function listarPossesDaPeca(unidadeId: string): Promise<Posse[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custodia_peca")
    .select(
      "id, tipo, inicio, fim, origem, termo_id, observacoes, " +
        "obra:obra_id(codigo, nome), funcionario:funcionario_id(nome), " +
        "fornecedor:fornecedor_id(nome), " +
        "termo:termo_id(numero_registro, cancelado_em)",
    )
    .eq("unidade_id", unidadeId)
    .order("inicio", { ascending: false });

  if (error || !data) {
    if (error) console.error("listarPossesDaPeca", error);
    return [];
  }

  return (data as unknown as Record<string, unknown>[]).map((l) => {
    const obra = l.obra as { codigo: string; nome: string } | null;
    const func = l.funcionario as { nome: string } | null;
    const forn = l.fornecedor as { nome: string } | null;
    const termo = l.termo as {
      numero_registro: string | null;
      cancelado_em: string | null;
    } | null;

    return {
      id: l.id as string,
      tipo: l.tipo as TipoDetentor,
      obraRotulo: obra ? `${obra.codigo} — ${obra.nome}` : null,
      funcionarioNome: func?.nome ?? null,
      fornecedorNome: forn?.nome ?? null,
      inicio: l.inicio as string,
      fim: (l.fim as string | null) ?? null,
      origem: l.origem as "termo" | "manual",
      termoId: (l.termo_id as string | null) ?? null,
      termoNumero: termo?.numero_registro ?? null,
      termoCancelado: Boolean(termo?.cancelado_em),
      observacoes: (l.observacoes as string | null) ?? null,
    };
  });
}

/** Destinos possíveis de uma movimentação, para os selects da tela. */
export async function listarObrasEFornecedores(): Promise<{
  obras: { id: string; rotulo: string }[];
  fornecedores: { id: string; nome: string }[];
}> {
  const supabase = await createClient();
  const [{ data: obras }, { data: fornecedores }] = await Promise.all([
    supabase.from("obra").select("id, codigo, nome").order("codigo"),
    supabase
      .from("fornecedor")
      .select("id, nome")
      .eq("ativo", true)
      .is("deleted_at", null)
      .order("nome"),
  ]);

  return {
    obras: ((obras ?? []) as unknown as { id: string; codigo: string; nome: string }[]).map(
      (o) => ({ id: o.id, rotulo: `${o.codigo} — ${o.nome}` }),
    ),
    fornecedores: (fornecedores ?? []) as unknown as { id: string; nome: string }[],
  };
}
```

- [ ] **Step 2: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro. Se `deleted_at` não existir em `fornecedor`, remover o
`.is("deleted_at", null)` — confirme com
`grep -n "deleted_at" supabase/migrations/*.sql | grep -i fornecedor`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/custodia.ts
git commit -m "feat(custodia): leitura do detalhe da peça e das posses

Tipos de retorno PLANOS, sem expor a ambiguidade T | T[] | null do PostgREST, e
casts explícitos porque este projeto não tem tipos gerados do Supabase — a
inferência é por análise da string do select e cai com join aninhado. Mesmo
padrão de data/termo.ts e data/frota.ts.

Erro em lista devolve vazio; erro em detalhe devolve null e a página chama
notFound().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `/frota/[id]` — a tela da peça

**Files:**
- Create: `src/app/(app)/frota/[id]/page.tsx`
- Create: `src/app/(app)/frota/[id]/_components/peca-mover.tsx`
- Create: `src/app/(app)/frota/[id]/_components/peca-linha-do-tempo.tsx`
- Create: `src/app/(app)/frota/[id]/_components/peca-editar.tsx`
- Create: `src/app/(app)/frota/[id]/_components/peca-situacao.tsx`
- Modify: `src/app/(app)/frota/page.tsx` — o patrimônio da lista passa a ser link

**Interfaces:**
- Consumes: `obterPeca`, `listarPossesDaPeca`, `listarObrasEFornecedores` de `src/lib/data/custodia.ts`; `montarLinhaDoTempo`, `descreverDetentor`, `DETENTOR_INFO` de `src/lib/custodia.ts`; `moverPeca`, `editarPeca`, `mudarSituacao` de `../actions`; `hojeISOSaoPaulo`, `formatarData` de `src/lib/locacao.ts`; `SITUACAO_INFO`, `PROPRIEDADE_INFO`, `ESTADO_INFO`, `transicoesManuais` de `src/lib/frota.ts`.
- Produces: rota `/frota/[id]`.

- [ ] **Step 1: `peca-linha-do-tempo.tsx` — componente de servidor, só apresentação**

```tsx
import { Clock } from "lucide-react";

import { montarLinhaDoTempo, descreverDetentor, DETENTOR_INFO, type Posse } from "@/lib/custodia";
import { formatarData } from "@/lib/locacao";
import { Badge } from "@/components/ui/badge";

/**
 * A linha do tempo da custódia: quem está, quem ficou, por quanto tempo.
 *
 * A posse aberta vem no topo porque a pergunta mais frequente é "onde está
 * AGORA". Período de termo cancelado fica à vista e marcado — documento
 * anulado não some do histórico, e "esteve com o Fulano" é diferente de
 * "houve um termo que não valeu".
 */
export function PecaLinhaDoTempo({ posses, hoje }: { posses: Posse[]; hoje: string }) {
  const linha = montarLinhaDoTempo(posses, hoje);

  if (linha.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sem registro de posse. O histórico começa na primeira movimentação —
        peças cadastradas antes do livro não têm posse retroativa, e inventar
        uma seria registrar um fato que ninguém observou.
      </p>
    );
  }

  return (
    <ol className="divide-y">
      {linha.map((p) => (
        <li key={p.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3">
          <span className="font-medium">{descreverDetentor(p)}</span>

          {p.aberta ? (
            <Badge variant={DETENTOR_INFO[p.tipo].variant}>Agora</Badge>
          ) : null}
          {p.anulada ? <Badge variant="destructive">Termo cancelado</Badge> : null}

          <span className="text-sm tabular-nums text-muted-foreground">
            {formatarData(p.inicio)} — {p.fim ? formatarData(p.fim) : "em aberto"}
          </span>

          <span className="ml-auto flex items-center gap-1 text-sm tabular-nums">
            <Clock className="size-3.5 text-muted-foreground" />
            {p.periodo}
          </span>

          {p.termoNumero ? (
            <span className="w-full text-xs text-muted-foreground">
              Termo {p.termoNumero}
            </span>
          ) : null}
          {p.observacoes ? (
            <span className="w-full text-xs text-muted-foreground">{p.observacoes}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 2: `peca-mover.tsx` — o formulário de movimentação**

Componente cliente, `useActionState` não serve (a action recebe objeto, não
FormData), então estado local com `useTransition`, no padrão de
`termo-devolucao.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";

import { hojeISOSaoPaulo } from "@/lib/locacao";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { moverPeca } from "../../actions";

type Destino = "almoxarifado" | "obra" | "fornecedor";

/**
 * Mover a peça. NÃO oferece "entregar a funcionário": esse caminho é
 * `/termos/novo`, com assinatura — decisão de projeto, não limitação de tela.
 */
export function PecaMover({
  unidadeId,
  obras,
  fornecedores,
}: {
  unidadeId: string;
  obras: { id: string; rotulo: string }[];
  fornecedores: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<Destino>("obra");
  const [obraId, setObraId] = useState("");
  const [fornecedorId, setFornecedorId] = useState("");
  const [data, setData] = useState(hojeISOSaoPaulo());
  const [observacoes, setObservacoes] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  function mover() {
    setErro(null);
    iniciar(async () => {
      const r = await moverPeca({
        unidade_id: unidadeId,
        tipo,
        obra_id: obraId || null,
        fornecedor_id: fornecedorId || null,
        data,
        observacoes: observacoes || null,
      });
      if (!r.ok) return setErro(r.erro);
      setObservacoes("");
      toast.success("Movimentação registrada no histórico da peça.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="destino">Para onde vai</Label>
          <NativeSelect
            id="destino"
            value={tipo}
            disabled={pendente}
            onChange={(e) => setTipo(e.target.value as Destino)}
          >
            <option value="obra">Obra</option>
            <option value="almoxarifado">Almoxarifado central</option>
            <option value="fornecedor">Manutenção em fornecedor</option>
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="data_movimentacao">Data</Label>
          <Input
            id="data_movimentacao"
            type="date"
            value={data}
            disabled={pendente}
            onChange={(e) => setData(e.target.value)}
          />
        </div>

        {tipo === "obra" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="obra_destino">Obra</Label>
            <NativeSelect
              id="obra_destino"
              value={obraId}
              disabled={pendente}
              onChange={(e) => setObraId(e.target.value)}
            >
              <option value="">Selecione a obra…</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        {tipo === "fornecedor" ? (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="fornecedor_destino">Fornecedor</Label>
            <NativeSelect
              id="fornecedor_destino"
              value={fornecedorId}
              disabled={pendente}
              onChange={(e) => setFornecedorId(e.target.value)}
            >
              <option value="">Selecione o fornecedor…</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : null}

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="obs_movimentacao">Observações (opcional)</Label>
          <Input
            id="obs_movimentacao"
            maxLength={300}
            placeholder="Quem levou, em que veículo, o que foi combinado…"
            value={observacoes}
            disabled={pendente}
            onChange={(e) => setObservacoes(e.target.value)}
          />
        </div>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" disabled={pendente} onClick={mover}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Truck className="size-4" />
          )}
          {pendente ? "Registrando…" : "Registrar movimentação"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `peca-editar.tsx` — o cadastro da peça, sem obra e sem situação**

Formulário com `react-hook-form` + `zodResolver` (13 campos e validação de
IMEI, então passa do limiar de 3 campos do AGENTS.md), com
`handleSubmit(onSubmit, aoInvalidar(setErroServidor))` — a rede contra reprovação
silenciosa da 0.39.1. O bloco de TI só é renderizado quando
`perfilCampos === "ti"`.

Assinatura exata, porque a página a chama assim:

```tsx
export function PecaEditar({ peca }: { peca: PecaDetalhe }) {
```

com `import type { PecaDetalhe } from "@/lib/data/custodia";`.

Campos, na ordem: `identificador`, `numero_serie`, `ano`, `estado`,
`observacoes`; e no bloco de TI: `imei`, `imei_2`, `linha_telefonica`,
`operadora`, `service_tag`, `memoria_gb`, `configuracao`.

`defaultValues` mapeia camelCase para snake_case — `numeroSerie` →
`numero_serie`, `imei2` → `imei_2`, `linhaTelefonica` → `linha_telefonica`,
`serviceTag` → `service_tag`, `memoriaGb` → `memoria_gb`. A leitura devolve
camelCase (tipo plano) e o schema espera snake_case (chaves do banco); trocar
um pelo outro faz o formulário abrir vazio sem erro nenhum.

E o campo oculto do `id` usa o valor da peça — nunca `defaultValue: undefined`,
que faz o react-hook-form semear `""` e a validação reprovar o submit em
silêncio. Foi o defeito de sete formulários, corrigido na 0.39.1.

Seguir exatamente a estrutura de `src/app/(app)/itens/item-form.tsx`
(`useForm<EditarPecaInput>`, `resolver: zodResolver(editarPecaSchema)`,
`defaultValues` vindos da peça, `<FormError>{erroServidor}</FormError>` acima
dos botões, erro por campo em `<p className="text-xs text-destructive">`).

- [ ] **Step 4: `peca-situacao.tsx` — baixar, marcar como perdida, ou trazer de volta**

Situação é condição da peça, não posse: baixar não muda quem está com ela, e
por isso este controle NÃO escreve no livro. Os destinos vêm de
`transicoesManuais`, que é a fonte única da regra — digitar a lista aqui faria
esta tela discordar da matriz na primeira mudança.

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArchiveX } from "lucide-react";
import { toast } from "sonner";

import { transicoesManuais, SITUACAO_INFO, type Situacao } from "@/lib/frota";
import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { mudarSituacao } from "../../actions";

export function PecaSituacao({ pecaId, atual }: { pecaId: string; atual: Situacao }) {
  const router = useRouter();
  const destinos = transicoesManuais(atual);
  const [para, setPara] = useState<string>(destinos[0] ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  if (destinos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nesta situação a peça não muda por aqui. Peça em uso volta pela
        devolução do termo — alguém assinou por ela.
      </p>
    );
  }

  function aplicar() {
    setErro(null);
    iniciar(async () => {
      const fd = new FormData();
      fd.set("id", pecaId);
      fd.set("situacao", para);
      const r = await mudarSituacao(fd);
      if (!r.ok) return setErro(r.erro);
      toast.success("Situação da peça atualizada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="nova_situacao">Nova situação</Label>
        <NativeSelect
          id="nova_situacao"
          value={para}
          disabled={pendente}
          onChange={(e) => setPara(e.target.value)}
        >
          {destinos.map((d) => (
            <option key={d} value={d}>
              {SITUACAO_INFO[d].label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <FormError>{erro}</FormError>

      <div className="flex justify-end">
        <Button type="button" variant="secondary" disabled={pendente} onClick={aplicar}>
          {pendente ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArchiveX className="size-4" />
          )}
          {pendente ? "Aplicando…" : "Aplicar"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: `page.tsx` — a página**

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSignature } from "lucide-react";

import { getCurrentPerfil, podeOperar, podeEditarCadastros } from "@/lib/auth";
import {
  obterPeca,
  listarPossesDaPeca,
  listarObrasEFornecedores,
} from "@/lib/data/custodia";
import { descreverDetentor, montarLinhaDoTempo } from "@/lib/custodia";
import { SITUACAO_INFO, PROPRIEDADE_INFO, ESTADO_INFO } from "@/lib/frota";
import { hojeISOSaoPaulo } from "@/lib/locacao";
import { PageHeader } from "@/components/shared/page-header";
import { Campo } from "@/components/shared/campo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PecaLinhaDoTempo } from "./_components/peca-linha-do-tempo";
import { PecaMover } from "./_components/peca-mover";
import { PecaEditar } from "./_components/peca-editar";
import { PecaSituacao } from "./_components/peca-situacao";

export const metadata = { title: "Peça — Loca" };

/**
 * Detalhe da peça: onde está, com quem, desde quando, e o histórico inteiro.
 *
 * `hoje` é resolvido AQUI, com `hojeISOSaoPaulo()`, e desce como prop para o
 * cálculo. Nunca `new Date()`: as datas de posse vêm de coluna `date`, o Vercel
 * roda em UTC, e das 21h à meia-noite em Brasília o tempo de posse sairia um
 * dia maior.
 */
export default async function PecaDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [peca, posses, destinos, perfil] = await Promise.all([
    obterPeca(id),
    listarPossesDaPeca(id),
    listarObrasEFornecedores(),
    getCurrentPerfil(),
  ]);
  if (!peca) notFound();

  const hoje = hojeISOSaoPaulo();
  const linha = montarLinhaDoTempo(posses, hoje);
  const atual = linha.find((p) => p.aberta) ?? null;

  const podeMover = podeOperar(perfil?.papel);
  const podeEditar = podeEditarCadastros(perfil?.papel);
  const info = SITUACAO_INFO[peca.situacao];

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        titulo={peca.identificador}
        descricao={peca.itemDescricao}
        acoes={
          <>
            {/* Entregar a pessoa é o termo, com assinatura — não um botão de
                movimentação aqui. */}
            {podeMover && peca.situacao === "disponivel" ? (
              <Button variant="outline" render={<Link href="/termos/novo" />}>
                <FileSignature className="size-4" />
                Entregar a funcionário
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href="/frota" />}>
              Voltar
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            label="Com quem está"
            destaque
            valor={atual ? descreverDetentor(atual) : "Sem registro de posse"}
          />
          <Campo label="Desde" valor={atual ? atual.periodo : null} />
          <div>
            <p className="text-xs text-muted-foreground">Situação</p>
            <Badge variant={info.variant}>{info.label}</Badge>
          </div>
          <Campo label="Propriedade" valor={PROPRIEDADE_INFO[peca.propriedade].label} />
          <Campo label="Categoria" valor={peca.categoriaNome} />
          <Campo label="Número de série" valor={peca.numeroSerie} />
          <Campo label="Ano" valor={peca.ano} />
          <Campo
            label="Estado"
            valor={peca.estado ? ESTADO_INFO[peca.estado].label : null}
          />
          {peca.perfilCampos === "ti" ? (
            <>
              <Campo label="IMEI" valor={peca.imei} />
              <Campo label="IMEI 2" valor={peca.imei2} />
              <Campo label="Linha" valor={peca.linhaTelefonica} />
              <Campo label="Operadora" valor={peca.operadora} />
              <Campo label="Service tag" valor={peca.serviceTag} />
              <Campo
                label="Memória"
                valor={peca.memoriaGb ? `${peca.memoriaGb} GB` : null}
              />
              <Campo label="Configuração" valor={peca.configuracao} span />
            </>
          ) : null}
          {peca.observacoes ? (
            <Campo label="Observações" valor={peca.observacoes} span />
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de custódia</CardTitle>
        </CardHeader>
        <CardContent>
          <PecaLinhaDoTempo posses={posses} hoje={hoje} />
        </CardContent>
      </Card>

      {podeMover ? (
        <Card>
          <CardHeader>
            <CardTitle>Movimentar</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaMover
              unidadeId={peca.id}
              obras={destinos.obras}
              fornecedores={destinos.fornecedores}
            />
          </CardContent>
        </Card>
      ) : null}

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle>Situação da peça</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaSituacao pecaId={peca.id} atual={peca.situacao} />
          </CardContent>
        </Card>
      ) : null}

      {podeEditar ? (
        <Card>
          <CardHeader>
            <CardTitle>Cadastro da peça</CardTitle>
          </CardHeader>
          <CardContent>
            <PecaEditar peca={peca} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 6: Ligar a lista ao detalhe**

Em `src/app/(app)/frota/page.tsx`, a célula do patrimônio passa a ser link.
Localizar a `<TableCell>` que renderiza `p.identificador` e envolver:

```tsx
                        <Link href={`/frota/${p.id}`} className="hover:underline">
                          {p.identificador}
                        </Link>
```

Conferir que `Link` de `next/link` está importado no arquivo.

- [ ] **Step 7: Rodar typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 8: Rodar lint**

Run: `npm run lint`
Expected: sem erro. Comentário `eslint-disable` dentro de JSX usa a forma
`{/* ... */}`, não `//`.

- [ ] **Step 9: Auditoria de acentuação nas telas novas**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/frota" --include=*.tsx
```
Expected: só `numero_serie`, `numeroSerie` e `funcionario`/`funcionarioNome`.

- [ ] **Step 10: Rodar o build**

Run: `npm run build`
Expected: `✓ Compiled successfully`, e `/frota/[id]` na listagem de rotas.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(app)/frota"
git commit -m "feat(frota): tela da peça com o histórico de custódia

/frota/[id] responde \"onde está, com quem, desde quando\" e mostra a linha do
tempo inteira, com o tempo de cada posse. A posse aberta vem no topo porque a
pergunta mais frequente é sobre AGORA.

\`hoje\` é resolvido na página com hojeISOSaoPaulo() e desce como prop: as datas
de posse vêm de coluna date, o Vercel roda em UTC, e das 21h à meia-noite em
Brasília o tempo de posse sairia um dia maior.

O bloco de campos de TI aparece por PERFIL da categoria, não pelo nome dela —
acoplar a UI a nome = 'TI' quebra quando alguém renomeia para \"Tecnologia\".

Peça sem posse registrada diz isso, e não inventa posse retroativa: seria
registrar um fato que ninguém observou.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: A varredura que mantém o escritor único honesto

**Files:**
- Create: `src/lib/custodia-varredura.test.ts`

**Interfaces:**
- Consumes: nada do código de produção — lê os arquivos do disco.
- Produces: nenhuma. É guarda de CI.

- [ ] **Step 1: Escrever o teste**

```ts
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * VARREDURA — o modo de falha desta arquitetura, reprovado no CI.
 *
 * O livro de custódia só é verdade se `equipamento_unidade.obra_id` tiver UM
 * escritor. Um `.update({ obra_id })` novo em qualquer action faz o campo e o
 * livro divergirem sem estourar erro nenhum, e a divergência num livro de
 * custódia aparece como equipamento que consta com duas pessoas.
 *
 * Este teste não tem lista de arquivos a manter: varre `src/` e exige que os
 * únicos lugares que escrevem `obra_id` ou `situacao` sobre a peça sejam os
 * autorizados abaixo. Arquivo novo entra na varredura por existir.
 */

const RAIZ = join(process.cwd(), "src");

/** Quem pode escrever, e por quê. Acrescentar aqui exige justificar. */
const AUTORIZADOS: Record<string, string> = {
  "lib/custodia-servidor.ts":
    "o escritor único: abrirCustodia grava obra_id como cache do livro",
  "app/(app)/itens/actions.ts":
    "adicionarUnidade — cadastro da peça, antes de existir posse a registrar",
  "app/(app)/frota/actions.ts":
    "moverPeca e mudarSituacao, que passam pelo livro e pela matriz",
  "app/(app)/termos/actions.ts":
    "moverPecasDoTermo e liberarPecas — a situacao por evento de termo",
};

function arquivos(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      arquivos(caminho, acc);
    } else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      acc.push(caminho);
    }
  }
  return acc;
}

function relativo(caminho: string): string {
  return caminho.slice(RAIZ.length + 1).replace(/\\/g, "/");
}

describe("escritor único de custódia", () => {
  const todos = arquivos(RAIZ);

  it("encontra arquivos para varrer", () => {
    // Sem isto o teste passaria por vacuidade se a raiz mudasse de lugar.
    expect(todos.length).toBeGreaterThan(100);
  });

  it("os quatro autorizados existem no disco", () => {
    // Lista que aponta para arquivo apagado é lista que não guarda nada.
    const presentes = new Set(todos.map(relativo));
    for (const a of Object.keys(AUTORIZADOS)) {
      expect(presentes, `autorizado inexistente: ${a}`).toContain(a);
    }
  });

  it("só os autorizados escrevem obra_id ou situacao da peça", () => {
    const infratores: string[] = [];

    for (const caminho of todos) {
      const rel = relativo(caminho);
      if (rel in AUTORIZADOS) continue;

      const src = readFileSync(caminho, "utf8");
      // Só interessa quem escreve NA PEÇA. `from("obra")` e a situação do
      // termo usam os mesmos nomes de campo e não são desta varredura.
      if (!src.includes("equipamento_unidade")) continue;
      if (/\.update\(\s*\{[^}]*\b(obra_id|situacao)\b/s.test(src)) {
        infratores.push(rel);
      }
    }

    expect(
      infratores,
      `Estes arquivos escrevem obra_id/situacao de equipamento_unidade fora do ` +
        `escritor único (src/lib/custodia-servidor.ts). O campo é cache do ` +
        `livro de custódia: escrever direto o faz divergir em silêncio, e a ` +
        `divergência aparece como equipamento que consta com duas pessoas. ` +
        `Use abrirCustodia, ou acrescente o arquivo a AUTORIZADOS com a razão.`,
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e confirmar que passa**

Run: `npx vitest run src/lib/custodia-varredura.test.ts`
Expected: PASS.

- [ ] **Step 3: Provar que a guarda reprova o estado errado**

Acrescentar temporariamente, num arquivo NÃO autorizado que já mencione
`equipamento_unidade` — use `src/lib/data/frota.ts`:

```ts
// PROVA TEMPORÁRIA — remover
async function _prova(supabase: { from: (t: string) => { update: (v: unknown) => unknown } }) {
  return supabase.from("equipamento_unidade").update({ obra_id: null });
}
```

Run: `npx vitest run src/lib/custodia-varredura.test.ts`
Expected: **FAIL**, apontando `lib/data/frota.ts`.

Remover a prova e rodar de novo.
Expected: PASS.

Teste de segurança que nunca foi visto reprovando é teste que passa por
vacuidade — e é o pior tipo.

- [ ] **Step 4: Commit**

```bash
git add src/lib/custodia-varredura.test.ts
git commit -m "test(custodia): varredura do escritor único de obra_id e situacao

O livro só é verdade se equipamento_unidade.obra_id tiver UM escritor. Um
.update({ obra_id }) novo em qualquer action faz o campo e o livro divergirem
sem estourar erro, e num livro de custódia isso aparece como equipamento que
consta com duas pessoas.

Sem lista de arquivos a manter: varre src/ e exige que só os quatro
autorizados escrevam, cada um com a razão registrada. Arquivo novo entra na
varredura por existir.

Verificado que a guarda REPROVA quando um .update solto é acrescentado a
data/frota.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: `termo` na varredura de schemas (independente — pode ser adiada)

Esta tarefa é separável de propósito: pode revelar defeitos pré-existentes nos
schemas do termo e crescer. Rejeitá-la não bloqueia nenhuma outra.

**Files:**
- Modify: `src/lib/schemas-varredura.test.ts`
- Possivelmente: `src/lib/termo.ts`, se a varredura reprovar

**Interfaces:**
- Consumes: os schemas exportados de `src/lib/termo.ts`.
- Produces: nenhuma.

- [ ] **Step 1: Acrescentar o módulo à varredura**

O módulo `termo` **não está** em `MODULOS` — os schemas dele escaparam da
propriedade de idempotência desde a 0.49.0. Acrescentar o import, em ordem
alfabética depois de `recebimento`:

```ts
import * as termo from "./termo";
```

E ao objeto `MODULOS`:

```ts
  termo,
```

- [ ] **Step 2: Rodar e ver o que reprova**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: FAIL listando os schemas de `termo.ts` sem amostra —
`funcionarioSchema`, `termoSchema`, `termoItemSchema`, `devolucaoItemSchema`,
`assinaturaSchema`, `cancelamentoSchema`.

- [ ] **Step 3: Acrescentar as amostras mínimas**

Ao objeto `AMOSTRAS`:

```ts
  funcionarioSchema: { nome: "Fulano de Tal" },
  termoSchema: { funcionario_id: UUID, data_entrega: "2026-09-02" },
  termoItemSchema: {
    item_id: UUID,
    controle: "quantidade",
    quantidade: "1",
    estado_entrega: "bom",
  },
  devolucaoItemSchema: {
    item_id: UUID,
    data_devolucao: "2026-09-02",
    estado_devolucao: "bom",
  },
  assinaturaSchema: { nome: "Fulano de Tal" },
  cancelamentoSchema: { motivo: "Emitido para o funcionário errado." },
```

- [ ] **Step 4: Rodar de novo**

Run: `npx vitest run src/lib/schemas-varredura.test.ts`
Expected: PASS. **Se algum schema de `termo.ts` reprovar a propriedade
`parse(parse(x)) === parse(x)`, o defeito é real** — significa que deixar aquele
campo em branco produz erro cru do zod na tela, que é exatamente o bug que a
varredura existe para pegar. Corrija em `src/lib/termo.ts` trocando o campo pelo
helper de `src/lib/campos.ts` correspondente (`textoOpcional`, `dataOpcional`,
`uuidOpcional`), nunca ajustando a amostra para contornar.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schemas-varredura.test.ts src/lib/termo.ts
git commit -m "test(termo): schemas do termo entram na varredura de idempotência

O módulo termo não estava em MODULOS — os seis schemas dele escaparam da
propriedade parse(parse(x)) === parse(x) desde a 0.49.0. É a propriedade que
impede campo opcional deixado em branco de virar erro cru do zod na tela.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Fechamento — versão 0.50.0, ritual, merge e publicação

**Files:**
- Modify: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: versão `0.50.0` nos três pontos, em sincronia.

- [ ] **Step 1: Bumpar `src/lib/changelog.ts`**

`APP_VERSION` passa a `"0.50.0"`, e um `Release` novo entra no TOPO do array
`CHANGELOG`. MINOR e não PATCH: é funcionalidade nova sem quebrar o que existe.
Texto voltado ao usuário, sem jargão técnico:

```ts
  {
    versao: "0.50.0",
    data: "2026-09-02",
    titulo: "Histórico de quem está com cada equipamento",
    mudancas: [
      { tipo: "novo", texto: "Cada peça agora tem tela própria, com o histórico completo de quem ficou com ela e por quanto tempo. É a tela que responde \"onde está o notebook do Fulano\" e \"quem estava com esta furadeira em julho\"." },
      { tipo: "novo", texto: "Dá para mover a peça entre obras e o almoxarifado, e mandar para manutenção em fornecedor. Antes o \"onde está\" era digitado no cadastro e nunca mais mudava — não havia como registrar que o equipamento saiu." },
      { tipo: "novo", texto: "Campos de celular e computador: IMEI (os dois, para aparelho com dois chips), número da linha, operadora, service tag, memória e configuração. Aparecem só nas peças de TI." },
      { tipo: "novo", texto: "Emitir e devolver termo passa a alimentar o histórico sozinho, na data do documento — não na data em que alguém lançou." },
      { tipo: "seguranca", texto: "Movimentação registrada não pode ser editada nem apagada: corrigir é encerrar a posse e abrir a seguinte, e as duas ficam visíveis. Apagar faria o histórico bater sem que ninguém pudesse explicar a diferença depois." },
      { tipo: "seguranca", texto: "Entregar equipamento a um funcionário exige termo assinado, sempre. Não existe caminho para registrar entrega a pessoa sem documento — é o que sustenta a cobrança por dano ou não devolução." },
      { tipo: "correcao", texto: "A devolução de um item do termo não aceita mais data anterior à da entrega." },
    ],
  },
```

- [ ] **Step 2: Replicar em `CHANGELOG.md`**

Acrescentar a seção `## [0.50.0] — 2026-09-02` acima da `## [0.49.1]`, no
formato Keep a Changelog, com as subseções Adicionado, Corrigido e Segurança, e
uma nota curta sobre o achado que ordenou a fatia: **a peça não podia ser
alterada** — `adicionarUnidade` gravava situação e obra no cadastro e nenhum
caminho humano os alterava depois, então "com quem ficou" não era só falta de
tela, faltava o próprio ato de mover.

- [ ] **Step 3: Bumpar `package.json`**

Campo `version` passa a `"0.50.0"`, igual a `APP_VERSION`.

- [ ] **Step 4: Ritual — typecheck**

Run: `npm run typecheck`
Expected: sem erro.

- [ ] **Step 5: Ritual — lint**

Run: `npm run lint`
Expected: sem erro.

- [ ] **Step 6: Ritual — testes**

Run: `npm test`
Expected: PASS.

Depois, conferir que nenhum arquivo foi engolido:

Run: `find src -name "*.test.ts" -o -name "*.test.tsx" | wc -l`
Expected: o número igual ao "Test Files" do relatório. Se for maior, rode
`npm test` de novo — já houve corrida em que o Vitest reportou 27 arquivos EM
VERDE com 28 no disco.

- [ ] **Step 7: Ritual — build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 8: Revisar o diff**

Run: `git status --short` e `git diff main --stat`
Expected: só os arquivos previstos neste plano. Nenhum arquivo de `docs/` ou de
configuração alterado sem razão.

- [ ] **Step 9: Commit da versão**

```bash
git add src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore(release): 0.50.0 — custódia da peça, fatia 1

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 10: Merge na main e publicação**

```bash
git checkout main
git merge --no-ff feat/custodia-peca -m "Merge branch 'feat/custodia-peca'"
```

Rodar `npm run typecheck` e `npm test` **na main já mesclada** — merge resolvido
à mão é onde fixture de teste fica desatualizada, e já aconteceu neste projeto.

```bash
git push origin main
```

O deploy é automático na Vercel. Depois do deploy, confirmar em `/novidades`
que a versão exibida é `0.50.0`: se for menor, o botão do aviso de variável de
ambiente republicou um commit velho — já desfez um merge aqui em silêncio.

- [ ] **Step 11: Rodar o advisor de segurança uma última vez**

Run: `get_advisors` com `type: "security"`.
Expected: nenhum ERROR. É a verificação que pegou o furo de `security_invoker`
na 0.49.1, e roda depois de toda migration.

---

## Notas para quem executa

**A ordem das tarefas é dependência, não preferência.** A 1 (cálculo puro) não
depende de banco. A 2 (migration) tem de estar aplicada antes da 3, senão o
escritor grava em tabela que não existe. A 4 e a 5 dependem da 3. A 6 e a 7
dependem da 2 e da 5. A 8 depende de todas as anteriores, porque é ela que
verifica o invariante que todas mantêm. A 9 é independente. A 10 é última.

**O que NÃO está nesta fatia**, e não deve ser acrescentado por iniciativa:
detentor atual no bloco Unidades de `/itens/[id]`, tela "o que o funcionário
tem em mãos", e seção de equipamento em `/obras/[id]`. São a Fatia 2, com plano
próprio depois que esta estiver publicada e vista funcionando com dado real.
Também fora: valor de aquisição, nota fiscal, depreciação, capacitação NR, foto,
QR Code e importação por planilha.

**Nenhuma tela desta fatia terá sido vista com dado real** ao fim do plano —
quem implementa não tem login no sistema. O roteiro de homologação existe e
cobre a Frota; a etapa nova de custódia entra nele depois da publicação.
