# Integração People → Loca: a base de pessoas

> Decisões do lado do **Loca**, em 07/09/2026. O contrato da API é do People e
> vive em `Referencias/Importacao/api-pessoas-loca.md` — **fora do git**, porque
> traz nomes de pessoas reais. Este documento cita números, nunca nomes.

## O problema

`public.funcionario` tem 118 linhas digitadas à mão, com **zero CPF, zero
matrícula e zero CNH**. O People é a fonte da verdade de pessoa na Sistenge e
tem 483 pessoas no recorte acordado (265 ativos, 8 afastados, 210 desligados de
2026).

Desligado entra no recorte porque **pode estar com equipamento na mão** — é o
caso que motivou incluí-los, e hoje o Loca não tem como fazer essa pergunta.

## O que a API entrega, e o que não entrega

Entrega: `id`, `nome`, `cpf`, `matricula`, `cargo`, `email`, `telefone`,
`vinculo`, `situacao`, `admissao`, `desligamento`, `centro_custo` e
`atualizado_em`.

**Não entrega CNH.** O People não guarda categoria nem validade em coluna
nenhuma. As três colunas `cnh`, `cnh_categoria` e `cnh_validade` da migration
0086 continuam sendo do Loca, e a sincronização **nunca as toca**. É a regra
mais fácil de quebrar por descuido — um `upsert` com o objeto inteiro apagaria
as três — e por isso ela tem teste próprio.

## As três decisões

### 1. A chave é `people_id`, nunca CPF nem matrícula

No People, 23 pessoas não têm CPF e 5 carregam matrícula gerada por bug de
import. Chave que falta em 28 linhas não é chave.

`people_id` é `uuid` e vem do People. O índice único é **por organização**, e
não global: o Loca é multi-tenant e o dia em que uma segunda organização
integrar com outra instância do People, um único global proibiria o mesmo
`people_id` nas duas.

### 2. A obra vem por de-para explícito, numa coluna de `obra`

O People manda o **código do centro de resultado** (`"605"`, `"691"`). O Loca
tem 8 obras com código próprio. Os identificadores não coincidem, e os códigos
já divergiram historicamente entre sistemas da casa.

Coluna `codigo_people` em `public.obra`, preenchida por quem conhece as obras.
São 8 linhas.

**Sem correspondência, `obra_id` fica nulo.** Chutar por semelhança de nome
colocaria equipamento na obra errada, e o erro só apareceria numa cobrança.

Descartadas: pedir ao People um identificador do Loca (faria a fonte da verdade
conhecer um consumidor dela, e cobra caro no terceiro consumidor) e uma tabela
de-para separada (8 linhas não sustentam uma tabela, e na tela da obra o campo
fica onde quem sabe a resposta o encontra).

### 3. Diária por cron, mais um botão de sincronizar agora

O delta por `?desde=` é barato: depois da primeira carga, quase toda rodada
volta vazia. Diária basta para cadastro.

O botão existe porque **contratar de manhã e entregar o notebook à tarde é caso
real**, e esperar até as 8h do dia seguinte por causa disso seria limitação
nossa, não do contrato.

## Onde mora a configuração

Mesmo desenho dos quatro crons que já existem: **tabela de configuração por
organização, segredo no ambiente.**

- `PEOPLE_API_URL` e `PEOPLE_API_TOKEN` no ambiente. Token é segredo e não vai
  para o banco.
- `people_sync` guarda `org_id`, o `atualizado_em` mais alto já recebido (o
  cursor do delta) e o resultado da última rodada.

**Sem linha em `people_sync`, não há sincronização.** Fail-closed: uma
organização só passa a receber pessoas quando alguém declarar que ela deve.

Uma segunda organização precisaria de um segundo token, e o ambiente só carrega
um. Está fora do escopo de hoje, e é a limitação a lembrar quando aparecer.

## O mapeamento

| Payload | `funcionario` | Regra |
|---|---|---|
| `id` | `people_id` | chave |
| `nome` | `nome` | passa a vir completo |
| `cpf`, `cargo`, `matricula`, `telefone` | idem | podem ser nulos |
| `email` | `email` + `email_confirmado = true` | ver abaixo |
| `situacao` | `situacao_people` (cru) **e** `ativo` | ver abaixo |
| `centro_custo.codigo` | `obra_id` | via `obra.codigo_people`; nulo se não casar |
| `atualizado_em` | — | vira o `?desde=` da próxima rodada |
| — | `cnh`, `cnh_categoria`, `cnh_validade` | **nunca escritas** |

### A situação vai crua *e* mapeada

`ativo` e `afastado` viram `ativo = true`; `desligado` vira `false`. Mas os três
ficam também em `situacao_people`.

Colapsar afastado e desligado em `false` perderia a única distinção que importa
para quem está com equipamento: **de quem se cobra a devolução hoje.**

### O e-mail do People manda, inclusive quando é nulo

Só 194 das 483 têm e-mail corporativo — 60% vêm nulos. O Loca hoje tem 97
endereços **deduzidos** de `nome.sobrenome@sistenge.com`, todos com
`email_confirmado = false`, nenhum conferido por ninguém.

Palpite não confirmado perde para o silêncio de quem é fonte da verdade. A
sincronização sobrescreve, inclusive com nulo, e os 97 palpites morrem — o que
também aposenta a tela "Conferir e-mails".

Isso **não bloqueia termo nenhum**: a assinatura na tela sempre foi o caminho
padrão do wizard e não depende de e-mail. O e-mail é o atalho para quem está
longe.

## Idempotência

Uma pessoa atualizada no meio de uma varredura pode chegar duas vezes — o
People falha deliberadamente para o lado de repetir, nunca de perder. Toda
escrita é `upsert` em `(org_id, people_id)`. Nunca `insert` cego.

O People não apaga colaborador: muda a situação. Ninguém "some". Uma pessoa que
deixa de aparecer saiu da janela do recorte, e o vínculo dela com equipamento
não é apagado por isso.

## As três fases

1. **O consumidor** — colunas, cliente HTTP, delta, upsert, de-para, cron e
   botão. Verificável contra fixtures do contrato, sem endpoint no ar.
2. **Conciliar as 118** — o cruzamento por nome casa 75 linhas de forma
   inequívoca; **43 (36%) precisam de decisão humana**, entre elas 6 ambíguas e
   36 sem nenhum candidato. Tela de conferência com os candidatos ao lado.
3. **A limpeza** — aposentar "Conferir e-mails", descartar os 97 palpites,
   resolver as linhas que não são pessoa e os pares duplicados.

A Fase 2 não é automatizável e não deve fingir que é: os nomes do Loca estão
abreviados contra o nome completo do People, e a heurística quebra no nome do
meio.
