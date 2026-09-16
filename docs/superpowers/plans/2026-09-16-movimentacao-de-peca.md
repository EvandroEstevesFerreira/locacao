# Movimentação de peça: uma porta só — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** o card "Movimentar" da ficha da peça passa a ser o único lugar onde se mexe na posse, incluindo entregar a uma pessoa.

**Architecture:** uma action `movimentarPeca` que sempre encerra a posse atual (colhendo assinatura quando quem entrega é pessoa) e então roteia pelo destino: obra, almoxarifado e fornecedor gravam a posse direto; funcionário redireciona para `/termos/novo` com peça e pessoa pré-escolhidas. A situação da peça deixa de ser escolha e passa a ser deduzida da posse, exceto `baixada` e `perdida`.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS), TypeScript, zod, vitest, Base UI/shadcn "base-nova", sonner.

**Spec:** `docs/superpowers/specs/2026-09-16-movimentacao-de-peca-design.md` — leia antes da Task 1.

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário.** Auditoria: `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **"Hoje" é sempre `hojeISOSaoPaulo()`** de `src/lib/locacao.ts`, nunca `new Date()`, para data comparada com coluna `date`.
- **Escrita de custódia NUNCA é reimplementada.** Use `fecharCustodia` e `abrirCustodia` de `src/lib/custodia-servidor.ts`. Copiar o escritor é como as duas cópias divergem, e a divergência num livro de custódia aparece como equipamento que consta com duas pessoas. Há varredura cobrando isso: `src/lib/custodia-invariante.test.ts`.
- **`createAdminClient()` nunca toca tabela da aplicação** — só em `src/app/api/cron/*`. Aqui é sempre `createClient()`.
- **Uma action ou redireciona, ou devolve `ActionResult`. Nunca as duas.** Um `redirect()` lança `NEXT_REDIRECT`, então tudo depois do `await` no cliente é código morto. Onde este plano precisa de redirecionamento, quem navega é o **cliente**, com `router.push`, depois de receber `ActionResult`.
- **Schemas zod moram em `src/lib/<dominio>.ts`**, não dentro de `actions.ts`.
- **Composição de componente é `render={<Link/>}`, NUNCA `asChild`.**
- **`--brand` é de uso restrito** (logotipo e badges de crítico). A cor de ação é `--primary`. Nenhum hex literal.
- **Papel que opera a frota:** `podeOperar` de `@/lib/auth`.
- **Ritual:** `npm run typecheck && npm run lint && npm test && npm run build`.
- **Versionamento nos três pontos** (`src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`) — Task 6. Versão-alvo: **0.114.0** (MINOR).
- Estado atual da suíte: **1439 testes em 83 arquivos**, todos verdes.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `src/lib/frota.ts` | **modificar:** ganha `situacaoDaPosse()`, puro |
| `src/lib/frota.test.ts` | **modificar/criar:** testes da dedução |
| `src/app/(app)/termos/actions.ts` | **modificar:** `liberarPecas` para de gravar `termoId` na devolução |
| `src/lib/custodia-invariante.test.ts` | **modificar:** varredura cobra a devolução sem termo |
| `supabase/migrations/0112_posse_de_devolucao_sem_termo.sql` | desamarra a peça `14L4594` |
| `src/lib/custodia.ts` | **modificar:** schema `movimentarPecaSchema` |
| `src/app/(app)/frota/actions.ts` | **modificar:** `moverPeca` vira `movimentarPeca` |
| `src/app/(app)/frota/[id]/_components/peca-mover.tsx` | **modificar:** ganha Funcionário, assinatura e escolha de situação |
| `src/app/(app)/frota/[id]/page.tsx` | **modificar:** saem os dois botões; Observações vira "Importado da planilha" |
| `src/app/(app)/frota/[id]/transferir/` | **excluir:** a pasta inteira |

A ordem das tasks é deliberada: **a limpeza vem primeiro** (Tasks 1–2), porque é pequena, independente e corrige um bug que está em produção agora. Se a onda parar no meio, o que já entrou é ganho.

---

### Task 1: a devolução para de ser creditada ao termo da entrega

**Files:**
- Modify: `src/app/(app)/termos/actions.ts` (função `liberarPecas`, por volta de L858-L918)
- Modify: `src/lib/custodia-invariante.test.ts`

**Interfaces:**
- Consumes: `abrirCustodia` de `@/lib/custodia-servidor`.
- Produces: nada novo. Muda comportamento.

- [ ] **Step 1: ler o invariante que já existe**

Abra `src/lib/custodia-invariante.test.ts` e leia-o inteiro antes de mexer. Ele varre o código em busca de chamadas de `abrirCustodia(` e confere os argumentos. Você vai acrescentar uma asserção no mesmo estilo, não criar um arquivo novo.

Repare se ele tem asserção de **antivacuidade** (conferir que achou os arquivos antes de afirmar algo sobre o conteúdo). Se tiver, mantenha. Se a sua asserção nova puder passar sem encontrar nada, acrescente uma.

- [ ] **Step 2: escrever a asserção que deve falhar**

Acrescente ao arquivo um teste com este espírito — adapte os helpers aos que o arquivo já tem, não invente novos:

```ts
  // A DEVOLUÇÃO NÃO PERTENCE AO TERMO DA ENTREGA.
  //
  // `liberarPecas` abria a posse de almoxarifado passando o `termoId` do termo
  // que estava sendo ENCERRADO naquele instante. A posse nascia apontando para
  // o documento que diz o contrário dela, e o resultado foi a única anomalia do
  // banco: termo encerrado com posse aberta (peça 14L4594, TRM-2026-0040).
  //
  // Medido em 16/09/2026: 1 posse de almoxarifado com termo em 144.
  it("liberarPecas abre a posse de devolução SEM termo", () => {
    const fonte = readFileSync(
      join(process.cwd(), "src", "app", "(app)", "termos", "actions.ts"),
      "utf8",
    );
    const i = fonte.indexOf("export async function liberarPecas");
    expect(i, "liberarPecas sumiu de termos/actions.ts").toBeGreaterThan(-1);

    const corpo = fonte.slice(i, fonte.indexOf("\nexport ", i + 1));
    expect(corpo).toContain('tipo: "almoxarifado"');
    expect(
      /termoId(?!\s*:\s*null)/.test(corpo.slice(corpo.indexOf("abrirCustodia"))),
      "liberarPecas ainda passa termoId para abrirCustodia — a posse de " +
        "devolução nasceria apontando para o termo da entrega, que está sendo " +
        "encerrado no mesmo instante.",
    ).toBe(false);
  });
```

- [ ] **Step 3: rodar e ver falhar**

Run: `npx vitest run src/lib/custodia-invariante.test.ts`
Expected: FAIL, com a mensagem sobre `termoId`.

- [ ] **Step 4: corrigir `liberarPecas`**

Em `src/app/(app)/termos/actions.ts`, na chamada de `abrirCustodia` dentro de `liberarPecas`, troque `termoId,` por nada — a posse de devolução nasce sem termo. Ajuste o comentário logo acima para explicar o porquê:

```ts
    // A peça volta ao almoxarifado na data em que foi devolvida — não hoje.
    //
    // E SEM TERMO. A posse de devolução não pertence ao termo da entrega: ele
    // está sendo encerrado neste instante, e amarrar a posse a ele produz um
    // termo encerrado com posse aberta. Foi a única anomalia do banco em 144
    // posses (peça 14L4594 / TRM-2026-0040), corrigida na migration 0112.
    const r = await abrirCustodia(supabase, {
      orgId: perfil.org_id,
      unidadeId: l.unidade_id,
      tipo: "almoxarifado",
      inicio: l.data_devolucao ?? hojeISOSaoPaulo(),
      origem: "termo",
    });
```

Se o typecheck reclamar que `origem: "termo"` exige `termoId`, **não force um id**: ajuste o tipo `AberturaCustodia` em `src/lib/custodia-servidor.ts` para deixar `termoId` opcional nesse caso, e diga no relatório o que mudou. `termoId` já é `?: string | null` na assinatura, então provavelmente nada será necessário.

- [ ] **Step 5: rodar e ver passar**

Run: `npx vitest run src/lib/custodia-invariante.test.ts && npm test`
Expected: PASS nos dois.

- [ ] **Step 6: commit**

```bash
git add "src/app/(app)/termos/actions.ts" src/lib/custodia-invariante.test.ts
git commit -m "fix(custodia): a devolucao nao pertence ao termo da entrega"
```

---

### Task 2: a migration que desamarra a peça `14L4594`

**Files:**
- Create: `supabase/migrations/0112_posse_de_devolucao_sem_termo.sql`

**Interfaces:**
- Consumes: a correção da Task 1 (sem ela a anomalia voltaria a nascer).
- Produces: nada que código consuma.

- [ ] **Step 1: escrever a migration**

```sql
-- ============================================================================
-- v0.114.0 — A posse de devolução deixa de apontar para o termo da entrega
-- ============================================================================
--
-- `liberarPecas` abria a posse de almoxarifado carregando o `termo_id` do termo
-- que estava sendo ENCERRADO no mesmo instante. A posse nascia apontando para o
-- documento que diz o contrário dela.
--
-- Medido em 16/09/2026 sobre as 144 posses do banco: UMA posse de almoxarifado
-- com termo, e ela é a única anomalia existente — termo `encerrado` com posse
-- ainda aberta (peça 14L4594, TRM-2026-0040). O código foi corrigido junto
-- desta migration; aqui limpa-se o que ele já produziu.
--
-- A POSSE NÃO É APAGADA. A peça ESTÁ no almoxarifado, e isso é verdade. O que
-- sai é a amarração falsa.
--
-- POR CONDIÇÃO, NÃO POR ID LITERAL: id de linha não sobrevive a um restore, e a
-- condição descreve a anomalia em vez de apontar para uma linha específica. Se
-- não houver nenhuma, o UPDATE afeta zero linhas e a migration passa — que é o
-- comportamento certo para um banco já limpo.

update public.custodia_peca c
   set termo_id = null
  from public.termo_equipamento t
 where t.id = c.termo_id
   and c.tipo = 'almoxarifado'
   and c.fim is null;
```

- [ ] **Step 2: conferir que a guarda de segurança das migrations continua passando**

Run: `npx vitest run src/lib/migrations-seguranca.test.ts`
Expected: PASS. Esta migration não cria view, então a regra do `security_invoker` não se aplica.

- [ ] **Step 3: rodar a suíte**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: commit**

```bash
git add supabase/migrations/0112_posse_de_devolucao_sem_termo.sql
git commit -m "fix(custodia): migration desamarra a posse de devolucao do termo"
```

**NÃO aplique a migration no banco.** Quem aplica é o operador humano, com `supabase db push`, fora deste plano.

---

### Task 3: a situação deduzida da posse

**Files:**
- Modify: `src/lib/frota.ts`
- Test: `src/lib/frota.test.ts` (crie se não existir)

**Interfaces:**
- Consumes: os tipos `Situacao` e `TipoDetentor` que o repositório já tem.
- Produces:

```ts
/** O tipo de detentor de uma posse aberta, ou null quando não há posse. */
export type PosseAberta = "almoxarifado" | "obra" | "funcionario" | "fornecedor" | null;

