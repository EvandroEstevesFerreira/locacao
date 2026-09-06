# Inventário de TI — Fase A: e-mail do funcionário e a chave da ficha

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao funcionário um e-mail com estado de confirmação, e corrigir o
gerador de chave da ficha, que hoje grava a primeira letra do rótulo.

**Architecture:** Duas correções independentes que a fase B precisa prontas. A
regra de derivação do e-mail e a regra de "a chave segue o rótulo" viram
**funções puras** em `src/lib/`, testadas sem DOM — o Vitest deste projeto roda
em `environment: "node"` e não tem `@testing-library/react`. Os componentes
apenas chamam essas funções.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase (Postgres
+ RLS), Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-inventario-ti-design.md`

## Global Constraints

- **PT-BR acentuado em toda string visível ao usuário.** Rótulo, placeholder,
  toast, mensagem de erro de action. Auditoria antes de fechar:
  `grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" src/app src/components --include=*.tsx`
- **Schemas zod moram em `src/lib/<dominio>.ts`**, nunca dentro de `actions.ts`:
  um arquivo `"use server"` não pode ser importado por componente cliente.
- **Todo schema opcional usa os helpers de `src/lib/campos.ts`.** `parse(parse(x))`
  precisa dar `parse(x)`; `src/lib/schemas-varredura.test.ts` varre e cobra isso
  de todo schema exportado por convenção de nome.
- **Retorno de action é `ActionResult` de `src/lib/acoes.ts`.** Uma action ou
  redireciona, ou devolve `ActionResult` — nunca as duas.
- **Ritual de fechamento:** `npm run typecheck && npm run lint && npm test && npm run build`.
- **Versão nos três pontos:** `src/lib/changelog.ts` (`APP_VERSION` + `CHANGELOG`),
  `CHANGELOG.md`, `package.json`. Esta fase é a **0.69.0**.
- **Migrations aplicadas com `npx supabase db query --linked -f <arquivo>`**, não
  `db push` — e conferir `npx supabase migration list` antes.
  Depois: `npx supabase migration repair --linked --status applied <nnnn>`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0073_chave_da_ficha.sql` | Reescreve as chaves de uma letra já gravadas |
| `supabase/migrations/0074_email_do_funcionario.sql` | `email` + `email_confirmado` + índice único |
| `src/lib/catalogo.ts` | + `CampoEmEdicao`, `comRotulo`, `paraGravar` — a regra "a chave segue o rótulo" |
| `src/lib/catalogo.test.ts` | + testes que digitam o rótulo caractere a caractere |
| `src/app/(app)/configuracoes/catalogo/ficha-editor.tsx` | Passa a usar as funções puras; some o `novo = campo.chave === ""` |
| `src/lib/termo.ts` | + `emailDerivado`, `confirmacaoDoEmail`, `email` no `funcionarioSchema` |
| `src/lib/termo.test.ts` | + testes da derivação e da confirmação |
| `src/app/(app)/termos/actions.ts` | `salvarFuncionario` aplica a regra de confirmação |
| `src/app/(app)/termos/funcionarios/funcionario-form.tsx` | Campo de e-mail + caixa de confirmação |
| `src/app/(app)/termos/funcionarios/page.tsx` | Coluna E-mail com aviso de não confirmado |
| `src/lib/data/termo.ts` | `FuncionarioLinha` ganha `email` e `email_confirmado` |

---

## Task 1: A chave da ficha segue o rótulo inteiro

**Files:**
- Modify: `src/lib/catalogo.ts`
- Modify: `src/lib/catalogo.test.ts`
- Modify: `src/app/(app)/configuracoes/catalogo/ficha-editor.tsx:180-204`
- Create: `supabase/migrations/0073_chave_da_ficha.sql`

**Interfaces:**
- Consumes: `chaveDeRotulo(rotulo: string): string` e `type CampoFicha`, ambos já
  exportados por `src/lib/catalogo.ts`.
- Produces:
  - `type CampoEmEdicao = CampoFicha & { gravado: boolean }`
  - `function campoNovo(): CampoEmEdicao`
  - `function comRotulo(campo: CampoEmEdicao, rotulo: string): CampoEmEdicao`
  - `function paraEdicao(campos: CampoFicha[]): CampoEmEdicao[]`
  - `function paraGravar(campos: CampoEmEdicao[]): CampoFicha[]`

**Contexto do defeito.** Em `ficha-editor.tsx` está hoje:

```ts
const novo = campo.chave === "";
```

Na primeira tecla do rótulo a chave vira `"m"` e deixa de ser vazia, então
`novo` passa a ser falso e as letras seguintes não realimentam mais a chave.
Toda chave gerada pela tela é a primeira letra do rótulo. Em produção, o tipo
`DESKTOP` tem `m`, `p`, `a`.

Não existe campo de digitação para a chave na tela — ela é só exibida em
`<code>`. Logo a única distinção que importa é **campo novo** contra **campo já
gravado no banco**, e essa informação tem de vir de onde o campo nasceu, não do
valor dele.

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar ao final de `src/lib/catalogo.test.ts`:

```ts
describe("comRotulo", () => {
  it("a chave acompanha o rótulo inteiro, e não só a primeira tecla", () => {
    // Digitar caractere a caractere é o que prova a correção. Com o defeito
    // (`novo = campo.chave === ""`), a chave trava em "m" na primeira tecla.
    let c = campoNovo();
    for (const letra of "Memória RAM") c = comRotulo(c, c.rotulo + letra);

    expect(c.rotulo).toBe("Memória RAM");
    expect(c.chave).toBe("memoria_ram");
  });

  it("não trava a chave só porque ela deixou de estar vazia", () => {
    // O teste anterior passaria por acaso se alguém reimplementasse o defeito
    // de outro jeito. Este fixa a transição exata em que ele acontecia.
    let c = campoNovo();
    c = comRotulo(c, "M");
    expect(c.chave).toBe("m");
    c = comRotulo(c, "Me");
    expect(c.chave).toBe("me");
  });

  it("campo já gravado mantém a chave quando o rótulo muda", () => {
    // Mudar a chave de um campo gravado orfanaria os valores já preenchidos
    // nas peças, em silêncio: `ficha->>'memoria_ram'` passaria a devolver nulo
    // em toda peça antiga.
    const c = comRotulo(
      { ...campo({ chave: "memoria_ram", rotulo: "Memória RAM" }), gravado: true },
      "Memória RAM total",
    );

    expect(c.rotulo).toBe("Memória RAM total");
    expect(c.chave).toBe("memoria_ram");
  });

  it("rótulo só de acento e espaço não gera chave inválida", () => {
    // `chaveDeRotulo(" — ")` devolve "", e "" é recusado por campoFichaSchema.
    // O campo fica sem chave e o erro aparece ao salvar, que é onde deve.
    const c = comRotulo(campoNovo(), " — ");
    expect(c.chave).toBe("");
  });
});

