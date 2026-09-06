# Inventário de TI no cadastro de itens — design

**Data:** 2026-09-05
**Fonte:** `Referencias/Importacao/Máquinas Sistenge.xlsx`
**Status:** aprovado nas decisões, aguardando revisão do documento

---

## O problema

O parque de TI da Sistenge vive numa planilha. Ela responde *quantas* máquinas
existem e, quando está em dia, *com quem* cada uma está. Não responde nada mais:
não sabe que uma máquina foi devolvida ao locador em março, não sabe qual termo
de responsabilidade cobre qual equipamento, e não sabe avisar que o termo do
Marcio venceu quando ele trocou de notebook.

O Loca já sabe tudo isso — para betoneira, andaime e gerador. Falta o inventário
entrar.

## O que a planilha tem, de verdade

Quatro abas. Contagens conferidas, não estimadas:

| Aba | Linhas | Conteúdo |
|---|---|---|
| `ATIVAS.` | 127 | 17 colunas: SO, processador, RAM, armazenamento, TAG, garantia |
| `MÁQUINAS CONDENADAS` | 35 | descarte (26), furtada (1), vendida (1), diversas |
| `DEVOLVIDAS` | 13 | alugadas devolvidas ao locador + 2 monitores quebrados |
| `Planilha2` | 68 | rascunho de conferência de seriais — **não importa** |

**175 máquinas** entram. `Planilha2` fica de fora: é área de trabalho de quem
montou a planilha, não cadastro.

### O que está sujo, e por quê importa

Levantado lendo a planilha inteira, não por amostragem:

1. **Colunas deslocadas.** A coluna `MEMORIA RAM TOTAL` contém datas
   (`2023-06-30`, `31/10/2022`). A coluna `MODELO HD` contém `8 GB` e
   `7,922 GB`. A coluna `ARMAZENAMENTO` contém `16GB`. Algumas linhas
   escorregaram uma casa na digitação.

2. **33 grafias para 27 modelos reais.** `Accer - TravelMate P214-55`,
   `Acer TravelMate P214-55` e `TravelMate P214-55` são a mesma máquina.
   `OptPlex 7070`, `ThinkCenter`, `Vostro 3510`, `Latitude 3411`,
   `Latitude 3441` são erros de digitação confirmados.

3. **A coluna `USUÁRIOS` não é uma coluna de pessoas.** Entre os valores
   distintos: `LIVRE`, `LIVRE - 7º ANDAR`, `LIVRE - DATA CENTER`,
   `LIVRE - COM ISABEL`, `OBRA`, `Rack`, `Servidor`, `Servidor Hortolandia`,
   `Almoxarifado`, `PASELI`, `Time de Orçamentos`, `Monitor 0109947`,
   `Obsoleta`. E duplicatas por caixa e acento: `Andrea MArques` /
   `Andrea Marques`, `Livre` / `LIVRE`. Um valor vem em formato de login:
   `Rodrigo.Ferreira`.

4. **7 TAGs que não são service tag.** Duas são chave de licença do Windows
   (`00355-62529-31139-AAOEM`); cinco são seriais longos de Acer/Lenovo, que
   são legítimos mas não seguem o formato Dell de 7 caracteres.

5. **Datas de garantia impossíveis.** `28/11/20217`, `46099` (serial do Excel
   não convertido), e o texto `Alugada` no lugar da data.

6. **Códigos de obra que não batem com o Loca.** A planilha diz
   `Obra - 605 - Fator Tawer`; a obra 605 cadastrada é **Unimed Maceió**. E
   `Obra - 685 - ELEA` não existe no cadastro de obras.

Nenhum desses itens é motivo para adiar a importação. Todos são motivo para a
prévia existir.

## Decisões tomadas

Sete decisões, todas do Evandro, em 05/09/2026:

| # | Decisão |
|---|---|
| 1 | O e-mail fica em **`funcionario.email`**, não na peça |
| 2 | Derivar `nome.sobrenome@sistenge.com`, marcado como **não confirmado** |
| 3 | Importar as **três** abas — 175 máquinas |
| 4 | As alugadas **viram contrato de locação** (fase D, quando houver dados) |
| 5 | Sequência **A → B → C**; D quando os dados do contrato existirem |
| 6 | Departamentos administrativos → obra **Administração (800)**, cada um como **frente de serviço** |
| 7 | Linha com coluna deslocada: **importa e vira pendência**, não é recusada |
| 8 | Termo por e-mail: **PDF assinado primeiro**, link remoto como fase própria |

