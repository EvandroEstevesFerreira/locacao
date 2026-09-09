# A empresa dona da peça locada

**Data:** 2026-09-09
**Estado:** aguardando revisão

## O pedido

No cadastro da peça, sendo de terceiro, poder registrar a empresa responsável
pelo equipamento (no exemplo, a A2Works) — e amarrar esses cadastros ao contrato
de locação.

## O que já existe

A ponte peça↔contrato **já existe e é deliberada** (migration 0049):

- `item_catalogo.controle` = `'peca'` | `'quantidade'` — se o item é rastreado
  por patrimônio ou por lote;
- `item_locado.unidade_id` → `equipamento_unidade` — a linha do contrato aponta
  para a peça física. Nula quando o item é controlado por quantidade;
- `contrato_locacao.fornecedor_id` → a empresa locadora.

Logo, a empresa responsável **já é derivável hoje**:
`equipamento_unidade` ← `item_locado` → `contrato_locacao` → `fornecedor`.

O que falta não é a relação. É:

1. a tela da peça **não mostra** nada disso — exibe só o rótulo "Locada de
   terceiro", e o dono real vive em texto livre nas Observações ("ALUGADA —
   ainda sem contrato de locação no Loca · Com: Leonardo Apolinario (conforme
   planilha)");
2. não há como amarrar **do lado da peça** — hoje só o recebimento grava
   `unidade_id`;
3. as peças importadas da planilha não têm contrato no Loca, então derivar
   sozinho não resolve o presente.

## Decisões tomadas

- **Derivar do contrato, com dono provisório.** Amarrada a um contrato em
  aberto, a empresa vem dele — fonte única. Sem contrato, o dono informado à mão
  aparece marcado como provisório.
- **Amarração uma a uma, na tela da peça.** Sem operação em lote nesta fase.

## O modelo

### Precedência da empresa responsável

1. **Contrato em aberto:** `item_locado` com `status = 'em_aberto'` e
   `unidade_id` = a peça → `contrato_locacao.fornecedor_id`. **Manda sempre.**
2. **Provisório:** `equipamento_unidade.fornecedor_provisorio_id`, coluna nova.
3. Nada: "—".

O nome da coluna é `fornecedor_provisorio_id`, e não `fornecedor_id`, de
propósito: quem for ler o schema em seis meses precisa saber, pelo nome, que
aquilo não é a verdade — é o que alguém digitou enquanto a verdade não existia.
`fornecedor_id` convidaria a tratá-lo como autoritativo e a construir relatório
em cima dele.

### A contradição não fica escondida

Ao amarrar a peça a um contrato, o provisório é **limpo**, e a mensagem de
sucesso diz se ele divergia:

> Peça amarrada ao contrato CT-2026-001 (A2 WORKS). O dono provisório informado
> no cadastro era CONEXAO MONTAGENS e foi removido.

Deixar o provisório vivo ao lado do contrato criaria dois campos que podem se
contradizer sobre quem é o dono de um equipamento — e divergência sobre isso
aparece como cobrança errada. Limpar em silêncio seria decidir por quem
cadastrou; daí a mensagem nomear o que foi removido.

### Peça em dois contratos em aberto

**Não existe trava no banco** impedindo dois `item_locado` em aberto para a
mesma peça: a migration 0049 criou apenas um índice comum em `unidade_id`.

A derivação **não escolhe um e esconde o outro**. Quando há mais de uma linha em
aberto, o estado é `ambiguo` e a tela diz "esta peça consta em 2 contratos em
aberto" com os dois links. Escolher o primeiro produziria uma tela plausível e
errada sobre de quem é o equipamento.

**Recomendação separada, e que NÃO entra nesta fase:** índice único parcial
`unique (unidade_id) where status = 'em_aberto' and unidade_id is not null`.
Não entra porque não sei se os dados de produção já violam isso — e uma
migration que falha ao aplicar é pior que o defeito que ela previne. O caminho é
medir primeiro (uma consulta), depois decidir.

## A amarração, e a consequência não óbvia