describe("paraEdicao / paraGravar", () => {
  it("marca como gravado o que veio do banco", () => {
    const [c] = paraEdicao([campo({ chave: "memoria", rotulo: "Memória" })]);
    expect(c.gravado).toBe(true);
  });

  it("campo novo nasce não gravado", () => {
    expect(campoNovo().gravado).toBe(false);
  });

  it("paraGravar tira o `gravado` antes de mandar ao banco", () => {
    // `gravado` é estado de tela. Se vazar para o jsonb, vira uma chave a mais
    // dentro de `campos_ficha` que ninguém declarou e que campoFichaSchema
    // não conhece.
    const saida = paraGravar([campoNovo(), ...paraEdicao([campo()])]);
    for (const c of saida) expect(c).not.toHaveProperty("gravado");
  });
});
```

E acrescentar `campoNovo`, `comRotulo`, `paraEdicao`, `paraGravar` ao `import`
no topo do arquivo, junto de `chaveDeRotulo` e `campoFichaSchema`.

- [ ] **Step 2: Rodar os testes e ver falhar**

```
npx vitest run src/lib/catalogo.test.ts
```

Esperado: FALHA na importação — `campoNovo is not a function` ou erro de
TypeScript dizendo que o módulo não exporta esses nomes.

- [ ] **Step 3: Escrever as funções puras**

Acrescentar em `src/lib/catalogo.ts`, logo depois de `camposFichaSchema`:

```ts
/**
 * Um campo da ficha ENQUANTO ESTÁ SENDO EDITADO na tela.
 *
 * `gravado` diz se o campo já existe no banco, e existe porque a chave só pode
 * seguir o rótulo enquanto o campo é novo — depois de gravada, mudá-la orfana
 * os valores já preenchidos nas peças, em silêncio.
 *
 * Essa informação NÃO pode ser inferida do valor da chave. Era exatamente isso
 * que o editor fazia (`const novo = campo.chave === ""`), e por isso toda chave
 * gerada pela tela ficou sendo a PRIMEIRA LETRA do rótulo: na primeira tecla a
 * chave deixava de ser vazia e o campo passava a se comportar como gravado.
 * O tipo DESKTOP em produção nasceu com as chaves `m`, `p` e `a`.
 */
export type CampoEmEdicao = CampoFicha & { gravado: boolean };

/** Um campo em branco, pronto para receber o rótulo. */
export function campoNovo(): CampoEmEdicao {
  return {
    chave: "",
    rotulo: "",
    tipo: "texto",
    unidade: null,
    opcoes: [],
    obrigatorio: false,
    gravado: false,
  };
}

/** Os campos que vieram do banco, prontos para a tela. */
export function paraEdicao(campos: CampoFicha[]): CampoEmEdicao[] {
  return campos.map((c) => ({ ...c, gravado: true }));
}

/**
 * O rótulo mudou. A chave acompanha **enquanto o campo for novo**.
 *
 * Não há caixa de digitação para a chave na tela: ela é derivada e exibida.
 * Rótulo que não produz chave nenhuma (` — `) deixa a chave vazia de
 * propósito — `campoFichaSchema` recusa, e o erro aparece ao salvar.
 */
export function comRotulo(campo: CampoEmEdicao, rotulo: string): CampoEmEdicao {
  if (campo.gravado) return { ...campo, rotulo };
  return { ...campo, rotulo, chave: chaveDeRotulo(rotulo) };
}

/**
 * Tira o `gravado` antes de mandar ao banco.
 *
 * `gravado` é estado de tela. Dentro do jsonb ele seria uma chave que
 * `campoFichaSchema` não declara e que ninguém saberia de onde veio.
 */
