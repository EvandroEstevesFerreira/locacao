# Documentos do alojamento — POL-RH-001 e FRM-RH-001 a 005

**Data:** 2026-08-22
**Status:** fases 1 e 2 entregues (v0.24.0 e v0.25.0); fases 3 a 5 pendentes

## Estado da entrega

| Fase | Estado | Versão |
|---|---|---|
| 1 — primitivos + FRM-RH-001 | **entregue** | 0.24.0 |
| 2 — FRM-RH-002 a 005 em branco + rota + tela | **entregue** | 0.25.0 |
| 2b — POL-RH-001 | **pendente** — ver "O que falta" | — |
| 3 — `medida_disciplinar` e `entrega_ocupante` | pendente | — |
| 4 — rotina semanal de limpeza | pendente | — |
| 5 — aceite digital | pendente | — |

### Correções de rota que a execução impôs

- **FRM-RH-001 fecha em 3 páginas**, não 2 (medido; ver seção de densidade).
- **FRM-RH-005 semanal fecha em 3 páginas paisagem**, não 2. O grid de 44 linhas
  ocupa 2 folhas sozinho e o apêndice a terceira. A folha mensal fecha em 1.
- Dois bugs de renderização só apareceram ao **olhar** o PDF, nunca em teste:
  `lineHeight` na `Page` apagando o rodapé fixo, e o Helvetica sem o glifo `☐`
  apagando todos os checkboxes. **Lição para as fases seguintes: renderizar e
  inspecionar, não só contar páginas.**

### O que falta na POL-RH-001

A conversão do texto está resolvida (script em
`scratchpad/gera_politica.py`: 180 parágrafos, 21 seções corretamente
detectadas). O que trava é que a política tem **duas tabelas** — a matriz de
responsabilidades (item 10) e a tabela de infrações e penalidades (item 11.3) —
que o `pdftotext` quebra em fragmentos de célula. Pelo princípio da abordagem C,
elas são estrutura e vão em código, como `Tabela`, e não no template. É trabalho
de composição, não de decisão: o desenho já está fechado.

## Objetivo

Trazer para dentro do Loca os seis documentos do alojamento hoje soltos em
`Referencias/Documentos` como `.docx` e `.pdf`, **gerados pelo próprio sistema no
template visual do Loca**, com densidade tipográfica que reduza o número de
páginas impressas.

Os documentos:

| Documento | Natureza | Entidade | Situação hoje |
|---|---|---|---|
| POL-RH-001 (14 pág.) | Normativo, 16 seções | Biblioteca → `normativo` | Upload de PDF |
| FRM-RH-001 Termo de Compromisso | 15 campos, 22 regras, CFTV/LGPD, armário, penalidades, 4 assinaturas | `ocupante_imovel` | Existe versão empobrecida (`termo_responsabilidade`) |
| FRM-RH-002 Advertência/Suspensão | Medida disciplinar, reincidência, ciência | nova `medida_disciplinar` | Não existe |
| FRM-RH-003 Entrega/Devolução de chaves | Itens + checklist de conservação (16 linhas) | nova `entrega_ocupante` | Não existe |
| FRM-RH-004 Kit de alojamento | Enxoval (4 itens), entrega e devolução | nova `entrega_ocupante` | Não existe |
| FRM-RH-005 Checklist semanal de limpeza | ~45 tarefas × 7 dias, EPI, estoque | novas `tarefa_limpeza` + `checklist_limpeza` | Não existe |

## Decisões aprovadas

1. **Profundidade mista por documento.** POL-RH-001 é consulta/impressão pela
   Biblioteca; FRM-RH-001/003/004 viram registro no ocupante; FRM-RH-002 vira
   registro disciplinar próprio; FRM-RH-005 vira rotina semanal do imóvel.
2. **Assinatura em papel agora, aceite digital depois.** O desenho reserva o
   lugar (`modo` do `<Assinaturas>` + colunas `aceite_em`/`aceite_ip` criadas
   nulas na fase 1). A fase 5 troca o modo, sem migration nem mudança de layout.
3. **Estrutura em código, texto no banco** (abordagem C). Primitivos de
   formulário são componentes TSX; as partes narrativas continuam em
   `documento_template.corpo` com `{{variáveis}}`, editáveis em Configurações.