### Por que o e-mail não fica na peça

O pedido original era o e-mail no cadastro do equipamento. São 127 máquinas para
cerca de 110 pessoas — o endereço de quem tem três máquinas ficaria gravado três
vezes. Pior: **quando a máquina troca de mão, o e-mail que está nela é o do
detentor anterior**, e é para lá que a cópia do termo sairia. Errado, e em
silêncio.

É o mesmo defeito que este sistema já pagou três vezes: as obras do fornecedor
mantidas à mão ao lado dos contratos, o `STATUS_AVARIA` declarado em dois
arquivos, a família do equipamento escrita dentro da descrição.

O equipamento chega ao e-mail pela **custódia**, que é quem sabe quem responde
por ele hoje.

---

## Fase A — E-mail do funcionário e a chave da ficha

Duas mudanças pequenas que **têm de vir antes** da importação, porque a
importação grava em cima das duas.

### A.1 — O defeito já gravado no banco

O tipo `DESKTOP` criado pela tela está assim em produção:

```
Memória RAM   → chave "m"
Processador   → chave "p"
Armazenamento → chave "a"
```

A causa está em `src/app/(app)/configuracoes/catalogo/ficha-editor.tsx`:

```ts
const novo = campo.chave === "";
```

Na **primeira** tecla do rótulo a chave vira `"m"`; `novo` passa a ser falso; as
letras seguintes não realimentam mais a chave. Toda chave gerada pela tela é a
primeira letra do rótulo.

Não é cosmético. Dois rótulos com a mesma inicial — "Memória RAM" e "Modelo" —
produzem a mesma chave, e `camposFichaSchema` recusa o salvamento com *"Há dois
campos com a mesma chave"*, uma chave que o usuário nunca digitou. A mensagem é
verdadeira e inútil.

**Correção:** rastrear a origem da chave em estado próprio, e não inferi-la do
valor. O campo nasce com `chaveManual: false`; a chave segue o rótulo enquanto
isso for verdade; editar a chave à mão liga a trava. Campo já gravado no banco
chega com a chave fixa, como hoje — mudá-la orfanaria os valores das peças.

**Migração dos dados existentes:** o tipo `DESKTOP` é o único afetado. Existe
uma peça apontando para ele — `PAT-00001`, do item de teste "Dell Optiplex 380"
— e a `ficha` dela está **vazia** (`{}`). Reescrever `m`/`p`/`a` para
`memoria_ram`/`processador`/`armazenamento` não orfana valor nenhum.

**Conferir antes de aplicar**, porque a segurança vem do dado e não do desenho:

```sql
select count(*) from equipamento_unidade u
  join item_catalogo i on i.id = u.item_id
  where i.tipo_id = <id do DESKTOP> and u.ficha <> '{}'::jsonb;
```

Se não for zero, a migration precisa renomear as chaves **dentro das fichas**
na mesma transação, e não só no `campos_ficha` do tipo.

Enquanto isso: o item "Dell Optiplex 380" e a peça `PAT-00001` são teste e não
têm `categoria_id`. Decidir na fase B se são apagados ou absorvidos — um item
sem categoria não aparece nos filtros do catálogo e vira lixo invisível.

**Teste que prova a correção antes de aceitá-la:** um teste que simula digitar
"Memória RAM" caractere a caractere e verifica que a chave final é
`memoria_ram`, não `m`. Sem digitar caractere a caractere o teste passa com o
código defeituoso.

### A.2 — `funcionario.email`

```sql
alter table public.funcionario
  add column if not exists email text,
  add column if not exists email_confirmado boolean not null default false;

create unique index if not exists idx_funcionario_email
  on public.funcionario (org_id, lower(email)) where email is not null;
```

**`email_confirmado` existe porque o e-mail vai ser adivinhado.** Um endereço
derivado de `nome.sobrenome` é um palpite bem-informado, não um fato. A coluna
separa "temos um palpite" de "alguém conferiu", e a regra que ela sustenta é
dura: **nenhum termo sai para endereço não confirmado.** Sem a coluna, o
primeiro envio em massa descobriria os erros como bounces — ou, pior, entregando
o termo de responsabilidade de um funcionário no e-mail de outro.