export function paraGravar(campos: CampoEmEdicao[]): CampoFicha[] {
  return campos.map(({ gravado: _gravado, ...campo }) => campo);
}
```

- [ ] **Step 4: Rodar os testes e ver passar**

```
npx vitest run src/lib/catalogo.test.ts
```

Esperado: PASSA, incluindo os testes que já existiam.

- [ ] **Step 5: Ligar o componente às funções puras**

Em `src/app/(app)/configuracoes/catalogo/ficha-editor.tsx`:

1. Trocar o `import` de `@/lib/catalogo` para incluir os novos nomes:

```ts
import {
  TIPOS_CAMPO,
  TIPO_CAMPO_INFO,
  campoNovo,
  comRotulo,
  paraEdicao,
  paraGravar,
  type CampoEmEdicao,
  type CampoFicha,
  type TipoCampo,
} from "@/lib/catalogo";
```

`chaveDeRotulo` sai do import: o componente não a chama mais.

2. O estado passa a ser `CampoEmEdicao[]`, semeado por `paraEdicao`:

```ts
const [campos, setCampos] = useState<CampoEmEdicao[]>(() => paraEdicao(iniciais));
```

3. `sujo` compara contra a mesma forma, senão nasce sujo:

```ts
const sujo = JSON.stringify(paraGravar(campos)) !== JSON.stringify(iniciais);
```

4. `acrescentar` usa `campoNovo`:

```ts
function acrescentar() {
  setCampos((c) => [...c, campoNovo()]);
}
```

5. `salvar` manda `paraGravar(campos)`:

```ts
const r = await salvarCamposDoTipo({ tipo_id: tipoId, campos: paraGravar(campos) });
```

6. `alterar` passa a receber `CampoEmEdicao`:

```ts
function alterar(i: number, mudanca: Partial<CampoEmEdicao>) {
  setCampos((c) => c.map((campo, n) => (n === i ? { ...campo, ...mudanca } : campo)));
}
```

7. Em `LinhaCampo`, a prop `campo` vira `CampoEmEdicao`, `aoAlterar` recebe
   `Partial<CampoEmEdicao>`, some a linha `const novo = campo.chave === "";`, e
   o `onChange` do rótulo passa a delegar:

```tsx
        <Input
          id={`rot-${indice}`}
          value={campo.rotulo}
          disabled={desabilitado}
          maxLength={60}
          placeholder="Ex.: Memória"
          onChange={(e) => aoAlterar(comRotulo(campo, e.target.value))}
        />
        <p className="text-xs text-muted-foreground">
          chave: <code>{campo.chave || "—"}</code>
          {campo.gravado ? " (fixa)" : ""}
        </p>
```

`aoAlterar` recebe o campo inteiro aqui — é um `Partial` e o objeto completo o
satisfaz.

- [ ] **Step 6: Verificar que compila e que nada quebrou**

```
npm run typecheck && npx vitest run
```

Esperado: PASSA. `LinhaCampo` é o único consumidor de `CampoFicha` no editor;
se o typecheck reclamar em outro arquivo, é sinal de que `CampoEmEdicao` vazou
para fora da tela e o vazamento é que precisa sumir.

- [ ] **Step 7: Escrever a migration que corrige o que já está gravado**

Criar `supabase/migrations/0073_chave_da_ficha.sql`:

```sql
-- ============================================================================
-- As chaves de uma letra que a tela gravou
--
-- `ficha-editor.tsx` derivava a chave do rótulo só enquanto `campo.chave === ""`.
-- Na PRIMEIRA tecla a chave virava "m" e deixava de ser vazia, então as letras
-- seguintes não realimentavam mais. Toda chave criada pela tela ficou sendo a
-- primeira letra do rótulo.
--
-- Não é cosmético: dois rótulos com a mesma inicial produzem a mesma chave, e
-- `camposFichaSchema` recusa o salvamento com "Há dois campos com a mesma
-- chave" — uma chave que o usuário nunca digitou.
--
-- O tipo DESKTOP é o único afetado hoje: `m`, `p`, `a`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Antes de mexer: nenhuma peça pode ter ficha preenchida sob essas chaves
-- ---------------------------------------------------------------------------
-- Renomear a chave no TIPO sem renomear dentro das FICHAS já preenchidas
-- orfanaria os valores: `ficha->>'memoria_ram'` devolveria nulo em toda peça
-- antiga, sem erro nenhum. Este roteiro não faz essa segunda parte, então
-- prefere abortar a fazer metade.
do $$
declare
  v_pecas int;
begin
  select count(*) into v_pecas
  from public.equipamento_unidade u
  join public.item_catalogo i on i.id = u.item_id
  join public.tipo_equipamento t on t.id = i.tipo_id
  where u.ficha <> '{}'::jsonb
    and exists (
      select 1 from jsonb_array_elements(t.campos_ficha) c
      where length(c->>'chave') = 1
    );

  if v_pecas > 0 then
    raise exception
      'Ha % peca(s) com ficha preenchida sob chave de uma letra. Renomeie as chaves DENTRO das fichas na mesma transacao antes de rodar isto.',
      v_pecas;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- A reescrita