export function situacaoDaPosse(posse: PosseAberta): Situacao;
export function situacaoEhDeduzida(s: Situacao): boolean;
```

- [ ] **Step 1: escrever os testes que devem falhar**

Em `src/lib/frota.test.ts` (acrescente ao arquivo se ele já existir):

```ts
import { describe, it, expect } from "vitest";
import { situacaoDaPosse, situacaoEhDeduzida, SITUACOES } from "./frota";

describe("situacaoDaPosse", () => {
  it("sem posse aberta, a peça está disponível", () => {
    expect(situacaoDaPosse(null)).toBe("disponivel");
  });

  it("no almoxarifado a peça está disponível — é lá que ela espera", () => {
    expect(situacaoDaPosse("almoxarifado")).toBe("disponivel");
  });

  it("com pessoa ou em obra, está em uso", () => {
    expect(situacaoDaPosse("funcionario")).toBe("em_uso");
    expect(situacaoDaPosse("obra")).toBe("em_uso");
  });

  it("em fornecedor, está em manutenção", () => {
    // O destino se chama "Manutenção em fornecedor", e `moverPeca` já gravava
    // `manutencao` para ele desde antes desta função existir.
    expect(situacaoDaPosse("fornecedor")).toBe("manutencao");
  });
});

describe("situacaoEhDeduzida", () => {
  it("disponivel, em_uso e manutencao saem da posse", () => {
    expect(situacaoEhDeduzida("disponivel")).toBe(true);
    expect(situacaoEhDeduzida("em_uso")).toBe(true);
    expect(situacaoEhDeduzida("manutencao")).toBe(true);
  });

  it("baixada e perdida são decisão humana", () => {
    // Não se deduzem de posse nenhuma: uma peça baixada pode estar em qualquer
    // lugar, e uma perdida não está em lugar que se saiba.
    expect(situacaoEhDeduzida("baixada")).toBe(false);
    expect(situacaoEhDeduzida("perdida")).toBe(false);
  });

  it("cobre todas as situações que existem", () => {
    // SEM ISTO O TESTE ENVELHECE EM SILÊNCIO: uma situação nova entraria em
    // SITUACOES e ninguém decidiria se ela é deduzida ou escolhida.
    for (const s of SITUACOES) {
      expect(typeof situacaoEhDeduzida(s)).toBe("boolean");
    }
    expect(SITUACOES.length).toBe(5);
  });
});
```

- [ ] **Step 2: rodar e ver falhar**

Run: `npx vitest run src/lib/frota.test.ts`
Expected: FAIL — `situacaoDaPosse` não existe.

- [ ] **Step 3: implementar em `src/lib/frota.ts`**

Acrescente ao arquivo, perto de `SITUACOES`:

```ts
/** O tipo de detentor da posse aberta, ou `null` quando não há posse. */
export type PosseAberta = "almoxarifado" | "obra" | "funcionario" | "fornecedor" | null;