4. **Só o essencial é guardado.** O Loca passa a guardar cargo, quarto e armário.
   RG, data de admissão e contato de emergência saem como **linha em branco** no
   PDF, para preenchimento manual.
5. **O FRM-RH-001 substitui o `termo_responsabilidade`.** O `tipo` permanece;
   mudam o conteúdo de `DEFAULT_TEMPLATES` e as variáveis.
6. **Apenas o logo.** O papel timbrado 2026 (tagline, barra vermelha de rodapé,
   motivo de cápsula) foi descartado. O único elemento de marca no documento é o
   logotipo; títulos de seção são tipográficos.
7. **Catálogo único em `templates.ts`, ligado ao módulo.** Os seis documentos
   entram na tela *Configurações → Templates de documentos*, ao lado dos três
   que já existem, agrupados por módulo. `DocumentoInfo` ganha `modulo`,
   `categoria` e `preenchimento`.

## Identidade visual

Analisado o Manual de Identidade Visual 2026 (`Banco de Imagens/Identidade
Visual/2026`).

- Os paths de `LogoSistenge` em `src/lib/pdf.tsx` são byte a byte os do
  `Versão Fundo Claro.svg` oficial. Nada a corrigir.
- **Divergência registrada, fora do escopo desta entrega:** a página *Cores* do
  manual declara `#BE3A31`; todos os arquivos vetoriais do logo pintam
  `#cf2927`. O Loca segue o manual (`MARCA_VERMELHO = "#BE3A31"` em
  `src/lib/brand-colors.ts`) e assim permanece. O material impresso da Sistenge
  e o software saem hoje em vermelhos diferentes — assunto para a agência.
- **Piso de tamanho do logo:** o manual exige ≥ 3 cm de largura em impressão,
  ou seja **85pt**. `LogoSistenge` usa `width = 150` (5,3 cm). Ao apertar
  cabeçalhos por densidade, 85pt é o limite.
- A regra do AGENTS.md sobre `--brand` (uso restrito ao logotipo e a badges de
  crítico) **permanece intacta** — a decisão 6 eliminou a exceção que o timbrado
  exigiria.

## Primitivos de PDF — `src/lib/pdf/form.tsx`

Oito primitivos, levantados bloco a bloco contra os seis documentos:

| Primitivo | Resolve | Exigido por |
|---|---|---|
| `<Documento>` | Página retrato/paisagem, cabeçalho (logo + código + versão), rodapé com paginação | todos |
| `<Secao n titulo>` | Seção numerada, `wrap={false}` quando curta | todos |
| `<CampoGrid colunas={1\|2}>` | Label/valor; `valor: null` desenha linha para preencher | 001, 002, 003, 004, 005 |
| `<Lista tipo="numerada"\|"marcador">` | Texto narrativo vindo de `documento_template` | 001, 002, POL |
| `<OpcoesCheck>` | `☐ texto`, com `linha: true` quando a opção continua em branco | 002, 003, 004, 005 |
| `<Tabela colunas linhas>` | Larguras em %, célula texto/`☐`/vazia, linha de grupo | 001, 003, 004, 005, POL |
| `<AreaTexto linhas={n}>` | N linhas em branco para escrita manual | 002, 003, 004, 005 |
| `<Assinaturas modo="manual"\|"aceite">` | Grid de N assinaturas, 2 por linha | 001, 002, 003, 004 |

Duas notas de projeto:

- **`valor: null` é o que faz a decisão 4 funcionar.** O `CampoGrid` recebe
  sempre os 15 campos e decide por campo: valor onde há, linha onde não há.
  Promover um campo de "branco" para "guardado" é acrescentar coluna e passar
  valor — zero mudança de layout.
- **A `Tabela` carrega o peso e é o maior risco de não generalizar.** Cinco dos
  seis documentos a usam, em formatos muito distintos (2 colunas de texto na
  001, 10 colunas de checkbox na 005). Por isso ela é construída **validada
  contra o grid do FRM-RH-005 já na fase 1**, ainda que o documento 005 só seja
  composto na fase 2.

O `DocumentoTexto` existente (contrato de imóvel, contrato de equipamento) não é
alterado, exceto por passar a desenhar o logo no lugar da palavra `SISTENGE`.

## Densidade e economia de páginas

Escala própria para formulários, sem tocar na escala de contrato:

| | Contrato (hoje) | Formulário (novo) |
|---|---|---|
| Corpo | 11pt / 1.5 | 9pt / 1.35 |
| Padding | 40 | 30 (36 embaixo) |
| Label de campo | 9pt | 7.5pt |
| Linha de tabela | — | 14pt, célula 8pt |
| Lista | — | 8.5pt / 1.3 |

Metas por documento:

- **FRM-RH-001 → 3 páginas.** *(Corrigido na fase 1 — a previsão era 2.)* Medido:
  o texto sozinho (54 parágrafos, 44 cláusulas, 7.270 caracteres) já ocupa 2
  páginas cheias a 8,5pt. Somando o bloco de 14 campos, a tabela de penalidades e
  as 4 assinaturas, 2 páginas exigiriam corpo abaixo de 7,5pt — ilegível num
  documento que o alojado precisa ler e que sustenta justa causa. Vale o mesmo
  princípio da política: não se resume para caber. Os demais formulários seguem
  com meta de 2.
- **FRM-RH-002 → 2 páginas.** As `AreaTexto` (5 e 4 linhas) são o gasto e são
  justamente o que não pode encolher.
- **FRM-RH-003 → 2 páginas.**
- **FRM-RH-004 → 2 páginas**, com quebra deliberada: entrega na primeira,
  devolução na segunda — são preenchidas com meses de distância.
- **POL-RH-001 → 8 a 10 páginas** (de 14). **Estimativa, não medição.**
- **FRM-RH-005 → 2 páginas paisagem** + 1 folha mensal avulsa.

**FRM-RH-005: a economia não é tipográfica.** Em paisagem, 45 tarefas × 14pt dão
700pt contra 531pt úteis; a 11pt ainda não fecha e o checkbox fica impreenchível.
O que resolve vem do modelo de dados: com as tarefas em `tarefa_limpeza`, a folha
semanal imprime só as de frequência **D** e **S** (~38), e as **M** (7) saem em
folha mensal separada.

Layout do grid em paisagem (A4, 842 × 595):

```
┌──────────────────────────────────────────────────────────────┐
│ [logo]  CHECKLIST SEMANAL · FRM-RH-005      Alojamento: ____ │
├────────────────────────┬──┬──┬──┬──┬──┬──┬──┬──┬────────────┤
│ Tarefa            34%  │Fq│Sg│Te│Qa│Qi│Sx│Sá│Do│ Rubrica 11%│
├────────────────────────┴──┴──┴──┴──┴──┴──┴──┴──┴────────────┤
│ BANHEIROS                                    ← linha de grupo│
│ Limpar vasos com desinfetante  │ D│☐ ☐ ☐ ☐ ☐ ☐ ☐│           │
└──────────────────────────────────────────────────────────────┘
```

## Onde os documentos moram: um catálogo, duas telas

O catálogo é **um só** — `DOCUMENTOS` em `src/lib/templates.ts`, que hoje já
alimenta *Configurações → Templates de documentos*. Ele passa de 3 para 9
entradas e o `DocumentoInfo` ganha três campos:

```ts
export type DocumentoInfo = {
  tipo: TipoDocumento;
  label: string;
  descricao: string;
  eyebrow: string;
  modulo: ModuloKey;                       // "imoveis" | "contratos"
  categoria: CategoriaBiblioteca;          // "normativo" | "formulario"
  preenchimento: "com_dados" | "em_branco"; // sai preenchido ou para preencher à mão
  variaveis: VariavelInfo[];
};
```

Os três documentos existentes também recebem `modulo` (`contrato_imovel` e
`termo_responsabilidade` → `imoveis`; `contrato_equipamento` → `contratos`).

Desse catálogo saem **duas telas, para dois públicos**:

**1. Configurações → Templates de documentos — onde o texto é escrito.**
`src/app/(app)/configuracoes/templates/page.tsx` passa a agrupar as entradas por
módulo, mantendo o `ConfigRow` e os badges `Padrão`/`Personalizado` atuais. A tela
é **master-only** (`podeConfigurarSistema`), e assim permanece: quem edita a
cláusula de um termo que sustenta justa causa não é qualquer usuário.