-- ---------------------------------------------------------------------------
-- Casada em (chave, rótulo) e não no nome do tipo: o par é o que identifica o
-- defeito sem depender de como alguém batizou o tipo.
--
-- `with ordinality` preserva a ORDEM dos campos. Sem ele, `jsonb_agg` sobre
-- `jsonb_array_elements` não garante ordem, e a ficha voltaria embaralhada —
-- o que a tela mostra como campos fora de lugar, sem erro.
update public.tipo_equipamento t
set campos_ficha = (
  select coalesce(
    jsonb_agg(
      case
        when c->>'chave' = 'm' and c->>'rotulo' = 'Memória RAM'
          then jsonb_set(c, '{chave}', '"memoria_ram"')
        when c->>'chave' = 'p' and c->>'rotulo' = 'Processador'
          then jsonb_set(c, '{chave}', '"processador"')
        when c->>'chave' = 'a' and c->>'rotulo' = 'Armazenamento'
          then jsonb_set(c, '{chave}', '"armazenamento"')
        else c
      end
      order by ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(t.campos_ficha) with ordinality as e(c, ord)
)
where exists (
  select 1 from jsonb_array_elements(t.campos_ficha) c
  where c->>'chave' in ('m', 'p', 'a')
);

-- ---------------------------------------------------------------------------
-- Depois de mexer: não pode sobrar chave de uma letra
-- ---------------------------------------------------------------------------
-- Se sobrou, é um par (chave, rótulo) que eu não conhecia — e adivinhar o nome
-- certo dele aqui seria pior que parar.
do $$
declare
  v_sobrou text;
begin
  select string_agg(distinct t.nome || ': ' || (c->>'rotulo'), ', ') into v_sobrou
  from public.tipo_equipamento t,
       lateral jsonb_array_elements(t.campos_ficha) c
  where length(c->>'chave') = 1;

  if v_sobrou is not null then
    raise exception 'Sobraram chaves de uma letra: %', v_sobrou;
  end if;
end $$;

notify pgrst, 'reload schema';
```

- [ ] **Step 8: Conferir o estado do banco ANTES de aplicar**

```
npx supabase migration list
```

Esperado: as locais até `0072` aparecem como aplicadas. Se alguma divergir,
pare e conserte a divergência primeiro — este projeto já teve histórico
divergente com nome por timestamp.

Depois, ler o que vai ser reescrito:

```sql
select t.nome, c->>'chave' chave, c->>'rotulo' rotulo
from tipo_equipamento t, lateral jsonb_array_elements(t.campos_ficha) c
where length(c->>'chave') = 1;
```

Esperado: exatamente três linhas — `DESKTOP` com `m/Memória RAM`,
`p/Processador`, `a/Armazenamento`. **Se aparecer qualquer par diferente, a
migration vai abortar no segundo `do $$` de propósito** — acrescente o `when`
correspondente antes de aplicar.

- [ ] **Step 9: Aplicar e verificar**

```
npx supabase db query --linked -f supabase/migrations/0073_chave_da_ficha.sql
npx supabase migration repair --linked --status applied 0073
```

Verificar:

```sql
select nome, campos_ficha from tipo_equipamento;
```

Esperado: `DESKTOP` com as chaves `memoria_ram`, `processador`, `armazenamento`,
**na mesma ordem de antes** (Memória RAM, Processador, Armazenamento).

- [ ] **Step 10: Commit**

```bash
git add src/lib/catalogo.ts src/lib/catalogo.test.ts \
        "src/app/(app)/configuracoes/catalogo/ficha-editor.tsx" \
        supabase/migrations/0073_chave_da_ficha.sql
git commit -m "fix(catalogo): a chave da ficha era a primeira letra do rotulo"
```

---

## Task 2: As colunas de e-mail do funcionário

**Files:**
- Create: `supabase/migrations/0074_email_do_funcionario.sql`

**Interfaces:**
- Produces: colunas `funcionario.email text` e
  `funcionario.email_confirmado boolean not null default false`, mais o índice
  único parcial `idx_funcionario_email`.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0074_email_do_funcionario.sql`:

```sql
-- ============================================================================
-- E-mail do funcionário
-- (docs/superpowers/specs/2026-09-05-inventario-ti-design.md, fase A)
--
-- POR QUE NÃO FICA NA PEÇA.
--
-- O pedido original era o e-mail no cadastro do equipamento. São 127 máquinas
-- para cerca de 110 pessoas: o endereço de quem tem três máquinas ficaria
-- gravado três vezes. E quando a máquina troca de mão, o e-mail que está NELA é
-- o do detentor ANTERIOR — que é para onde a cópia do termo sairia.
--
-- É o mesmo defeito que este sistema já pagou três vezes: as obras do
-- fornecedor mantidas à mão ao lado dos contratos, o STATUS_AVARIA declarado em
-- dois arquivos, a família do equipamento escrita dentro da descrição.
--
-- O equipamento chega ao e-mail pela CUSTÓDIA, que sabe quem responde por ele
-- hoje.
-- ============================================================================

alter table public.funcionario
  add column if not exists email text,

  -- `email_confirmado` existe porque o e-mail VAI SER ADIVINHADO: a importação
  -- do inventário deriva `nome.sobrenome@sistenge.com`, que é um palpite
  -- bem-informado e não um fato.
  --
  -- A coluna separa "temos um palpite" de "alguém conferiu", e sustenta uma
  -- regra dura: NENHUM TERMO SAI PARA ENDEREÇO NÃO CONFIRMADO. Sem ela, o
  -- primeiro envio em massa descobriria os erros como devolução de e-mail —
  -- ou, pior, entregando o termo de responsabilidade de um funcionário na
  -- caixa de outro.
  add column if not exists email_confirmado boolean not null default false;

-- Parcial e por `lower()`: duas pessoas não dividem um e-mail corporativo, e
-- `Marcio.Oliveira@` e `marcio.oliveira@` são o mesmo endereço. Parcial porque
-- funcionário sem e-mail é o caso normal — 97 já estão cadastrados assim.
create unique index if not exists idx_funcionario_email
  on public.funcionario (org_id, lower(email))
  where email is not null;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Conferir que não há colisão antes de criar o índice**

O índice é criado sobre uma coluna que acabou de nascer vazia, então não pode
colidir. Confirmar mesmo assim, porque o custo é um `select`:

```sql
select count(*) from funcionario where email is not null;
```

Esperado: `0`.

- [ ] **Step 3: Aplicar e verificar**

```
npx supabase db query --linked -f supabase/migrations/0074_email_do_funcionario.sql
npx supabase migration repair --linked --status applied 0074
```

Verificar:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'funcionario'
  and column_name in ('email', 'email_confirmado');
```

Esperado: duas linhas — `email text YES null` e
`email_confirmado boolean NO false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0074_email_do_funcionario.sql
git commit -m "feat(funcionario): e-mail com estado de confirmacao"
```

---

## Task 3: A derivação do e-mail e a regra de confirmação

**Files:**
- Modify: `src/lib/termo.ts`
- Create: `src/lib/termo.test.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `function emailDerivado(nome: string): string | null`
  - `function confirmacaoDoEmail(atual: { email: string | null; confirmado: boolean }, enviado: { email: string | null; marcouConfirmar: boolean }): boolean`

Ambas são chamadas pela Task 4 (a action) e pela fase B (o importador).

**Por que aqui e não no script de importação.** A fase B vai derivar 110
endereços de uma vez. Uma regra que só existe dentro de um `.mjs` de
importação não tem teste e não pode ser reusada pela tela — e a tela precisa da
mesma regra para sugerir o endereço de um funcionário novo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/termo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { emailDerivado, confirmacaoDoEmail } from "./termo";

describe("emailDerivado", () => {
  it("usa primeiro nome e último sobrenome, sem acento e em minúsculas", () => {
    expect(emailDerivado("Marcio Oliveira")).toBe("marcio.oliveira@sistenge.com");
    expect(emailDerivado("João Lirio")).toBe("joao.lirio@sistenge.com");
    expect(emailDerivado("Jessica Mendonça")).toBe("jessica.mendonca@sistenge.com");
  });

  it("com nome do meio, pula o meio", () => {
    // "Brainer Patrick Melo Soares" tem quatro partes. O padrão da Sistenge é
    // primeiro + último, e inventar `brainer.patrick` seria escolher errado com
    // a mesma confiança.
    expect(emailDerivado("Brainer Patrick Melo Soares")).toBe(
      "brainer.soares@sistenge.com",
    );
  });

  it("já vindo em formato de login, normaliza", () => {
    // A planilha traz "Rodrigo.Ferreira" em vez do nome por extenso.
    expect(emailDerivado("Rodrigo.Ferreira")).toBe("rodrigo.ferreira@sistenge.com");
  });

  it("não deriva de nome com uma palavra só", () => {
    // "Lourival" não forma `nome.sobrenome`. Devolver `lourival.lourival` seria
    // inventar um endereço com cara de verdadeiro.
    expect(emailDerivado("Lourival")).toBeNull();
  });

  it("não deriva do que não é gente", () => {
    // A coluna USUÁRIOS da planilha mistura pessoa com estado da máquina.
    expect(emailDerivado("")).toBeNull();
    expect(emailDerivado("   ")).toBeNull();
  });

  it("colapsa espaço repetido", () => {
    expect(emailDerivado("Maria   Kodama")).toBe("maria.kodama@sistenge.com");
  });
});

describe("confirmacaoDoEmail", () => {
  const derivado = { email: "andrea.marques@sistenge.com", confirmado: false };

  it("digitar um endereço diferente é confirmar", () => {
    // Quem apagou o palpite e escreveu outro endereço conferiu o endereço.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "a.marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(true);
  });

  it("salvar sem tocar no endereço derivado NÃO confirma", () => {
    // Este é o buraco que a regra fecha: alguém edita o CARGO da pessoa e o
    // formulário reenvia o e-mail derivado. Sem esta regra, o palpite viraria
    // "conferido" sem ninguém ter olhado para ele.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "andrea.marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(false);
  });

  it("marcar a caixa confirma o endereço derivado", () => {
    expect(
      confirmacaoDoEmail(derivado, {
        email: "andrea.marques@sistenge.com",
        marcouConfirmar: true,
      }),
    ).toBe(true);
  });

  it("endereço já confirmado continua confirmado ao salvar de novo", () => {
    expect(
      confirmacaoDoEmail(
        { email: "x@sistenge.com", confirmado: true },
        { email: "x@sistenge.com", marcouConfirmar: false },
      ),
    ).toBe(true);
  });

  it("apagar o e-mail zera a confirmação", () => {
    // Sem endereço não há o que confirmar, e deixar `true` faria o registro
    // dizer "conferido" sobre um campo vazio.
    expect(
      confirmacaoDoEmail(
        { email: "x@sistenge.com", confirmado: true },
        { email: null, marcouConfirmar: true },
      ),
    ).toBe(false);
  });

  it("caixa alta não conta como endereço diferente", () => {
    // O índice único é por `lower(email)`: para o banco são o mesmo endereço,
    // então trocar a caixa não é conferir.
    expect(
      confirmacaoDoEmail(derivado, {
        email: "Andrea.Marques@sistenge.com",
        marcouConfirmar: false,
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```
npx vitest run src/lib/termo.test.ts
```

Esperado: FALHA — `emailDerivado is not a function`.

- [ ] **Step 3: Escrever as duas funções**

Em `src/lib/termo.ts`, logo depois de `funcionarioSchema`:

```ts
/** O domínio de e-mail da Sistenge. Uma constante, não uma string solta. */
const DOMINIO_EMAIL = "sistenge.com";

/**
 * O endereço provável de um funcionário, a partir do nome.
 *
 * É um PALPITE, e por isso quem grava tem de marcar `email_confirmado = false`.
 * O padrão aparece na própria planilha de inventário, que traz alguns nomes já
 * em formato de login (`Rodrigo.Ferreira`).
 *
 * Devolve `null` quando não dá para formar `nome.sobrenome` — nome de uma
 * palavra só, ou vazio. Inventar `lourival.lourival` seria produzir um endereço
 * com cara de verdadeiro, que é pior que endereço nenhum.
 */
export function emailDerivado(nome: string): string | null {
  const partes = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // O ponto separa nome de sobrenome tanto em "Rodrigo.Ferreira" quanto no
    // endereço final, então vale como espaço.
    .replace(/[.\s]+/g, " ")
    .trim()
    .split(" ")
    .filter((p) => /^[a-z]+$/.test(p));

  if (partes.length < 2) return null;
  return `${partes[0]}.${partes[partes.length - 1]}@${DOMINIO_EMAIL}`;
}

/**
 * O e-mail passa a valer como conferido?
 *
 * Duas maneiras de confirmar, e uma armadilha que a regra fecha.
 *
 * As maneiras: **digitar um endereço diferente** (quem apagou o palpite e
 * escreveu outro, conferiu) ou **marcar a caixa** na tela.
 *
 * A armadilha: sem esta regra, editar o CARGO de alguém reenviaria o e-mail
 * derivado inalterado, e ele viraria "conferido" sem ninguém ter olhado.
 *
 * Comparação por `toLowerCase()` porque o índice único do banco é por
 * `lower(email)`: trocar a caixa não é conferir.
 */
export function confirmacaoDoEmail(
  atual: { email: string | null; confirmado: boolean },
  enviado: { email: string | null; marcouConfirmar: boolean },
): boolean {
  if (!enviado.email) return false;
  if (enviado.email.toLowerCase() !== (atual.email ?? "").toLowerCase()) return true;
  return atual.confirmado || enviado.marcouConfirmar;
}
```

- [ ] **Step 4: Rodar e ver passar**

```
npx vitest run src/lib/termo.test.ts
```

Esperado: PASSA, 13 testes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/termo.ts src/lib/termo.test.ts
git commit -m "feat(funcionario): deriva o e-mail do nome, e so conta como conferido quando alguem confere"
```

---

## Task 4: O e-mail na tela do funcionário

**Files:**
- Modify: `src/lib/termo.ts` (`funcionarioSchema`)
- Modify: `src/lib/data/termo.ts` (`FuncionarioLinha` e `listarFuncionarios`)
- Modify: `src/app/(app)/termos/actions.ts` (`salvarFuncionario`)
- Modify: `src/app/(app)/termos/funcionarios/funcionario-form.tsx`
- Modify: `src/app/(app)/termos/funcionarios/page.tsx`

**Interfaces:**
- Consumes: `confirmacaoDoEmail` da Task 3; as colunas `email` e
  `email_confirmado` da Task 2.
- Produces: `FuncionarioLinha` com `email: string | null` e
  `email_confirmado: boolean`.

- [ ] **Step 1: Acrescentar `email` ao schema**

Em `src/lib/termo.ts`, no `funcionarioSchema`, e importar `emailOpcional` de
`@/lib/campos` junto dos outros helpers:

```ts
export const funcionarioSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome do funcionário.").max(200),
  cpf: textoOpcional(20),
  cargo: textoOpcional(100),
  matricula: textoOpcional(40),
  telefone: textoOpcional(40),
  // `emailOpcional` já é idempotente e valida o formato. NÃO escreva
  // `z.string().email().optional()` aqui: `parse(parse(x))` quebraria, e
  // `schemas-varredura.test.ts` cobra essa propriedade de todo schema.
  email: emailOpcional(200),
  obra_id: uuidOpcional,
});
```

`email_confirmado` **não** entra no schema: ele não vem do formulário como
valor, é calculado pela action a partir de `confirmacaoDoEmail`.

- [ ] **Step 2: Rodar a varredura de schemas**

```
npx vitest run src/lib/schemas-varredura.test.ts
```

Esperado: PASSA. A varredura encontra `funcionarioSchema` por convenção de nome
e exige `parse(parse(x)) === parse(x)`. Se falhar, o helper usado não é o de
`campos.ts`.

- [ ] **Step 3: Aplicar a confirmação na action**

Em `src/app/(app)/termos/actions.ts`, dentro de `salvarFuncionario`, entre o
`safeParse` e o `insert`/`update`:

```ts
  const parsed = funcionarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return falha(primeiroErro(parsed.error.issues));

  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();

  // A confirmação depende do que JÁ ESTAVA gravado: salvar sem tocar num
  // endereço derivado não pode transformá-lo em conferido.
  let atual = { email: null as string | null, confirmado: false };
  if (id) {
    const { data: anterior } = await supabase
      .from("funcionario")
      .select("email, email_confirmado")
      .eq("id", id)
      .maybeSingle();
    if (anterior) {
      atual = { email: anterior.email, confirmado: anterior.email_confirmado };
    }
  }

  const email_confirmado = confirmacaoDoEmail(atual, {
    email: parsed.data.email,
    marcouConfirmar: formData.get("confirmar_email") === "on",
  });

  const campos = { ...parsed.data, email_confirmado };
```

E trocar `parsed.data` por `campos` nas duas chamadas (`update` e `insert`).

Acrescentar `confirmacaoDoEmail` ao `import` de `@/lib/termo` no topo do
arquivo.

- [ ] **Step 4: Distinguir os dois `23505`**

Ainda em `salvarFuncionario`, o tratamento de erro diz hoje que o único índice
único é o do CPF — deixou de ser verdade na Task 2. Trocar por:

```ts
  if (error) {
    // 23505 = unique_violation. Agora são DOIS índices únicos, e dizer "CPF"
    // para uma colisão de e-mail manda a pessoa conferir o campo errado.
    if (error.code === "23505") {
      return falha(
        error.message.includes("idx_funcionario_email")
          ? "Já existe funcionário com esse e-mail."
          : "Já existe funcionário com esse CPF.",
      );
    }
    return falha("Não foi possível salvar o funcionário.");
  }
```

- [ ] **Step 5: Levar as colunas até a tela**

Em `src/lib/data/termo.ts`, acrescentar ao tipo:

```ts
export type FuncionarioLinha = {
  id: string;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  matricula: string | null;
  telefone: string | null;
  email: string | null;
  email_confirmado: boolean;
  obra_id: string | null;
  obra_codigo: string | null;
  ativo: boolean;
};
```

E no `select` de `listarFuncionarios`, acrescentar as duas colunas:

```ts
    .select(
      "id, nome, cpf, cargo, matricula, telefone, email, email_confirmado, obra_id, ativo, obra:obra_id(codigo)",
    )
```

E no `.map(...)` que monta o retorno, acrescentar `email: f.email` e
`email_confirmado: f.email_confirmado`.

- [ ] **Step 6: O campo e a caixa no formulário**

Em `src/app/(app)/termos/funcionarios/funcionario-form.tsx`, acrescentar depois
do campo Telefone:

```tsx
      <label className="grid gap-1 sm:col-span-2">
        <span className="text-xs text-muted-foreground">E-mail</span>
        <Input
          name="email"
          type="email"
          defaultValue={funcionario?.email ?? ""}
          maxLength={200}
          placeholder="nome.sobrenome@sistenge.com"
        />
      </label>

      {/* A caixa só aparece quando há endereço por conferir. Mostrá-la sempre
          treinaria a pessoa a marcar sem ler, que é o oposto do que ela serve.
          Digitar um endereço diferente já confirma sozinho. */}
      {funcionario?.email && !funcionario.email_confirmado ? (
        <label className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm sm:col-span-2">
          <input type="checkbox" name="confirmar_email" className="mt-0.5 size-4" />
          <span>
            Este endereço foi <strong>deduzido do nome</strong> e ainda não foi
            conferido. Marque para confirmar que está correto — enquanto não
            estiver, nenhum termo é enviado para ele.
          </span>
        </label>
      ) : null}
```

- [ ] **Step 7: A coluna na listagem**

Em `src/app/(app)/termos/funcionarios/page.tsx`:

1. No `select` da consulta, acrescentar `email, email_confirmado`:

```ts
      .select(
        "id, nome, cpf, cargo, matricula, telefone, email, email_confirmado, ativo, obra:obra_id(codigo, nome)",
      )
```

2. No tipo `Linha` local, acrescentar `email: string | null;` e
   `email_confirmado: boolean;`.

3. Acrescentar `<TableHead>E-mail</TableHead>` depois de `Nome`.

4. Acrescentar a célula correspondente, logo depois da célula do nome:

```tsx
                    <TableCell className="text-muted-foreground">
                      {f.email ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          {f.email}
                          {!f.email_confirmado ? (
                            <Badge variant="outline">Por conferir</Badge>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
```

- [ ] **Step 8: Verificar**

```
npm run typecheck && npm run lint && npx vitest run
```

Esperado: PASSA.

Auditoria de acentuação, obrigatória antes de fechar qualquer tela:

```
grep -rEn "(nao|usuario|permissao|funcao|endereco|numero|voce|tambem)" \
  "src/app/(app)/termos" --include=*.tsx
```

Esperado: nenhuma linha de texto visível. Ocorrências dentro de `name=`, `id=`
ou identificadores são esperadas e ficam.

- [ ] **Step 9: Commit**

```bash
git add src/lib/termo.ts src/lib/data/termo.ts \
        "src/app/(app)/termos/actions.ts" \
        "src/app/(app)/termos/funcionarios/funcionario-form.tsx" \
        "src/app/(app)/termos/funcionarios/page.tsx"
git commit -m "feat(funcionario): e-mail na tela, com aviso de endereco por conferir"
```

---

## Task 5: Fechamento da fase A

**Files:**
- Modify: `src/lib/changelog.ts`
- Modify: `CHANGELOG.md`
- Modify: `package.json`

- [ ] **Step 1: Rodar o ritual completo**

```
npm run typecheck && npm run lint && npm test && npm run build
```

Esperado: os quatro passam. Se o `build` falhar em arquivo não tocado, suspeite
de `server-only`: `src/lib/termo.ts` é importado por componente cliente e **não
pode** ganhar a diretiva.

- [ ] **Step 2: Bumpar a versão nos três pontos**

Em `src/lib/changelog.ts`: `APP_VERSION = "0.69.0"` e um `Release` novo no topo
do array `CHANGELOG`:

```ts
  {
    versao: "0.69.0",
    data: "2026-09-05",
    titulo: "E-mail do funcionário, e a chave da ficha que era só a primeira letra",
    mudancas: [
      { tipo: "novo", texto: "O cadastro de funcionário agora tem e-mail. É por ele que a cópia do termo de responsabilidade vai sair." },
      { tipo: "novo", texto: "Endereço deduzido do nome aparece marcado como “Por conferir”, e nenhum termo é enviado para um endereço nesse estado. Conferir é marcar a caixa — ou digitar outro endereço." },
      { tipo: "correcao", texto: "Ao criar um campo de ficha, a chave gravada era só a PRIMEIRA LETRA do rótulo: “Memória RAM” virava “m”. Dois campos com a mesma inicial colidiam e o salvamento era recusado com uma mensagem sobre uma chave que ninguém tinha digitado." },
      { tipo: "correcao", texto: "As chaves já gravadas assim foram corrigidas — o tipo DESKTOP passou a ter “memoria_ram”, “processador” e “armazenamento”." },
      { tipo: "melhoria", texto: "Dois funcionários não podem mais dividir o mesmo e-mail, e a mensagem de erro passou a dizer se a duplicidade é de CPF ou de e-mail." },
    ],
  },
```

Em `CHANGELOG.md`, replicar o resumo no formato Keep a Changelog, no topo.

Em `package.json`, `"version": "0.69.0"`.

- [ ] **Step 3: Conferir que os três batem**

```
grep -n "APP_VERSION" src/lib/changelog.ts
grep -n '"version"' package.json
head -5 CHANGELOG.md
```

Esperado: `0.69.0` nos três.

- [ ] **Step 4: Rodar o ritual de novo e commitar**

```
npm run typecheck && npm run lint && npm test && npm run build
```

```bash
git add src/lib/changelog.ts CHANGELOG.md package.json
git commit -m "chore(release): 0.69.0 — e-mail do funcionario e a chave da ficha"
```

- [ ] **Step 5: Verificação na tela, que é o ponto desta fase**

Nenhuma tela autenticada foi aberta num navegador em todo o módulo de
equipamento. Esta fase é a primeira verificável em poucos cliques:

1. `npm run dev`, entrar no sistema.
2. **Configurações → Categorias e tipos → TI → DESKTOP → Ficha.** Conferir que
   os três campos mostram `memoria_ram`, `processador` e `armazenamento` — e
   não `m`, `p`, `a`.
3. **Novo campo**, digitar `Modelo`. A chave tem de virar `modelo`. Salvar tem
   de funcionar — antes da correção, `Modelo` viraria `m` e colidiria com
   `Memória RAM`.
4. **Termos → Funcionários.** Cadastrar alguém com e-mail; a linha aparece sem
   o selo "Por conferir", porque digitar é conferir.

Se algo divergir do descrito, **é aqui que aparece** — nada acima foi visto num
navegador.

---

## Auto-revisão do plano

**Cobertura da spec (fase A).** A spec pede quatro coisas na fase A e todas têm
tarefa: a correção do `ficha-editor` (Task 1), a migração das chaves já gravadas
(Task 1, steps 7–9), as colunas `email` e `email_confirmado` com índice único
(Task 2), a regra de derivação (Task 3) e o campo na tela com aviso de não
confirmado (Task 4).

**Consistência de tipos.** `CampoEmEdicao` é definido na Task 1 e usado só lá.
`emailDerivado` e `confirmacaoDoEmail` são definidos na Task 3 com as
assinaturas que a Task 4 consome. `FuncionarioLinha` ganha `email` e
`email_confirmado` na Task 4, e o formulário lê os dois do mesmo tipo.

**O que ficou de fora de propósito.** `emailDerivado` é escrito na fase A mas só
tem consumidor na fase B — está aqui porque a regra precisa de teste e porque a
tela vai querer sugerir endereço. A regra "nenhum termo sai para endereço não
confirmado" é **enunciada** na coluna e no texto da tela, mas só ganha efeito na
fase C.1, que é quem envia. Isso é intencional: hoje não existe envio de termo
por e-mail para desrespeitar a regra.