O `unique` é parcial e por `lower(email)`: duas pessoas não dividem um e-mail
corporativo, e `Marcio.Oliveira@` e `marcio.oliveira@` são o mesmo endereço.

**Regra de derivação:**

1. Normalizar o nome: remover acentos, minúsculas, colapsar espaços.
2. Primeiro nome + último sobrenome, unidos por ponto.
3. `@sistenge.com`.

Casos que **não** geram e-mail, e por quê:

- **Nome com uma palavra só** (`Lourival`) — não dá para formar
  `nome.sobrenome`.
- **Colisão** — se dois funcionários derivam o mesmo endereço, nenhum dos dois
  recebe. `Andrea MArques` e `Andrea Marques` são o exemplo vivo, e são
  provavelmente a mesma pessoa digitada duas vezes: o palpite certo aqui é
  *não* palpitar.
- **Valor que não é pessoa** — a lista de exclusão da fase B.

Verificado: entre os 97 funcionários já cadastrados **não há nenhuma colisão** —
a regra produz 97 endereços distintos. As colisões, se houver, virão dos nomes
novos que a planilha trouxer.

**Na tela:** o formulário de funcionário ganha o campo de e-mail. Endereço
derivado e não confirmado aparece com aviso visível; salvar o campo à mão marca
`email_confirmado = true`, porque digitar é confirmar.

---

## Fase B — A importação

Reescrita de `scripts/db/importar-inventario-ti.mjs`. O script atual está no
`main` (commit `891fcc6`) e serve à planilha de julho: uma aba, 135 linhas, e o
catálogo de **antes** da 0.65.0 — sem `natureza`, sem `tipo_equipamento`, sem
`ficha`. Não há o que reaproveitar além da lista de exclusão e do mapa de
grafias.

### Os quatro níveis

O catálogo da 0.65.0 tem quatro níveis, e o inventário de TI cai neles sem
forçar:

```
Categoria TI  (já existe)
  └─ Tipo NOTEBOOK / DESKTOP / SERVIDOR / MONITOR   ← define a ficha
       └─ Item "Latitude 3410"                       ← o QUÊ (o modelo)
            └─ Peça 4L1KL22                          ← o QUAL (a máquina)
```

O tipo é derivado do **modelo**, nunca da coluna `TIPO DO DISPOSITIVO`: duas
linhas declaram um OptiPlex como notebook. Um OptiPlex é desktop, e a coluna
está errada.

### A ficha, por tipo

Só entra na ficha o que **não tem coluna nativa**. Duplicar `memoria_gb` dentro
do jsonb seria criar as duas cópias que divergem.

| Campo nativo de `equipamento_unidade` | Origem na planilha |
|---|---|
| `identificador` | TAG / NÚMERO DO SERIAL |
| `service_tag` | TAG |
| `memoria_gb` | `MEMORIA RAM TOTAL`, arredondado (`7,956 GB` → 8) |
| `situacao` | STATUS |
| `propriedade` | nome do dispositivo (`ALUGADA` → locada) |
| `obra_id` | DEPARTAMENTO |
| `observacoes` | OBSERVAÇÃO + OBSERVAÇÃO DO DISPOSITIVO + VALIDAÇÃO |

Ficha de NOTEBOOK, DESKTOP e SERVIDOR:

| Chave | Rótulo | Tipo |
|---|---|---|
| `nome_dispositivo` | Nome do dispositivo | texto |
| `sistema_operacional` | Sistema operacional | lista |
| `processador` | Processador | texto |
| `armazenamento` | Armazenamento | texto |
| `tipo_disco` | Tipo de disco | lista (SSD, NVMe, Rígido) |
| `garantia_ate` | Garantia até | data |

MONITOR fica só com `nome_dispositivo`: os dois monitores da planilha não têm
processador nem disco, e uma ficha com cinco campos vazios é ruído.

As **10 grafias** de sistema operacional (`Microsoft Windows 11 Pro` e
`Microsoft Windows 11 Professional` são o mesmo SO) viram **6 opções** de lista.

### O mapa de situação