**2. Imóveis → Documentos — onde o documento é impresso.**
`src/app/(app)/imoveis/documentos/page.tsx` hoje lista só linhas de
`biblioteca_documento` (arquivos enviados ao Storage). Passa a desenhar, **acima**
dos enviados e dentro das mesmas categorias, as entradas do catálogo com
`modulo === "imoveis"`. Documento do catálogo não tem botão de excluir — tem
"editar texto", visível apenas para quem é master, que leva a Configurações.

**Por que não concentrar tudo em Configurações:** o encarregado que precisa
imprimir o FRM-RH-003 na obra não é master e seria barrado pelo `redirect("/")`.
Autoria e consumo têm públicos diferentes.

**Ganho colateral do `modulo`:** a filtragem por módulo já existente
(`moduloLiberado` em `src/lib/modulos.ts`) passa a valer para os documentos de
graça — desligar Imóveis para um usuário some com os documentos do alojamento da
lista dele, sem nenhum código novo de permissão.

Nenhuma migration: `biblioteca_documento` continua sendo só o que foi enviado.

## Modelo de dados

### `ocupante_imovel` — cinco colunas

```sql
alter table public.ocupante_imovel
  add column cargo     text,
  add column quarto    text,
  add column armario   text,
  add column aceite_em timestamptz,   -- fase 5, nulo por ora
  add column aceite_ip inet;          -- inet, não text: é um IP
```

**Consequência:** `ocupante-form.tsx` vai de 5 para 8 campos e tem validação
cruzada (`data_entrada` < `data_saida`), cruzando o limiar do AGENTS.md para
`react-hook-form` + `zodResolver` — mesmo caminho do `ReparoForm` (commit
`a279aca`). O schema zod vai para `src/lib/imoveis.ts`, não para `actions.ts`.

### `medida_disciplinar` — FRM-RH-002

Não estende `ocorrencia_imovel` por três motivos: aquela tabela é escopada a
**imóvel**, não a pessoa; seu `tipo` descreve evento físico (`avaria`, `reparo`);
e — o que decide — **a confidencialidade é outra**. Uma avaria todo mundo da obra
pode ver; uma advertência não.

```sql
create table public.medida_disciplinar (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  ocupante_id  uuid not null references public.ocupante_imovel (id) on delete cascade,
  imovel_id    uuid not null references public.imovel (id) on delete cascade,
  data         date not null,
  tipo         text not null check (tipo in ('verbal','escrita','suspensao','outra')),
  suspensao_dias   int check (suspensao_dias between 1 and 30),   -- CLT art. 474
  suspensao_inicio date,
  suspensao_fim    date,
  fato_em      timestamptz,
  fato_local   text,
  fato_descricao text not null,
  testemunhas  text,
  regras_violadas text[],        -- itens 6.1, 6.2, 7.1… da POL-RH-001
  clt_artigo   text,             -- alínea do art. 482
  reincidencia boolean not null default false,
  fundamentacao text,
  ciencia      text check (ciencia in ('recebeu','com_ressalva','recusou')),
  ciencia_em   date,
  documento_path text,           -- PDF assinado, digitalizado
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.medida_disciplinar (ocupante_id);
create index on public.medida_disciplinar (imovel_id);
create index on public.medida_disciplinar (org_id, data desc);
```

O `check (suspensao_dias between 1 and 30)` é o teto do art. 474 da CLT: uma
suspensão de 31 dias configura rescisão. A regra pertence ao banco.

**RLS — a primeira do schema que restringe leitura por papel:**

```sql
create policy "medida_select" on public.medida_disciplinar
  for select to authenticated
  using (org_id = (select public.current_org_id())
         and (select public.pode_gerir_cadastros()));   -- master/admin apenas
```

O `(select ...)` em volta das funções segue a recomendação de performance de RLS
do Supabase (a função é avaliada uma vez, não por linha). As policies existentes
do Loca chamam `public.current_org_id()` direto; retrofitá-las é ganho medível,
mas é outra entrega. As novas nascem certas.

### `entrega_ocupante` — FRM-RH-003 e FRM-RH-004

Uma tabela, não duas. Os dois documentos são o mesmo ciclo: o alojado **recebe**
na entrada e **devolve** na saída, com conferência de estado e possível cobrança.
Separá-los duplicaria o ciclo e transformaria "o que este alojado ainda não
devolveu?" em duas consultas.

