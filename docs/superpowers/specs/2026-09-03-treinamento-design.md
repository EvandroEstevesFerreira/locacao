# Treinamento e manual do Loca — a máquina (Fatia 1)

**Data:** 2026-09-03
**Escopo:** a máquina de treinamento — trilhas, leitura, questionário, registro
de conclusão e painel. O **conteúdo** dos 13 módulos vem em ondas depois, com
plano próprio por onda.
**Decisões prévias:** `2026-09-03-treinamento-decisoes.md`

## O pedido, e o que ele esconde

"Manual de utilização, treinamento completo, e todos devem fazer o treinamento
para usar o módulo."

As duas primeiras partes são documentos. A terceira é um **controle**, e é a que
não se resolve com documento nenhum: sem registro de quem concluiu, "todos
foram treinados" é suposição. Esta fatia constrói o controle e o lugar onde os
documentos moram.

## As duas decisões estruturais

**Manual e trilha são a mesma informação em duas ordens.** A trilha percorre na
ordem em que se aprende; o manual indexa por tela, para quem já sabe e travou.
Uma fonte, duas leituras — e nenhum dos dois desatualiza sem o outro.

**O conteúdo mora no código.** Treinamento de software é documentação de
software: se a tela muda, a aula muda no mesmo commit, e o diff mostra as duas
coisas lado a lado. Custo aceito: corrigir uma vírgula exige deploy.

## Modelo de conteúdo

`src/lib/treinamento/<modulo>.ts`, um arquivo por módulo, e
`src/lib/treinamento/index.ts` reunindo tudo.

```ts
export type Passo = {
  /** Onde a pessoa está: rota ou nome da tela. Ex.: "/frota/[id]". */
  onde: string;
  /** O que fazer. Imperativo, uma ação. */
  acao: string;
  /** O que tem de acontecer. É isto que separa treinamento de tour. */
  esperado: string;
};

export type Aula = {
  /** Estável e único na trilha. Entra na URL e no registro. */
  id: string;
  titulo: string;
  /** Uma frase: por que esta aula existe. Aparece no índice do manual. */
  resumo: string;
  /** Rotas que esta aula cobre — é o que o manual usa para indexar por tela. */
  rotas: string[];
  passos: Passo[];
  /** Armadilhas e regras que a tela não explica sozinha. Opcional. */
  atencao?: string[];
  /** Versão da trilha em que esta aula mudou materialmente. */
  desdeVersao: number;
};

export type Pergunta = {
  id: string;
  enunciado: string;
  /** Quatro alternativas. A correta é o índice em `correta`. */
  alternativas: string[];
  correta: number;
  /** Por que a resposta é essa. Mostrado depois de responder, sempre. */
  porque: string;
  /** A aula que responde esta pergunta — o link de "revise isto". */
  aula: string;
};

export type Trilha = {
  chave: string;             // "primeiros-passos", "frota", "termos"
  titulo: string;
  /** Módulo que a trilha ensina. `null` = trilha para todos. */
  modulo: ModuloKey | null;
  /** Papéis a que a trilha se aplica. Vazio = todos. */
  papeis: Papel[];
  /** Bump deliberado quando o conteúdo muda de forma material. */
  versao: number;
  aulas: Aula[];
  perguntas: Pergunta[];
};
```

Três escolhas a justificar:

- **`esperado` em todo passo.** É o que separa treinamento de passeio guiado:
  "clique em Salvar" ensina a clicar; "clique em Salvar — tem de aparecer o
  item na lista" ensina a reconhecer que funcionou, e a perceber quando não
  funcionou. É também o formato das 14 etapas do roteiro de homologação, que
  são a matéria-prima do conteúdo.
- **`rotas` na aula.** É o único campo que existe para o manual, e é o que
  permite indexar por tela sem escrever nada duas vezes.
- **`porque` na pergunta, mostrado sempre.** Errar e não saber por que só ensina
  a chutar melhor.

## Modelo de dados

Uma tabela. É o mínimo que registra o fato e nada mais.

```sql
create table if not exists public.treinamento_conclusao (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  perfil_id        uuid not null references public.perfil (id) on delete cascade,
  trilha           text not null,
  /** Versão do conteúdo concluída. Conclusão vale para ESTA versão. */
  versao           smallint not null,
  concluido_em     timestamptz not null default now(),
  acertos          smallint not null,
  total_perguntas  smallint not null,
  /** Assinatura na tela, PNG em data URI. Nula se o comprovante não foi assinado. */
  assinatura       text,
  assinado_ip      text,
  numero_registro  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (perfil_id, trilha, versao)
);
```