| Aba | Valor na planilha | `situacao` | `ativo` |
|---|---|---|---|
| ATIVAS | `Ativo` | `em_uso` | true |
| ATIVAS | `Reserva`, `LIVRE`, `Não Possui` | `disponivel` | true |
| CONDENADAS | `DESCARTE`, `vendido` | `baixada` | false |
| CONDENADAS | `FURTADA` | `perdida` | false |
| DEVOLVIDAS | qualquer | `disponivel` + `propriedade = locada` | false |

### As alugadas

40 máquinas — 27 ativas (`NS-ALUGADA-xx`, `WS-ALUGADA-xx`) e as 13 devolvidas.
Entram com `propriedade = 'locada'` e **sem contrato**, porque o contrato exige
dados que a planilha não tem. Ver fase D.

O script imprime a lista das 40 ao final, para que a pendência seja visível e
não descoberta meses depois.

### Departamento → obra, e departamento → frente

Os departamentos administrativos (RH, Financeiro, Diretoria, Suprimentos,
Engenharia, Orçamentos, Comercial, Projetos, Planejamento, SMS) caem todos na
obra **Administração (800)**, e cada um vira uma **frente de serviço** dentro
dela — o mecanismo da 0.68.0. É o que faz o custo descer de "Administração"
para "RH".

Os departamentos de obra caem na obra pelo código: `608`, `659`, `691`, `680`.

**Duas exceções que o script não resolve sozinho e por isso vira pendência:**

- `605` — a planilha chama de "Fator Tawer", o Loca chama de "Unimed Maceió".
  São 4 máquinas alugadas. O script **não** associa: nome divergente com código
  igual é exatamente o caso em que adivinhar erra.
- `685 — ELEA` — não existe no cadastro de obras. 2 máquinas. Ficam sem obra e
  aparecem na pendência.

### A prévia é obrigatória

```
node scripts/db/importar-inventario-ti.mjs            # imprime o plano, não grava
node scripts/db/importar-inventario-ti.mjs --aplicar  # grava
```

Foi a prévia que pegou os defeitos do importador anterior antes de gravarem —
funcionários chamados "Disponivel", "Rack" e "Devolvida(alugada)". Ela imprime,
sempre:

- quantos tipos, itens, peças e funcionários seriam criados e quantos atualizados;
- a lista das linhas com **coluna deslocada** e qual campo ficará vazio;
- a lista das **40 alugadas sem contrato**;
- a lista dos **e-mails derivados**, com os que colidiram ou não puderam ser
  formados;
- as máquinas **sem obra** (605, 685, e as sem departamento).

### Idempotência

Chave de cada nível, na ordem em que o script resolve:

| Nível | Chave |
|---|---|
| Tipo | `(org, categoria, nome)` — já é `unique` no banco |
| Item | `(org, descricao)` — **falta o `unique`, ver abaixo** |
| Peça | `(org, identificador)` — já é `unique` no banco |
| Funcionário | `(org, nome normalizado)` |

`item_catalogo` **não tem** índice único em `(org_id, descricao)`. Sem ele, a
segunda execução do script cria 27 modelos duplicados em silêncio. A migration
da fase B acrescenta:

```sql
create unique index if not exists idx_item_catalogo_descricao
  on public.item_catalogo (org_id, lower(descricao));
```

Seguro hoje: `item_catalogo` tem **1 linha**. **Conferir a contagem de
duplicatas antes de aplicar** — se houver, a migration falha e é isso que se
quer.

### Custódia NÃO nasce da importação

`custodia_funcionario_exige_termo` (migration 0059) exige termo assinado para a
peça constar com uma pessoa, e a regra está certa: **uma planilha não é fonte de
verdade sobre quem respondeu pelo equipamento.** Ninguém assinou nada ao digitar
aquela célula.

O detentor fica anotado na observação da peça. A posse nasce quando o termo for
assinado — que é a fase C.

---

## Fase C — Termo de responsabilidade por e-mail

### C.1 — O PDF assinado vai para o funcionário

Hoje o termo é assinado **na tela, na hora**, com imagem da assinatura e IP
registrado (`emitirTermo`, em `src/app/(app)/termos/actions.ts`). Não existe
envio de e-mail em termos — devolução e recebimento têm, termos não.

C.1 fecha essa lacuna pelo caminho que já funciona duas vezes neste sistema: ao
emitir, o PDF do FRM-EQ-001 vai para o e-mail do funcionário, e a tela do termo
emitido ganha **REENVIAR**.

