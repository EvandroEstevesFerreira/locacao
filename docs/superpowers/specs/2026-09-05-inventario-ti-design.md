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

| Aba | Linhas | Entra? |
|---|---|---|
| `ATIVAS.` | 127 | **Sim** — 17 colunas: SO, processador, RAM, armazenamento, TAG, garantia |
| `MÁQUINAS CONDENADAS` | 35 | Não |
| `DEVOLVIDAS` | 13 | Não |
| `Planilha2` | 68 | Não — rascunho de conferência de seriais |

**127 máquinas** entram: só a aba `ATIVAS.`, por decisão do Evandro em
05/09/2026. O cadastro passa a refletir **o parque que existe hoje**, e não o
histórico do que já saiu.

O que isso custa, dito para não virar surpresa: o Loca não vai saber que a
`D42LLG2` foi **furtada** nem que a `C2S9YR2` foi **vendida** — para ele elas
simplesmente nunca existiram. Se um dia essas 48 máquinas precisarem entrar (por
auditoria, seguro ou inventário patrimonial), o caminho é o mesmo script com as
outras abas ligadas, e as chaves de idempotência garantem que as 127 já
importadas não se dupliquem.

Consequência imediata do recorte: **não há monitor nenhum na aba `ATIVAS.`** —
os dois estavam em `DEVOLVIDAS`. O tipo MONITOR sai do desenho. Ficam três
tipos: NOTEBOOK, DESKTOP, SERVIDOR.

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

6. **Códigos de obra que não batem com o Loca.** Resolvido pelo Evandro em
   05/09/2026, e o que sobrou está na seção "Departamento → obra".

Nenhum desses itens é motivo para adiar a importação. Todos são motivo para a
prévia existir.

## Decisões tomadas

Sete decisões, todas do Evandro, em 05/09/2026:

| # | Decisão |
|---|---|
| 1 | O e-mail fica em **`funcionario.email`**, não na peça |
| 2 | Derivar `nome.sobrenome@sistenge.com`, marcado como **não confirmado** |
| 3 | Importar **só a aba `ATIVAS.`** — 127 máquinas |
| 4 | As alugadas **viram contrato de locação** (fase D, quando houver dados) |
| 5 | Sequência **A → B → C**; D quando os dados do contrato existirem |
| 6 | Departamentos administrativos → obra **Administração (800)**, cada um como **frente de serviço** |
| 7 | Linha com coluna deslocada: **importa e vira pendência**, não é recusada |
| 8 | Termo por e-mail: **PDF assinado primeiro**, link remoto como fase própria |
| 9 | Obra **605 é Fator Towers** — é a mesma obra, pode unificar |
| 10 | **ELEA (685)** não vira obra: suas máquinas vão para **659 — Unimed Contagem** |
| 11 | Fornecedores das alugadas: **Voke** e **A2Works** |

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
  └─ Tipo NOTEBOOK / DESKTOP / SERVIDOR             ← define a ficha
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

Os três tipos usam a mesma ficha. Um servidor sem tela e um notebook pedem os
mesmos seis dados; separar as fichas aqui seria três cópias que divergem na
primeira vez que alguém acrescentar um campo.

As **10 grafias** de sistema operacional (`Microsoft Windows 11 Pro` e
`Microsoft Windows 11 Professional` são o mesmo SO) viram **6 opções** de lista.

### O mapa de situação

Só a aba `ATIVAS.`, então só quatro valores de `STATUS`:

| `STATUS` | Linhas | `situacao` | `ativo` |
|---|---|---|---|
| `Ativo` | 113 | `em_uso` | true |
| `Reserva` | 10 | `disponivel` | true |
| `LIVRE` | 2 | `disponivel` | true |
| `Não Possui` | 2 | `disponivel` | true |

`baixada` e `perdida` não são usados: as máquinas que os justificariam estão nas
abas que ficaram de fora.

### As alugadas

**27 máquinas** — `NS-ALUGADA-xx` e `WS-ALUGADA-xx`. Entram com
`propriedade = 'locada'` e **sem contrato**, porque o contrato exige dados que a
planilha não tem. Ver fase D.

O script imprime a lista das 27 ao final, para que a pendência seja visível e
não descoberta meses depois.

### Departamento → obra, e departamento → frente

A coluna `DEPARTAMENTO` tem 24 valores distintos. O mapa completo, sem nenhum
"etc.":

| Valor na planilha | Máquinas | Vai para |
|---|---|---|
| `608 - Dante` | 31 | obra **608** Racional Dante |
| `Obra - 659 - Contagem` | 13 | obra **659** Unimed Contagem |
| `Obra - 605 - Fator Tawer` | 12 | obra **605** *(ver nota abaixo)* |
| `691 - GAROA` | 8 | obra **691** Racional Garoa |
| `Obra - 680 - Equinix` | 5 | obra **680** Equinix SP4 |
| `Obra - 685 - ELEA` | 2 | obra **659** Unimed Contagem — decisão do Evandro |
| `ORÇAMENTOS` | 8 | obra **800** + frente *Orçamentos* |
| `RH` | 6 | obra **800** + frente *RH* |
| `DIRETORIA` | 5 | obra **800** + frente *Diretoria* |
| `SUPRIMENTOS` | 4 | obra **800** + frente *Suprimentos* |
| `FINANCEIRO` | 4 | obra **800** + frente *Financeiro* |
| `ENGENHARIA` | 2 | obra **800** + frente *Engenharia* |
| `PROJETOS` | 2 | obra **800** + frente *Projetos* |
| `SMS` | 2 | obra **800** + frente *SMS* |
| `COMERCIAL` | 1 | obra **800** + frente *Comercial* |
| `PLANEJAMENTO` | 1 | obra **800** + frente *Planejamento* |
| `DEPOSITO` | 1 | obra **800** + frente *Depósito* |
| `Deposito - Nova Máquina` | 1 | obra **800** + frente *Depósito* |
| `RESERVA` | 11 | **sem obra** — é estoque de reserva, não está em lugar nenhum |
| `N/A` | 3 | **sem obra** |
| *(vazio)* | 1 | **sem obra** |
| `OBRA` | 2 | **pendência** — diz que é obra, não diz qual |
| `PASELI` | 1 | **pendência** — não é departamento nem obra conhecida |
| `ENTREGUE COM USUÁRIO COMUM` | 1 | **pendência** — é um estado, não um lugar |