/**
 * A situação da peça, DEDUZIDA de com quem ela está.
 *
 * A matriz de transições já dizia metade disto: passar para `em_uso` à mão é
 * proibido, com a mensagem "«Em uso» é definido pelo termo de
 * responsabilidade, não à mão". Esta função é a outra metade — o repositório
 * já acreditava que a situação era consequência, e agora ela é calculada em
 * vez de digitada.
 *
 * Deixar o usuário escolher `disponivel` ou `em_uso` é o que permitia a linha
 * que diz "Em uso" com a peça no almoxarifado, sem nada na tela denunciando.
 */
export function situacaoDaPosse(posse: PosseAberta): Situacao {
  if (posse === null || posse === "almoxarifado") return "disponivel";
  if (posse === "fornecedor") return "manutencao";
  return "em_uso";
}

/**
 * Esta situação é calculada da posse, ou escolhida por uma pessoa?
 *
 * `baixada` e `perdida` não se deduzem: uma peça baixada pode estar em
 * qualquer lugar, e uma perdida não está em lugar que se saiba. As outras três
 * são consequência de onde a peça está.
 */
export function situacaoEhDeduzida(s: Situacao): boolean {
  return s === "disponivel" || s === "em_uso" || s === "manutencao";
}
```

- [ ] **Step 4: rodar e ver passar**

Run: `npx vitest run src/lib/frota.test.ts && npm test`
Expected: PASS nos dois.

- [ ] **Step 5: commit**

```bash
git add src/lib/frota.ts src/lib/frota.test.ts
git commit -m "feat(frota): a situacao da peca passa a sair da posse"
```

---

### Task 4: a action única `movimentarPeca`

**Files:**
- Modify: `src/lib/custodia.ts` (o schema)
- Modify: `src/app/(app)/frota/actions.ts` (substitui `moverPeca`)

**Interfaces:**
- Consumes: `situacaoDaPosse` da Task 3; `fecharCustodia`/`abrirCustodia` de `@/lib/custodia-servidor`. E estas duas de `../termos/actions`, com as assinaturas **exatas** — não as adivinhe:

```ts
registrarDevolucao(
  termoId: string,
  itens: {
    item_id: string;
    data_devolucao: string;      // "YYYY-MM-DD"
    estado_devolucao: string;
    observacoes?: string;        // opcional, e é `undefined`, não `null`
  }[],
): Promise<ActionResult>

