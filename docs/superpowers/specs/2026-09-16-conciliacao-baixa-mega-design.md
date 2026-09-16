# Conciliação da baixa com o Mega — desenho

> Data: 16/09/2026 · Status: aprovado, não implementado

## O problema

O Loca sabe o que foi **contratado** e o que **corre**. Quem sabe o que saiu do
caixa é o Mega. Desde a 0.106.0 o espelho `mega_titulo` traz o contas a pagar
do ERP para dentro do Loca, mas ele **só lê**: `lancamento_financeiro` continua
sendo baixado à mão, lançamento por lançamento, conferindo contra a tela do
Mega. É trabalho manual repetido todo mês sobre um dado que já está no banco.

O bloqueio antigo era a falta da data de pagamento. Ele **caiu** na 0.112.0:
`DataProrrogado` é a data de pagamento, confirmado com o dono do processo em
11/09/2026.

## A decisão que estrutura tudo: isto não é baixa automática

**O sistema propõe; o humano confirma.** Nada escreve em
`lancamento_financeiro` sem um clique de alguém do financeiro.

O motivo não é timidez. É assimetria de consequência, e o teste
`espelho-nao-da-baixa.test.ts` já a escrevia: *"dar baixa com casamento errado
marca como paga uma conta que ninguém pagou — e isso ninguém percebe olhando a
tela."* Uma sugestão errada aparece na fila e é recusada em dois segundos. Uma
baixa errada vira um contrato quitado que ninguém cobra, e só aparece quando o
fornecedor liga.

Isto também é coerente com a regra que o AGENTS.md já aplica ao número do
documento: **divergência é fila de revisão humana, não correção automática.**

## O casamento é PARCELA ↔ LANÇAMENTO, não documento ↔ lançamento

Esta é a virada do desenho, e ela dissolve o problema que parecia central.

O AGENTS.md mediu que um documento pode cobrir várias parcelas — em imóvel,
sempre (7 de 7); o código 3234 tem 18 parcelas sob o mesmo recibo. Daí vinha a
conclusão de que a baixa teria de "casar pelo documento e distribuir o valor
entre as parcelas".

**Só que o documento nunca precisou ser a chave.** Cada parcela do Mega tem
vencimento e valor próprios. E o Loca gera um lançamento recorrente por
competência (índices `uq_lancamento_recorrente_contrato` e
`uq_lancamento_recorrente_imovel`, da 0.10.0). Parcela e lançamento são ambos
mensais: a correspondência é **1↔1 por mês**.

Com isso não há valor a distribuir, não há rateio, e o bloco deixa de ser um
caso especial. O documento vira **evidência de reforço**, não chave.

## A chave, e por que ela não repete o erro de 10/09

```
(agente já vinculado) + (competência do vencimento efetivo) + (valor)
```

- **Agente já vinculado** é `mega_titulo.fornecedor_id` ou `imovel_id` — um
  vínculo que o Loca **já confirmou**, por `codigo_mega` ou por documento com
  dígito verificador conferido. O conciliador nunca resolve agente por conta
  própria.
- **Competência** sai de `vencimentoEfetivo()` — a prorrogada, nunca a
  original.
- **Valor** entra como sinal, não como exigência (ver divergência, abaixo).

**O que este desenho explicitamente NÃO faz:** casar locador por nome ou por
valor. Foi medido em 10/09/2026 — dos 8 candidatos por valor+dia, **3 eram
falsos**. PONTOMAIS, PREVENT SENIOR e BULLLA casaram com aluguel por
coincidência. O valor aqui só desempata dentro de um agente que já tem vínculo
confirmado; ele nunca estabelece o vínculo.

### O documento como reforço

Quando `tipo_documento` é fiscal (`NF`), `numero_documento` é confiável (9
genéricos em 183) e bater com `lancamento_financeiro.nf_numero` **eleva a
confiança** da proposta. Quando o tipo não é fiscal, ou quando o valor tem 1 a
3 dígitos (`"1"`, `"2"`, `"3"` — o lançador numerando à mão), o campo é
ignorado por completo.

**O conciliador nunca corrige `nf_numero` do Loca a partir do Mega.**
Divergência é informação para o humano, não correção. Corrigir destrói o dado
bom.

## Só título quitado entra na fila

`saldo_atual = 0`. Título em aberto não tem baixa a propor: a prorrogada dele é
previsão, e `dataDePagamento()` já devolve `null` por isso.

A data gravada em `lancamento_financeiro.data_pagamento` é o retorno de
`dataDePagamento()` — a prorrogada. **Nunca `quitacao_vista_em`**, que é o dia
em que o cron viu o saldo zerar: auditoria da sincronização, não fato do ERP.

## Divergência de valor: propor mesmo assim, mostrando a diferença