**Sem obra** e **pendência** são coisas diferentes de propósito. `RESERVA` e
`N/A` estão corretamente sem obra: a máquina está na prateleira. As quatro
últimas linhas são valores que *deveriam* dizer um lugar e não dizem — elas
entram no cadastro sem obra **e** aparecem na lista de pendências da prévia,
para alguém decidir.

**Nota sobre a obra 605.** O Evandro confirmou que a `605 - Fator Tawer` da
planilha é a mesma obra `605` do Loca — as 12 máquinas são associadas
diretamente. Sobra um detalhe que **não** é do escopo desta spec e fica
registrado: no cadastro de obras, a 605 chama-se **"Unimed Maceió"**, e os dois
contratos de locação ativos (SJUSTINO e CONEXAO) estão pendurados nela. Se o
nome certo é "Fator Towers", quem renomeia é uma tela, não este importador.

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
- a lista das **27 alugadas sem contrato**;
- a lista dos **e-mails derivados**, com os que colidiram ou não puderam ser
  formados;
- as **4 máquinas em pendência de lugar** (`OBRA`, `PASELI`,
  `ENTREGUE COM USUÁRIO COMUM`) — distintas das 15 que estão corretamente sem
  obra.

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

E `obra_id NOT NULL` tem uma consequência aritmética. Com o remapeamento de
ELEA para 659, as 27 alugadas caem assim:

| Obra | Alugadas |
|---|---|
| Administração (800) | 8 |
| Unimed Contagem (659) | 7 — inclui as 2 que vinham de ELEA |
| 605 | 4 |
| Racional Dante (608) | 4 |
| Racional Garoa (691) | 3 |
| Equinix SP4 (680) | 1 |

**Seis contratos, no mínimo** — e o mínimo só vale se cada obra tiver um
fornecedor só. Com dois fornecedores misturados numa obra, são mais.

Esses valores alimentam o custo por obra, o custo por frente, os relatórios e o
PDF que vai ao cliente. **Um número plausível e falso num relatório financeiro é
pior que um campo vazio**, porque ninguém desconfia dele.

### Os fornecedores

**Voke** e **A2Works**, informados pelo Evandro em 05/09/2026.

Voke **já está cadastrada** no Loca: `Voke SA`, CNPJ 04.212.396/0001-91, contato
`fatima.campelo@voke.tech`. A2Works ainda não existe e precisa de cadastro.

### O que ainda falta, e por que não dá para adivinhar

**Qual máquina é de qual fornecedor.** Procurei na planilha inteira — coluna,
observação, texto livre — e **não há uma única menção** a Voke ou A2Works. O
único padrão visível é a marca:

| Marca | Alugadas |
|---|---|
| Dell — Latitude 3410/3411, Vostro 15 3510 | 21 |
| Acer — TravelMate P214-55 | 4 |
| Lenovo — ThinkBook, ThinkStation P360 | 2 |

É tentador supor que um fornecedor entrega Dell e o outro Acer. A spec **não**
supõe: uma máquina no contrato errado joga o custo na fatura errada do mês
seguinte, e o relatório fecha certo com o número errado.

Falta, por fornecedor: **quais TAGs**, **número do contrato**, **data de
início**, **cadência** e **valor mensal por máquina**.

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
| **B** | 127 máquinas no cadastro | A prévia roda limpa, o `--aplicar` grava, e a **segunda** execução cria 0 e atualiza 127 |
| **C.1** | PDF do termo por e-mail | Termo emitido chega ao e-mail confirmado; REENVIAR funciona; e-mail não confirmado não recebe |
| **D** | Contratos das 27 alugadas | Depende dos dados comerciais |

Cada fase fecha com o ritual do `AGENTS.md` — `typecheck`, `lint`, `test`,
`build` — e com versão bumpada nos três pontos.

---

## O que esta spec não resolve

Registrado para não virar surpresa:

1. **A assinatura à distância** (C.2) precisa de desenho próprio de segurança.
2. **Quais TAGs são da Voke e quais são da A2Works** (D). Não está na planilha,
   e a marca do equipamento não é resposta.
3. **O nome da obra 605.** A planilha chama de "Fator Towers" e o Evandro
   confirmou que é essa; o cadastro do Loca diz "Unimed Maceió", com dois
   contratos de locação pendurados nela. A associação das 12 máquinas está
   decidida; **renomear a obra não está**, e não é este importador que renomeia.
4. **As 4 máquinas sem lugar** — `OBRA`, `PASELI` e
   `ENTREGUE COM USUÁRIO COMUM`. Entram sem obra e ficam na lista de pendências.
5. **As 48 máquinas de `CONDENADAS` e `DEVOLVIDAS`** ficaram fora por decisão.
   O Loca não saberá que uma foi furtada e outra vendida. Se um dia precisarem
   entrar, é o mesmo script com as outras abas ligadas.
6. **Nenhuma tela autenticada foi aberta num navegador** em todo o módulo de
   equipamento. A fase A é a primeira que produz uma tela verificável em poucos
   cliques — e é por isso que ela vem antes.