encerrarTermo(
  termoId: string,
  assinaturas: {
    funcionario: { nome: string; cpf: string | null; imagem: string | null };
    empresa: { nome: string; imagem: string | null };
  },
  motivoSemAssinatura?: string | null,   // confira o nome real do 3º parâmetro no arquivo
): Promise<ActionResult>
```

O terceiro parâmetro de `encerrarTermo` existe porque 211 pessoas da base estão desligadas, e uma que saiu com um notebook não volta para assinar. Exigir a assinatura ali não protegeria ninguém — só impediria o registro da verdade. Leia o comentário no arquivo antes de usá-lo.
- Produces:

```ts
// em src/lib/custodia.ts
export const movimentarPecaSchema: z.ZodType<{
  unidade_id: string;
  tipo: "almoxarifado" | "obra" | "fornecedor" | "funcionario";
  obra_id: string | null;
  fornecedor_id: string | null;
  funcionario_id: string | null;
  data: string;              // "YYYY-MM-DD"
  observacoes: string | null;
  situacao_final: "disponivel" | "baixada" | "perdida" | null;
  estado_devolucao: string | null;
  assinatura_devolucao: string | null;
  motivo_sem_assinatura: string | null;
}>;

// em src/app/(app)/frota/actions.ts
export async function movimentarPeca(raw: unknown): Promise<ActionResult>;
```

O `ActionResult` de sucesso devolve `{ ok: true, id: <unidade_id> }`. **A action não redireciona** — quem navega é o cliente, com `router.push`, quando o destino é funcionário.

- [ ] **Step 1: ler o que já existe antes de escrever**

Leia, nesta ordem, e não pule:
- `src/app/(app)/frota/actions.ts`, a função `moverPeca` (L35-L101) — é o que você está substituindo.
- `src/app/(app)/frota/[id]/transferir/actions.ts`, a função `devolverParaTransferir` — ela já faz corretamente a metade da devolução, **incluindo descobrir o termo no servidor em vez de aceitá-lo do cliente**. Essa decisão é de segurança: aceitar `termo_id` do cliente permitiria encerrar o termo de outra peça, e encerrar termo alheio devolve para `disponivel` equipamento que está legitimamente com alguém. **Preserve isso.**
- `src/lib/custodia.ts`, o `transferirCustodiaSchema` — o schema novo é uma extensão dele.

- [ ] **Step 2: escrever o schema em `src/lib/custodia.ts`**

Siga o estilo dos schemas que já estão no arquivo. O schema precisa de validação cruzada, com `superRefine` ou `refine`:

- `tipo === "obra"` exige `obra_id`, mensagem **"Selecione a obra de destino."**
- `tipo === "fornecedor"` exige `fornecedor_id`, mensagem **"Selecione o fornecedor."**
- `tipo === "funcionario"` exige `funcionario_id`, mensagem **"Selecione quem vai receber a peça."**
- `situacao_final`, quando vier preenchida, só aceita `"disponivel"`, `"baixada"` ou `"perdida"` — nunca `em_uso` nem `manutencao`, que são deduzidas. Mensagem: **"Esta situação é definida pela posse, não escolhida."**

- [ ] **Step 3: escrever o teste do schema**

Em `src/lib/custodia.test.ts` (crie se não existir; se existir, acrescente):

```ts
import { describe, it, expect } from "vitest";
import { movimentarPecaSchema } from "./custodia";

