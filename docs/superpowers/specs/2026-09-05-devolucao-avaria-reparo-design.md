# Devolução, laudo de avaria e ordem de reparo

> Subprojeto 2 da spec de recebimento
> (`2026-08-23-recebimento-equipamento-design.md`, seção "O que fica para os
> próximos subprojetos").

## Objetivo

Fechar o ciclo físico do equipamento locado. O recebimento já é documento: tem
número, romaneio em PDF e aviso ao fornecedor. A ponta oposta — a devolução — é
um lançamento de estoque sem documento nenhum. Quem entrega o equipamento de
volta ao fornecedor não tem o que assinar, e a empresa não tem o que apresentar
quando o fornecedor cobra por um item que já voltou.

## Estado atual

### O que já existe e será usado

- **`movimentacao`** (migration 0006) — o razão de saldo. Uma linha por item
  devolvido, com quantidade e data. Alimenta o saldo em aberto, o custo estimado
  e o fluxo de caixa (`src/lib/estoque.ts`, `src/lib/fluxo.ts`). **Continua
  sendo a verdade sobre saldo.**
- **`vistoria`** (0007) — relatório fotográfico, já criado a cada devolução e já
  numerado como VIS.
- **`avaria`** (0007, 0040) — descrição, custo estimado, status
  `aberta`/`cobrada`/`resolvida` e vínculo 1:1 com lançamento financeiro.
  Pendura em `vistoria`.
- **Numeração** (0048) — contador gapless por `(org, tipo, ano)`.
- **`equipamento_unidade`** + `item_locado.unidade_id` (0049) — a peça.
- **Recebimento** (0049, 0052) — o modelo a espelhar: cabeçalho, itens,
  rascunho → fechado, PDF, e-mail.

### As três lacunas

1. **A devolução não é documento.** Ela é criada item a item, e cada item vira
   uma `movimentacao` própria. Devolver cinco andaimes no mesmo caminhão produz
   cinco registros e nenhum comprovante. O fornecedor recebe o caminhão e não
   recebe papel.
2. **A avaria não sabe de peça nem de responsável.** `avaria` tem descrição e
   custo, mas não diz QUAL peça foi avariada nem QUEM responde. Sem isso, um
   laudo não pode ser emitido — laudo sem responsável é reclamação.
3. **Reparo de equipamento não existe.** Só `reparo_imovel`. Equipamento que sai
   para conserto some do sistema: não está na obra, não voltou ao fornecedor, e
   ninguém sabe quando volta.

## Decisões

### A devolução ganha cabeçalho; `movimentacao` continua sendo o razão

`devolucao` é o documento; `movimentacao` são suas linhas. Uma coluna
`movimentacao.devolucao_id` nulável faz o vínculo.

**Nulável de propósito, e permanentemente.** Toda `movimentacao` que existe hoje
tem `devolucao_id` nulo, e continua válida: ela é o histórico real de saldo, e
reescrevê-la para inventar documentos que nunca existiram seria fabricar
registro. Nulo lê-se "devolução anterior ao documento", não "dado faltando".

A alteração em `movimentacao` é **só uma coluna nova nulável**. Nenhuma leitura
de saldo, custo ou fluxo de caixa muda — e são elas que sustentam o financeiro.

### O número DEV passa a ser do cabeçalho

`movimentacao.numero_registro` existe desde a 0048 e **não é exibido em tela
nenhuma** — os números que aparecem nas listagens de contrato são do contrato.
Isso deixa o prefixo DEV livre para o documento, que é quem realmente precisa
dele.

`movimentacao` perde o gatilho de numeração. Os números já emitidos **ficam**:
apagá-los não beneficiaria ninguém e destruiria a única prova de que aquela
numeração existiu.

Como os dois contadores são chaveados por `tipo`, o contador novo de
`'devolucao'` começaria em 1 e **reemitiria números já usados**. Por isso a
migration o semeia com o maior sequencial DEV já emitido, por organização e por
ano. Sem essa semeadura, o primeiro termo de devolução de cada obra sairia com
um número que já está em outro registro.

### Rascunho → fechado, e o saldo só se move no fechamento

Mesma máquina do recebimento, pela mesma razão: o documento vai para fora da
empresa e precisa de uma janela de correção antes disso.

**As `movimentacao` só nascem no fechamento.** Um rascunho não mexe no saldo. Se
elas nascessem junto com o rascunho, um rascunho abandonado baixaria estoque que
nunca voltou ao fornecedor — e o custo de locação pararia de correr sobre
equipamento que ainda está na obra.

O fechamento, em ordem: valida → numera → grava as movimentações → atualiza o
status dos itens → fecha → avisa. O aviso é o último porque é o único passo que
sai da empresa.

### A conferência de saldo é do fechamento, não do rascunho

Entre montar o rascunho e fechá-lo, outra pessoa pode ter devolvido o mesmo
item. Validar saldo só na inclusão do item deixaria o fechamento estourar o
saldo em silêncio. O fechamento revalida **todos** os itens contra o saldo do
momento, e recusa inteiro se algum não couber — devolução parcial gravada pela
metade é pior do que devolução recusada.

### Avaria: quatro colunas e um laudo

`avaria` ganha:

| Coluna | Por quê |
|---|---|
| `unidade_id` | Qual peça. Nulo quando o item é controlado por quantidade. |
| `devolucao_id` | A avaria constatada na devolução. Nulo quando constatada em uso. |
| `responsabilidade` | `fornecedor`, `obra`, `funcionario` ou `indefinida`. |
| `data` | Quando foi constatada. Hoje só existe o `created_at` da linha. |

`responsabilidade` nasce **`indefinida`**, e é esse o ponto: o laudo é emitido
para APURAR, não depois de apurado. Um enum sem "indefinida" forçaria quem
preenche a apontar um culpado no momento da constatação, que é exatamente
quando ainda não se sabe.

`status` continua `aberta`/`cobrada`/`resolvida` e continua ligado ao lançamento
financeiro pela 0040. Nada disso muda.

### Reparo é tabela nova, com prefixo novo

`reparo_imovel` é do imóvel e já ocupa REP. `reparo_equipamento` recebe **RPE**.

O que ele responde: onde está a peça, desde quando, quanto vai custar, quem
paga, e quando volta. Estados: `aberto` → `em_execucao` → `concluido`, mais
`cancelado`.

**Um reparo não fecha sozinho o ciclo financeiro.** Ele registra o custo; a
cobrança continua sendo do lançamento financeiro da avaria, quando houver. Um
reparo pode existir sem avaria (manutenção preventiva) e uma avaria pode existir
sem reparo (item baixado).

## Modelo

```
contrato_locacao
  └── devolucao (DEV)  ── fornecedor
        ├── devolucao_item
        ├── movimentacao (razão de saldo)  ← criadas no fechamento
        └── vistoria (VIS, fotos)
              └── avaria (AVA)  ── unidade_id, responsabilidade
                    └── reparo_equipamento (RPE)
```

## Faseamento

| Fase | Entrega | Migrations |
|---|---|---|
| 2a | `devolucao` + `devolucao_item`, vínculo e semeadura do contador, CRUD do rascunho, fechamento, termo em PDF, e-mail ao fornecedor | 1 |
| 2b | Colunas novas de `avaria`, tela de laudo, laudo em PDF | 1 |
| 2c | `reparo_equipamento`, CRUD, ordem de reparo em PDF | 1 |

Cada fase vai a produção por si.

## Riscos assumidos

- **A semeadura do contador é migration de dados.** Erra-se uma vez e o
  resultado é número duplicado em documento que já saiu. É verificada contra o
  banco de produção antes e depois.
- **`movimentacao` alimenta o financeiro.** A coluna nova é aditiva e nulável,
  mas qualquer leitura que passe a filtrar por `devolucao_id` mudaria saldo em
  silêncio. Nenhuma leitura existente é tocada nesta fase.
- **O e-mail de devolução é a segunda comunicação do Loca com terceiro.** Mesma
  proteção do recebimento: só no fechamento, e a falha de envio não derruba o
  registro.

## Testes

- Idempotência dos schemas novos, pela varredura que já existe.
- Fechamento que estoura saldo é recusado **inteiro** — nenhuma `movimentacao`
  gravada.
- Fechar duas vezes em corrida numera uma vez só.
- A semeadura do contador: dado um DEV-2026-0007 em `movimentacao`, o primeiro
  documento sai DEV-2026-0008.
- O termo em PDF é **renderizado e lido**, não contado. Lição da 0.58.1.