**"Pendente" é calculado, nunca armazenado.** Para cada trilha a que o papel e
os módulos da pessoa dão direito, existe conclusão na versão vigente? Uma
coluna de status seria a primeira coisa a ficar velha — o Loca já tem
precedente disso resolvido por cálculo em `orcamento_locacao` e no painel de
indicadores.

**`unique (perfil_id, trilha, versao)`** guarda o histórico: quem concluiu a v1
e depois a v2 tem duas linhas, e o comprovante de cada uma continua válido para
a versão que ele atesta. Refazer a mesma versão é `upsert` na mesma linha, não
linha nova — dois cliques no botão não geram dois comprovantes.

**Imutabilidade:** não. Diferente do livro de custódia, aqui refazer é o
comportamento desejado, e a linha tem uma chave natural que impede duplicata.
O `updated_at` registra a última tentativa.

**RLS:**
`perfil_id` referencia `public.perfil (id)`, e **`perfil.id` É o id de
`auth.users`** — verificado em produção: os 10 perfis têm id igual ao do usuário
de autenticação, e `handle_new_user` grava `new.id`. Por isso a policy pode
comparar com `auth.uid()` direto, sem subconsulta.

- `select`: a própria pessoa (`perfil_id = auth.uid()`) **ou**
  `pode_gerir_cadastros()` na mesma organização. É exatamente a decisão do
  usuário: painel para master/administrador e para a própria pessoa. Gestor por
  obra ficou **fora** — não foi escolhido, e acrescentar depois é uma policy.
- `insert`/`update`: só a própria pessoa. Ninguém registra treinamento por
  outro, nem o master — um comprovante assinado por terceiro não vale nada.
- **Sem policy de `delete`.** Registro de treinamento não se apaga.

**Numeração:** `treinamento_conclusao` entra em `PREFIXO_REGISTRO` como `TRE`,
e o comprovante recebe `TRE-2026-0001` na conclusão, pela `proximo_numero` que
já existe.

## Onde a regra mora

### `src/lib/treinamento.ts` — puro e testável

| Função | O que faz |
|---|---|
| `trilhasDoUsuario(papel, modulos, isMaster)` | As trilhas a que a pessoa tem direito. Usa `moduloLiberado` de `modulos.ts`, sem redecidir a regra |
| `situacaoDaTrilha(trilha, conclusoes)` | `"nao_iniciada" \| "concluida" \| "desatualizada"` |
| `aulasQueMudaram(trilha, versaoConcluida)` | As aulas com `desdeVersao > versaoConcluida`. É o "não releia o que não mudou" |
| `corrigir(trilha, respostas)` | Acertos, total, e as perguntas erradas com a aula a revisar |
| `aprovado(acertos, total)` | Regra de aprovação — ver abaixo |
| `resumirPendencias(usuarios, conclusoes)` | Uma linha por pessoa, para o painel |
| `manualPorRota(trilhas)` | Índice do manual: rota → aulas que a cobrem |
| `respostasSchema` | Validação, importável pelo formulário cliente |

**Regra de aprovação: acerta tudo, ou refaz.** Com três a cinco perguntas,
qualquer nota de corte abaixo de 100% significa "pode errar uma" — e a pergunta
que a pessoa erra é exatamente a que ela precisava. Errar não bloqueia nem
pune: mostra o `porque`, aponta a aula, e o botão diz "revisar e tentar de
novo". O registro guarda `acertos`/`total` da tentativa que passou.

### `src/lib/data/treinamento.ts` — leitura

`conclusoesDoUsuario(perfilId)`, `conclusoesDaOrganizacao()` (para o painel) e
`usuariosComPendencia()`. Tipos planos, `import "server-only"`, `createClient()`.

### `src/app/(app)/treinamento/actions.ts` — escrita

`concluirTrilha(raw)` — valida as respostas, corrige **no servidor** (as
respostas corretas nunca vão ao cliente), gera o número de registro, grava com
`upsert` e devolve `ActionResult`.

**A correção é no servidor, e é o motivo de `Pergunta.correta` não sair no
payload da página.** Um questionário cujas respostas chegam ao navegador é um
questionário decorativo. A página manda enunciado e alternativas; a action
recebe os índices escolhidos.

## As telas

| Rota | O que é |
|---|---|
| `/treinamento` | As minhas trilhas, com situação e o que mudou. Ponto de entrada |
| `/treinamento/[trilha]` | A trilha: aulas em sequência, aulas mudadas destacadas, e o questionário no fim |
| `/treinamento/pendentes` | O painel de quem treinou e quem falta (master/administrador) |
| `/ajuda` | O manual: busca e índice por tela, lendo as mesmas aulas |
| `/api/treinamento/[trilha]/comprovante` | O comprovante em PDF, assinado |