const base = {
  unidade_id: "11111111-1111-1111-1111-111111111111",
  tipo: "almoxarifado" as const,
  obra_id: null,
  fornecedor_id: null,
  funcionario_id: null,
  data: "2026-09-16",
  observacoes: null,
  situacao_final: null,
  estado_devolucao: null,
  assinatura_devolucao: null,
  motivo_sem_assinatura: null,
};

describe("movimentarPecaSchema", () => {
  it("aceita a volta ao almoxarifado sem mais nada", () => {
    expect(movimentarPecaSchema.safeParse(base).success).toBe(true);
  });

  it("obra sem obra_id é recusada", () => {
    const r = movimentarPecaSchema.safeParse({ ...base, tipo: "obra" });
    expect(r.success).toBe(false);
  });

  it("funcionário sem funcionario_id é recusado", () => {
    const r = movimentarPecaSchema.safeParse({ ...base, tipo: "funcionario" });
    expect(r.success).toBe(false);
  });

  it("recusa situação deduzida vinda do cliente", () => {
    // `em_uso` e `manutencao` saem da posse. Aceitá-las aqui deixaria o cliente
    // gravar uma situação que contradiz onde a peça está — a divergência que
    // este trabalho inteiro existe para fechar.
    for (const s of ["em_uso", "manutencao"]) {
      const r = movimentarPecaSchema.safeParse({ ...base, situacao_final: s });
      expect(r.success, `${s} deveria ser recusada`).toBe(false);
    }
  });

  it("aceita baixada e perdida, que são decisão humana", () => {
    for (const s of ["disponivel", "baixada", "perdida"]) {
      const r = movimentarPecaSchema.safeParse({ ...base, situacao_final: s });
      expect(r.success, `${s} deveria ser aceita`).toBe(true);
    }
  });
});
```

- [ ] **Step 4: rodar e ver falhar**

Run: `npx vitest run src/lib/custodia.test.ts`
Expected: FAIL — `movimentarPecaSchema` não existe.

- [ ] **Step 5: implementar `movimentarPeca` em `src/app/(app)/frota/actions.ts`**

Substitua `moverPeca` por `movimentarPeca`. A sequência, com um comentário em português explicando cada porquê:

1. **Guardas:** `getCurrentPerfil`, `exigirModulo(perfil, "frota")`, `podeOperar(perfil.papel)`. Mensagem de negação: **"Você não tem permissão para movimentar peças."**
2. **Parse** com `movimentarPecaSchema`.
3. **Ler a posse aberta** da peça: `custodia_peca` com `unidade_id = d.unidade_id` e `fim is null`, trazendo `tipo` e `termo_id`. Guarde em `posseAtual` (pode ser `null` — peça sem posse é estado legítimo, é o de todas as peças já cadastradas).
4. **Se `posseAtual?.tipo === "funcionario"`:** devolver antes de mover. Descubra o termo **no servidor**, a partir da posse — nunca do cliente — e chame `registrarDevolucao` + `encerrarTermo` exatamente como `devolverParaTransferir` faz hoje. Se qualquer um falhar, devolva o `ActionResult` de falha e **não mova a posse**: mover sem encerrar o termo deixaria a peça no almoxarifado com termo aberto dizendo que está com a pessoa.
5. **Abrir a posse nova** com `abrirCustodia`, exceto quando o destino é funcionário — aí a posse de destino nasce na emissão do termo, e o que esta action faz é deixar a peça disponível. Para destino funcionário, abra posse de `almoxarifado` (é onde ela está enquanto o termo não sai) e deixe o cliente navegar.
6. **Gravar a situação.** Use `situacaoDaPosse(<tipo da posse que ficou aberta>)`, a não ser que `d.situacao_final` seja `baixada` ou `perdida` — nesse caso ela vence, porque é decisão humana que não se deduz.
7. `revalidatePath("/frota")` e `revalidatePath(\`/frota/${d.unidade_id}\`)`.
8. Devolver `{ ok: true, id: d.unidade_id }`.

**Sobre a matriz de transições:** `moverPeca` hoje chama `podeTransicionar` e recusa mexer em peça `em_uso` — *"Peça em uso não se move pela Frota: alguém assinou por ela"*. Essa guarda existia porque a action não sabia encerrar termo. Agora ela sabe, então a recusa sai **para o caminho que passa pela devolução**. Mantenha `podeTransicionar` para `baixada` e `perdida`, que continuam sendo transições manuais e continuam precisando da matriz.

- [ ] **Step 6: rodar e ver passar**

Run: `npx vitest run src/lib/custodia.test.ts && npm run typecheck && npm test`
Expected: PASS nos três.

Se algum teste existente quebrar por causa da remoção de `moverPeca`, **atualize o teste** — não recrie a função antiga como casca.

- [ ] **Step 7: commit**

```bash
git add src/lib/custodia.ts src/lib/custodia.test.ts "src/app/(app)/frota/actions.ts"
git commit -m "feat(frota): uma action so para toda movimentacao de peca"
```

---

### Task 5: o formulário

**Files:**
- Modify: `src/app/(app)/frota/[id]/_components/peca-mover.tsx`
- Modify: `src/app/(app)/frota/[id]/page.tsx`

**Interfaces:**
- Consumes: `movimentarPeca` da Task 4; `situacaoDaPosse` da Task 3.
- Produces: o card "Movimentar" com quatro destinos.

- [ ] **Step 1: ler os dois formulários que existem**

Leia `peca-mover.tsx` (o card de hoje) e `src/app/(app)/frota/[id]/transferir/transferir-form.tsx`. O card novo é a **união** dos dois: os destinos do primeiro mais a devolução assinada do segundo. Reaproveite o `SignaturePad` de `@/components/shared/signature-pad`, que o `transferir-form.tsx` já usa.

- [ ] **Step 2: acrescentar o destino Funcionário**

`type Destino` passa a incluir `"funcionario"`. A ordem das opções no select, exatamente esta:

```tsx
<option value="funcionario">Funcionário</option>
<option value="obra">Obra</option>
<option value="almoxarifado">Almoxarifado central</option>
<option value="fornecedor">Manutenção em fornecedor</option>
```

Com `tipo === "funcionario"`, mostrar um `NativeSelect` de funcionários, rótulo **"Quem vai receber"**, com a opção vazia **"Selecione a pessoa…"**. A lista de funcionários vem da página como prop `funcionarios: { id: string; nome: string }[]` — acrescente a consulta em `page.tsx` seguindo o padrão das consultas de `obras` e `fornecedores` que já estão lá.

- [ ] **Step 3: a devolução assinada, quando a peça sai de uma pessoa**

A página passa a informar ao card com quem a peça está, via prop:

```tsx
posseAtual: { tipo: string; nome: string | null } | null
```

Quando `posseAtual?.tipo === "funcionario"`, o card mostra, **acima** do destino, um bloco com o título **"Devolução"** contendo:

- texto **"<nome> está com esta peça. Registre a devolução para movimentá-la."**
- `NativeSelect` de estado, rótulo **"Estado na devolução"**, com as opções de `ESTADOS`/`ESTADO_INFO` de `@/lib/frota` (é o que o `transferir-form.tsx` faz);
- o `SignaturePad` para quem devolve;
- um `Input` de texto, rótulo **"Motivo de não assinar (opcional)"**, placeholder **"A pessoa não está presente, por exemplo."**

**Não bloqueie o envio por falta de assinatura** — o campo de motivo existe exatamente para o caso de a pessoa não estar presente, e é assim que o `transferir-form.tsx` já trata.

- [ ] **Step 4: a escolha de situação na devolução**

Quando há posse a encerrar (ou seja, `posseAtual !== null`) **e** o destino é `almoxarifado`, mostrar um `NativeSelect` com rótulo **"Como ela volta"**:

```tsx
<option value="disponivel">Disponível para uso</option>
<option value="baixada">Baixada</option>
<option value="perdida">Perdida</option>
```

Esse é o `situacao_final` do schema. Nos outros destinos, não mostrar — a situação sai da posse.

- [ ] **Step 5: a navegação depois do sucesso**

```tsx
      if (!r.ok) return setErro(r.erro);
      if (r.aviso) toast.warning(r.aviso);
      else toast.success("Movimentação registrada no histórico da peça.");

      // DESTINO PESSOA CONTINUA EM DUAS ASSINATURAS, e é de propósito: a
      // devolução foi assinada aqui, a entrega é assinada no termo, que pede
      // CPF, previsão e a assinatura da empresa. O que esta tela resolve é a
      // pessoa não precisar mais descobrir sozinha qual botão apertar.
      if (tipo === "funcionario") {
        router.push(`/termos/novo?peca=${unidadeId}&funcionario=${funcionarioId}`);
        return;
      }
      setObservacoes("");
      setData(hojeISOSaoPaulo());
      router.refresh();
```

- [ ] **Step 6: tirar os dois botões antigos da ficha**

Em `src/app/(app)/frota/[id]/page.tsx`, remova o botão **"Transferir custódia"** e o botão **"Novo termo"** do cabeçalho. Remova também os comentários que explicavam as condições deles — eles descrevem um mundo que deixou de existir, e comentário que mente é pior que comentário nenhum. No lugar, um comentário curto dizendo que a movimentação inteira vive no card abaixo.

- [ ] **Step 7: auditoria de PT-BR e ritual**

Run:
```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" "src/app/(app)/frota" --include=*.tsx
```
Expected: só identificadores. Qualquer texto visível sem acento é erro.

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo PASS.

- [ ] **Step 8: commit**

```bash
git add "src/app/(app)/frota/[id]"
git commit -m "feat(frota): o card Movimentar vira a porta unica"
```

---

### Task 6: apagar a rota antiga, o texto da planilha, e a versão

**Files:**
- Delete: `src/app/(app)/frota/[id]/transferir/` (a pasta inteira)
- Modify: `src/app/(app)/frota/[id]/page.tsx` (as Observações)
- Modify: `src/lib/changelog.ts`, `CHANGELOG.md`, `package.json`

- [ ] **Step 1: apagar a rota**

```bash
git rm -r "src/app/(app)/frota/[id]/transferir"
```

Depois, `npm run typecheck` para achar qualquer import que tenha ficado apontando para lá. Se `devolverParaTransferir` era importada por outro arquivo, esse import tem de sumir junto — a lógica dela vive agora em `movimentarPeca`.

- [ ] **Step 2: as Observações herdadas da planilha**

Na ficha, o campo Observações mostra hoje textos como *"Com: Andre Piva (conforme planilha) · Departamento: DIRETORIA · Garantia: Expirada 23 OUT. 2027"* — que contradizem o livro de custódia e não são atualizados por nada.

**Não apague o dado.** Mude a exibição: o campo passa a ter o rótulo **"Importado da planilha"** em vez de "Observações", com um texto de apoio em `text-muted-foreground` e `text-xs`: **"Texto da carga inicial. Não é atualizado pelo sistema — o histórico de custódia abaixo é a fonte atual."**

Se o campo for usado para observações digitadas no Loca, e não só para o texto importado, **não mude o rótulo às cegas** — verifique antes se `equipamento_unidade` tem uma coluna separada para a carga inicial. Se não tiver, mantenha "Observações" e apenas acrescente o texto de apoio. Relate o que encontrou.

- [ ] **Step 3: bumpar a versão para `0.114.0`**

MINOR: funcionalidade nova sem quebrar o que existe.

- `src/lib/changelog.ts`: `APP_VERSION = "0.114.0"` e um `Release` novo no topo, data `2026-09-16`. Itens em texto de usuário, sem jargão. Por exemplo: *"Movimentar uma peça agora tem um lugar só: escolha para onde ela vai, inclusive para uma pessoa."*, *"Ao devolver uma peça ao almoxarifado, você escolhe se ela volta disponível, baixada ou perdida."* e *"A situação da peça passa a acompanhar sozinha onde ela está."*
- `CHANGELOG.md`: o mesmo resumo em Keep a Changelog, com uma seção `### Corrigido` registrando a devolução que era creditada ao termo da entrega.
- `package.json`: `"version": "0.114.0"`.

- [ ] **Step 4: conferir a sincronia**

Run: `node -e "const p=require('./package.json');const s=require('fs').readFileSync('src/lib/changelog.ts','utf8');console.log(p.version, s.includes('APP_VERSION = \"'+p.version+'\"')?'ok':'DIVERGENTE')"`
Expected: `0.114.0 ok`

- [ ] **Step 5: ritual completo**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: tudo PASS.

- [ ] **Step 6: atualizar a spec e commitar**

Em `docs/superpowers/specs/2026-09-16-movimentacao-de-peca-design.md`, atualize a seção **Estado da implementação** para 100%, listando o que ficou fora de escopo de propósito.

```bash
git add -u && git add src/lib/changelog.ts CHANGELOG.md package.json docs/
git commit -m "chore: v0.114.0 — a porta unica de movimentacao de peca"
```

---

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Movimentação de peça | Spec e plano escritos | Tasks 1 a 6 | 15% |

Próximo passo único: executar a Task 1.