`unidade_id` mora em `item_locado`, **não** em `equipamento_unidade`. Então
"escolher o contrato desta peça" é, na verdade, **anexar a peça a uma linha em
aberto daquele contrato** — e só serve linha que:

- pertença ao contrato escolhido;
- seja do **mesmo `item_id` do catálogo** que a peça;
- esteja com `status = 'em_aberto'`;
- tenha `unidade_id` nulo.

Se o contrato não tiver linha assim, a amarração não acontece, e a tela precisa
dizer **por quê**, com nome:

> O contrato CT-2026-001 não tem linha em aberto de "Lenovo ThinkStation P360"
> sem peça vinculada. Acrescente o item ao contrato ou escolha outro contrato.

Um seletor que ofereça contratos e falhe genericamente seria pior que não
existir: a pessoa tenta três contratos sem entender o critério.

## Onde aparece

- **Tela da peça:** campo "Empresa responsável" ao lado de "Propriedade", com o
  contrato como link. Só quando `propriedade = 'locada'`. Provisório sai com o
  sufixo "(informado no cadastro, sem contrato)".
- **Cadastro da peça** (`peca-editar.tsx`, que hoje tem 12 campos e nenhum de
  propriedade ou dono): ganha "Contrato de locação" e "Empresa responsável
  (provisório)", ambos visíveis só para peça locada. O provisório fica
  desabilitado quando há contrato em aberto, com a explicação ao lado.

## Migration

`0098_dono_da_peca.sql`:

```sql
alter table public.equipamento_unidade
  add column if not exists fornecedor_provisorio_id uuid
    references public.fornecedor (id) on delete set null;
```

Mais índice parcial `where fornecedor_provisorio_id is not null`. Sem tabela
nova, sem alteração de dado existente.

## Testes

- **Por TDD, pura:** `donoDaPeca({ linhasEmAberto, fornecedorProvisorio })`,
  devolvendo união discriminada — `{ origem: 'contrato' }` |
  `{ origem: 'provisorio' }` | `{ origem: 'ambiguo' }` | `{ origem: 'nenhum' }`.
  Mesma forma de `avisoEnvio` e `efeitoDaEdicao`, que é o padrão do projeto para
  "o que a tela deve dizer". Casos: contrato manda sobre provisório; duas linhas
  em aberto dão ambíguo; linha devolvida **não** conta.
- **Por TDD, pura:** `linhasElegiveis(contrato, peca)` — o critério das quatro
  condições acima, que é onde o erro silencioso moraria.
- Leitura em `src/lib/data/` com tipo **plano**, sem expor a ambiguidade
  `T | T[] | null` do PostgREST.

## O que este spec NÃO faz

- Não amarra em lote. Foram 128 peças no levantamento da Frota, e o mutirão
  inicial continua manual — é decisão sua, tomada com o dado à mão.
- Não lê as Observações em texto livre para adivinhar o dono. "Com: Leonardo
  Apolinario (conforme planilha)" é nome de pessoa, não de empresa; e adivinhar
  a partir de texto de planilha erraria em silêncio num campo que vira cobrança.
- Não cria o índice único (ver acima).
- Não torna `propriedade` editável na peça. Está no `unidadeSchema` mas fora do
  formulário, e mudá-la tem consequência no livro de custódia — outro pedido.

## Riscos

1. **O provisório vira muleta.** Se ninguém cadastrar os contratos, o campo
   provisório passa a ser a verdade de fato, com nome dizendo o contrário. O
   sufixo na tela ("sem contrato") é o que mantém isso visível; se em três meses
   a maioria das peças ainda estiver provisória, o problema é de processo, não
   de software.
2. **Peça em dois contratos.** Existe hoje e o spec o expõe em vez de corrigir.
   Expor é a escolha certa para começar — mas é um defeito que fica no ar até a
   medição e o índice.
3. **Contrato errado amarrado.** `on delete set null` na FK, e a amarração é
   reversível pela mesma tela. `item_locado` é auditado pelo trigger da 0031,
   então quem amarrou fica registrado.