O Loca esperava R$ 2.000,00, o Mega pagou R$ 2.038,53. A proposta aparece com a
diferença em destaque.

Esconder a divergência esconde justamente a multa — e o Loca já tem colunas
para ela. Ao confirmar, a action grava `valor_pago` com o valor do Mega e deixa
`multa` e `juros` para quem confirma atribuir; a soma dos dois não é cobrada
contra a diferença, pela mesma razão que `lancamento_item` não cobra fechamento
na vírgula (migration 0052): forçar o detalhamento total produz não detalhar.

Não há faixa de tolerância que descarte proposta. O caso caro — a multa grande
— é exatamente o que uma tolerância tiraria da tela.

## Onde a fila vive: tabela `mega_conciliacao`

Uma tabela nova, e **o motivo decisivo é a recusa**.

Fila só funciona se esvaziar. Calcular o casamento na hora (sem persistir) ou
guardar só o vínculo no lançamento confirmado deixam o "não" sem onde morar: o
título que o financeiro examinou e descartou reaparece amanhã, e depois de
amanhã, para sempre. Em três meses ninguém abre mais a tela — a conciliação
morre por ruído, não por bug. A tabela intermediária existe para guardar o
"não"; o resto é consequência.

Forma:

```
mega_conciliacao (
  id, org_id,
  mega_titulo_id   -> mega_titulo (on delete cascade),
  lancamento_id    -> lancamento_financeiro (on delete cascade),  -- nulo em "sem casamento"
  confianca        -- alta | media | baixa
  motivo           -- texto legível: por que o sistema propôs isto
  status           -- sugerida | confirmada | recusada
  decidido_por, decidido_em
)
```

- Índice único por `(org_id, mega_titulo_id)`: um título tem no máximo uma
  decisão viva.
- `motivo` é texto para humano ("documento 42824001 bate com a NF do
  lançamento; valor idêntico"), não código. Quem confirma precisa saber o que
  está confirmando.
- A view de leitura nasce com `security_invoker = on`, sem exceção — foi o
  incidente da 0.49.1, e `src/lib/migrations-seguranca.test.ts` já varre isso.

## Quem escreve o quê — e por que isto não é o furo do `createAdminClient()`

| Quem | O quê | Com que client |
| --- | --- | --- |
| cron `/api/cron/mega` | upsert em `mega_conciliacao` | `createAdminClient()` — sem sessão, não há RLS a respeitar |
| tela de conciliação | leitura | `createClient()`, sob RLS |
| server action de confirmar | `lancamento_financeiro` + status da sugestão | `createClient()`, com sessão |

A escrita no livro financeiro acontece **só** na server action, com sessão de
usuário, passando pelas policies que a 0008 já exige (`admin` ou `financeiro`,
ou membro da obra). O cron nunca toca `lancamento_financeiro`.

`mega_conciliacao` é escrita pelo cron e pelo usuário — ao contrário de
`mega_titulo`, que só tem policy de SELECT. A diferença é proposital:
`mega_titulo` é espelho de um fato do ERP e editá-lo faria o Loca mentir;
`mega_conciliacao` guarda uma **decisão nossa**, que é nossa para tomar.

## O teste da varredura muda de forma, não some

`src/lib/mega/espelho-nao-da-baixa.test.ts` hoje proíbe **qualquer** arquivo de
`src/lib/mega/` de mencionar `lancamento_financeiro`. A promessa que continua
valendo depois desta onda é mais estreita, e continua sendo a que importa:

> **o cron não escreve em `lancamento_financeiro`.**

A varredura passa a cobrar isso — a rota de cron e os módulos que ela chama —
em vez de proibir a menção em todo o diretório. Ela **não** pode ser apagada: é
ela que impede alguém, daqui a seis meses, de "otimizar" a confirmação movendo
a escrita para dentro do cron e transformando a fila humana em baixa automática
sem ninguém decidir isso.

Mantém-se também a asserção de vacuidade (a varredura confere que achou os
arquivos antes de afirmar qualquer coisa sobre o conteúdo) — já passou duas
vezes por vacuidade neste repositório.

## Fora de escopo, de propósito

- **Baixa parcial.** Saldo zerado é tudo ou nada nesta onda.
- **Escrever de volta no Mega.** O ERP é fonte da verdade; o Loca não o edita.
- **Adivinhar agente.** Título de agente sem vínculo no Loca não gera proposta
  — aparece como "sem casamento" e alguém vincula o `codigo_mega`.
- **Corrigir `nf_numero`** a partir do espelho.

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Conciliação da baixa | Desenho aprovado e escrito | Plano, migration, cálculo do casamento, cron, tela, action, testes | 10% |

Próximo passo único: escrever o plano de implementação.