Três regras herdadas de devolução e recebimento, e uma nova:

- **Do e-mail para trás nada é desfeito.** Se o Resend cair, o termo continua
  emitido e assinado. O envio é entrega de cópia, não parte do ato.
- **REENVIAR existe porque a emissão é irreversível e o envio não.**
- **O estado do envio fica visível na tela.** "Enviado" e "falhou" são coisas
  diferentes e quem opera precisa distinguir.
- **Nova:** funcionário com `email_confirmado = false` **não recebe**. A tela diz
  qual é o endereço derivado e pede confirmação. O termo é emitido do mesmo
  jeito.

### C.2 — Assinatura à distância (fase própria, não desenhada aqui)

O link que a pessoa abre no celular e assina sem estar na frente de quem entrega
resolve as obras e quem está em campo. Mas é subsistema novo, com decisões que
esta spec não tem base para tomar:

- rota pública sem sessão, e o que ela pode ler;
- token com validade, uso único e revogação;
- **o que passa a valer como prova** quando ninguém viu quem clicou — hoje o IP
  e a imagem são colhidos com o operador presente.

Fica registrado como pendente, com desenho próprio. Não é escopo desta spec.

---

## Fase D — Contratos de locação de TI

**Bloqueada por dados, não por desenho.**

O que o banco exige e a planilha não tem:

```
contrato_locacao.obra_id                 NOT NULL
contrato_locacao.fornecedor_id           NOT NULL
contrato_locacao.numero                  NOT NULL
contrato_locacao.data_inicio             NOT NULL
item_locado.valor_unitario_periodo       NOT NULL
item_locado.data_retirada                NOT NULL
```

E `obra_id NOT NULL` tem uma consequência aritmética: as 27 alugadas ativas
estão espalhadas por 12 departamentos, que caem em **7 obras**. Para prendê-las
seriam **7 contratos**, cada um com número, fornecedor, data e valor mensal —
todos inventados.

Esses valores alimentam o custo por obra, o custo por frente, os relatórios e o
PDF que vai ao cliente. **Um número plausível e falso num relatório financeiro é
pior que um campo vazio**, porque ninguém desconfia dele.

O que falta, por fornecedor: nome/CNPJ, número do contrato, data de início,
cadência e valor mensal por máquina.

Prender as peças ao contrato depois **não é retrabalho**: é um `insert` em
`item_locado` apontando para o `equipamento_unidade` que a fase B já criou.

**Se for um contrato só, com rateio interno por obra**, o desenho muda: o
`obra_id NOT NULL` do `contrato_locacao` passa a ser a restrição errada, e isso
é uma conversa maior que esta spec não abre.

---

## Ordem e critério de pronto

| Fase | Entrega | Pronto quando |
|---|---|---|
| **A** | `funcionario.email` + chave da ficha | Digitar "Memória RAM" na tela gera `memoria_ram`; o formulário de funcionário salva e-mail |
| **B** | 175 máquinas no cadastro | A prévia roda limpa, o `--aplicar` grava, e a **segunda** execução cria 0 e atualiza 175 |
| **C.1** | PDF do termo por e-mail | Termo emitido chega ao e-mail confirmado; REENVIAR funciona; e-mail não confirmado não recebe |
| **D** | Contratos das 40 alugadas | Depende dos dados comerciais |

Cada fase fecha com o ritual do `AGENTS.md` — `typecheck`, `lint`, `test`,
`build` — e com versão bumpada nos três pontos.

---

## O que esta spec não resolve

Registrado para não virar surpresa:

1. **A assinatura à distância** (C.2) precisa de desenho próprio de segurança.
2. **Os contratos** (D) precisam de dados que não existem em lugar nenhum
   consultável por mim.
3. **A obra 605** — "Fator Tawer" na planilha, "Unimed Maceió" no Loca. Alguém
   precisa dizer qual das duas está certa.
4. **A obra 685 — ELEA** não existe no cadastro. Duas máquinas dependem dela.
5. **Nenhuma tela autenticada foi aberta num navegador** em todo o módulo de
   equipamento. A fase A é a primeira que produz uma tela verificável em poucos
   cliques — e é por isso que ela vem antes.