**`/treinamento` e `/ajuda` não são módulos liberáveis.** Ficam disponíveis a
todo usuário autenticado, como `/perfil` e `/novidades` — e entram em
`SEM_MODULO` da varredura de rotas de `modulos.test.ts` com essa razão. Bloquear
o acesso ao manual seria trancar a porta e esconder a chave.

**`/treinamento/pendentes` é a exceção:** exige `podeEditarCadastros`, checado
na página, porque não é módulo e o proxy não o cobre.

**O que a trilha NÃO faz:** não bloqueia módulo nenhum. A decisão foi registrar
e cobrar — no dia em que o almoxarife precisar lançar uma saída urgente, ele
consegue.

## Comprovante

`FRM-TR-001`, pelos primitivos de `src/lib/pdf-form.tsx` que já existem:
identificação (nome, papel, trilha, versão), a lista de aulas percorridas, o
resultado do questionário, e a assinatura desenhada na tela via `SignaturePad`
com `Assinaturas modo="imagem"`. O texto de declaração vem de
`documento_template`, tipo `comprovante_treinamento`, editável em
Configurações — como todo documento do sistema.

## Testes

**Puros** (`src/lib/treinamento.test.ts`): trilhas por papel e por módulo, com
master vendo tudo; situação nas três formas; `aulasQueMudaram` com versão nova,
igual e antiga; correção com acerto total, erro parcial e resposta faltando;
aprovação só com 100%; `manualPorRota` agrupando aulas de trilhas diferentes na
mesma rota; e a varredura de integridade do conteúdo — **toda pergunta aponta
para uma aula que existe, todo `correta` está no intervalo das alternativas,
todo id de aula é único na trilha, e toda trilha tem pergunta**. Essa varredura
é a que impede conteúdo quebrado de chegar à tela, e ela vale para as 80 aulas
que vêm depois.

**Migration**, em Postgres local: a chave única impede duplicata na mesma
versão e permite versões diferentes; a policy de `select` deixa a pessoa ver o
seu e o administrador ver todos; a de `insert` recusa gravar por outro; e não há
`delete`.

## A trilha de primeiros passos entra NESTA fatia

Decisão de escopo, e ela resolve uma ambiguidade que a spec tinha: a máquina sem
conteúdo nenhum sobe com quatro telas vazias e **não é verificável** — nem por
mim, nem pelo Evandro na homologação. Então a fatia entrega a trilha
`primeiros-passos` completa, com aulas e questionário: entrar no sistema,
trocar a senha no primeiro acesso, o menu por grupos, achar uma obra, ver as
Novidades, e pedir acesso a um módulo que falta.

É a trilha mais curta, é a que todo mundo faz, e é a que prova a máquina de
ponta a ponta — trilha → aula → questionário → registro → comprovante em PDF.

As trilhas por módulo (Frota, Custódia, Termos, Estoque primeiro) vêm nas ondas
seguintes, cada uma com plano próprio, sem tocar na máquina.

## Registro no catálogo de documentos

`comprovante_treinamento` entra em `src/lib/templates.ts` em três pontos, no
mesmo movimento que `termo_equipamento` entrou na 0.49.0: a união
`TipoDocumento`, o catálogo `DOCUMENTOS` (com `modulo` — e aqui há uma
particularidade: treinamento **não é** `ModuloKey`, então o documento é
declarado no módulo mais próximo e a tela de Templates o mostra ali; a
alternativa seria alargar `ModuloKey`, o que quebraria a varredura de rotas) e
`DEFAULT_TEMPLATES` com o texto de declaração. A coluna `documento_template.tipo`
é `text` sem check, então não há migration para isso.

## Fora de escopo

O **conteúdo** dos módulos além de primeiros passos (vem em ondas, a próxima
sendo o grupo Equipamento). E-mail semanal de cobrança e painel por obra para o gestor — os
dois foram oferecidos e **não** escolhidos. Vídeo. Certificado com validade
externa. Trilha para usuário que não é do sistema.

## Risco conhecido

**A trilha que ninguém termina.** O risco não é técnico: é conteúdo longo. A
mitigação é de desenho e está no modelo — aula é unidade curta, com passos
concretos e o `esperado` que dá a sensação de progresso, e o questionário tem
três a cinco perguntas, não vinte. Se a primeira onda mostrar que ninguém
termina, o problema é o tamanho das aulas, e o modelo permite quebrá-las sem
tocar na máquina.