```sql
create table public.entrega_ocupante (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  ocupante_id  uuid not null references public.ocupante_imovel (id) on delete cascade,
  tipo         text not null check (tipo in ('chaves','kit')),
  entregue_em  date,
  devolvido_em date,
  devolucao_motivo text check (devolucao_motivo in
                     ('desligamento','transferencia','termino_contrato','outro')),
  itens        jsonb not null default '[]'::jsonb,  -- o que foi entregue
  checklist    jsonb not null default '[]'::jsonb,  -- conservação (só 'chaves')
  avarias      text,
  tratativa    text check (tratativa in ('sem_ressalva','desgaste_natural','atribuivel')),
  documento_path text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.entrega_ocupante (ocupante_id, tipo);
```

**Custo assumido:** `itens` e `checklist` mudam de forma conforme o `tipo` — uma
união discriminada dentro de uma coluna. Aceitável porque esses campos são
**retrato de um formulário impresso**, não dado consultado: ninguém perguntará ao
banco quantos travesseiros estão rasgados. Avaria que vira obrigação já tem casa
em `reparo_imovel`. Se virar consulta, vira tabela filha.

### `tarefa_limpeza` e `checklist_limpeza` — FRM-RH-005

O catálogo em tabela é o que **viabiliza a economia de página**: sem ele não há
como imprimir só as diárias e semanais.

```sql
create table public.tarefa_limpeza (            -- catálogo, ~45 linhas por org
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  grupo  text not null,      -- BANHEIROS, COZINHA/REFEITÓRIO, QUARTOS…
  descricao text not null,
  frequencia text not null check (frequencia in ('D','S','M')),
  ordem  int not null default 0,
  ativo  boolean not null default true
);
create index on public.tarefa_limpeza (org_id, grupo, ordem);

create table public.checklist_limpeza (         -- uma linha por imóvel/semana
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizacao (id) on delete cascade,
  imovel_id uuid not null references public.imovel (id) on delete cascade,
  semana_inicio date not null,                  -- sempre segunda-feira
  auxiliar_nome text,
  marcacoes  jsonb not null default '{}'::jsonb,  -- {tarefa_id: [dias marcados]}
  epi        jsonb not null default '[]'::jsonb,
  estoque    jsonb not null default '[]'::jsonb,
  observacoes text,
  avaliacao  text check (avaliacao in ('conforme','parcial','nao_conforme')),
  documento_path text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (imovel_id, semana_inicio)
);
create index on public.checklist_limpeza (imovel_id, semana_inicio desc);
```

O `unique (imovel_id, semana_inicio)` impede a duplicata que ocorre quando duas
pessoas abrem o checklist da mesma semana. **`semana_inicio` é calculada com
`hojeISOSaoPaulo()`, nunca `new Date()`** — a regra de fuso do AGENTS.md vale
aqui como vale para multa e juros.

### POL-RH-001 e a substituição do termo — nenhuma tabela

Novo `tipo` em `documento_template` (`politica_alojamento`) e nova entrada no
catálogo `DOCUMENTOS`, com `categoria: "normativo"` e
`preenchimento: "em_branco"`.

Para o termo: o `tipo` continua `termo_responsabilidade`; mudam o conteúdo de
`DEFAULT_TEMPLATES` e as variáveis (acrescentar variável é retrocompatível —
template antigo simplesmente não a usa). **A migration não toca em nenhuma linha
de `documento_template`.** Quem customizou não perde nada; Configurações passa a
mostrar um aviso de "texto anterior ao FRM-RH-001", com opção de ver e adotar o
padrão novo. Sem mágica, sem perda, visível.

## Armadilha do renderizador (descoberta na fase 1)

**Nunca declarar `lineHeight` no estilo da `Page`.** Com `lineHeight` ali, o
`@react-pdf/renderer` 4.5 deixa de desenhar **qualquer** filho
`position: absolute` + `fixed` — o rodapé de paginação some, em todas as folhas,
sem erro nem aviso. Vale para 1.35 e até para 1.

O entrelinhamento vive nos estilos de texto (`listaTexto`, `campoValor`,
`tabelaCelula`, `opcaoTexto`). O estilo da página é a constante exportada
`ESTILO_PAGINA`, e `pdf-form.test.tsx` reprova se `lineHeight` voltar.

Isto passou pelo teste de contagem de páginas: o PDF tinha o número certo de
folhas, faltava só a numeração nelas — que é justamente o que prova que nenhuma
página foi retirada do processo. Achado só ao **olhar** o PDF gerado. Fica a
lição para as fases seguintes: renderizar e inspecionar, não só contar páginas.

## Armadilhas registradas

1. **`soft_delete` é um `case`, não é genérico.** `0041_fix_soft_delete.sql`
   enumera entidade por entidade e lança `Entidade inválida` no `else`. Cada
   tabela nova precisa do seu ramo, com o gate de papel certo —
   `medida_disciplinar` usa `is_master()`, como contrato e lançamento
   financeiro: apagar advertência é ato crítico.
2. **`deleted_at` em todas as tabelas novas.** É o que a policy de SELECT
   esconde; sem a coluna o `soft_delete` não tem onde escrever.
3. **Trigger `registrar_auditoria()` nas quatro tabelas novas.** Para
   `medida_disciplinar` isso não é higiene: é prova de quem registrou o quê e
   quando.
4. **Exclusão nunca por `.update({ deleted_at })`** — sempre
   `supabase.rpc("soft_delete", ...)`, tratando `data !== true` como erro
   (incidente 0.19.4).
5. **Leituras compartilhadas em `src/lib/data/`** com `import "server-only"` e
   `createClient()` — nunca `createAdminClient()`, sob pena de vazar entre
   organizações em silêncio.

## Faseamento

O corte que organiza a entrega é separar **composição** de **transação**: "no
mesmo template" é composição, "dentro do sistema" é transação.

| Fase | Versão | Entrega | Tabelas |
|---|---|---|---|
| 1 | 0.24.0 | 8 primitivos + FRM-RH-001 completo com dados reais; substitui o `termo_responsabilidade`; `DocumentoInfo` ganha `modulo`/`categoria`/`preenchimento` e a tela de Templates passa a agrupar por módulo; logo no lugar da palavra `SISTENGE`; `Tabela` validada contra o grid do 005 | `ocupante_imovel` +5 colunas |
| 2 | 0.25.0 | Os outros cinco compostos em branco + POL-RH-001 gerada do template; as seis entradas no catálogo, visíveis em Configurações (editar) e em Imóveis → Documentos (imprimir); os `.docx` saem de circulação | nenhuma |
| 3 | 0.26.0 | Registro disciplinar e entregas: formulários, PDF preenchido, pendências no ocupante | `medida_disciplinar`, `entrega_ocupante` |
| 4 | 0.27.0 | Rotina semanal de limpeza; catálogo de tarefas em Configurações; folha mensal separada | `tarefa_limpeza`, `checklist_limpeza` |
| 5 | — | Aceite digital: troca `modo` do `<Assinaturas>` | nenhuma |

Ao fim da fase 2 o RH imprime os seis documentos no template do Loca, sem Word e
sem pasta de rede — a maior fatia do pedido original, sem nenhum risco de
modelagem.

## Testes

A meta de densidade vira asserção, não intenção:

```ts
it("FRM-RH-001 cabe em 2 páginas", async () => {
  const buffer = await renderToBuffer(<TermoCompromisso {...dadosCompletos} />);
  expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
});
```

Sem isso, alguém acrescenta três cláusulas em 2027, o termo vira 3 páginas e
ninguém percebe até a obra reclamar do custo de impressão.

Demais testes: soma das larguras de coluna da `Tabela` = 100%; `CampoGrid` com
`valor: null` desenha linha; cálculo de `semana_inicio` via `hojeISOSaoPaulo()`;
schema zod do ocupante.

## Riscos assumidos

- **A estimativa de 8–10 páginas da POL-RH-001 é cálculo, não medição.** Se não
  fechar na fase 2, a saída é tipográfica (corpo 9pt, tabela de infrações em duas
  colunas) — não cortar cláusula. Política não se resume para caber.
- **A `Tabela` pode não generalizar** do caso fácil (001) ao difícil (005). Por
  isso é construída contra o 005 desde a fase 1.
- **Duas fontes de verdade por documento** (estrutura no código, texto no banco).
  Mitigação: cada arquivo TSX referencia no topo o `tipo` de template que
  consome, e Configurações diz qual documento cada texto alimenta.
