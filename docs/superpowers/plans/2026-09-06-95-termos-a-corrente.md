# Os 95 termos — a corrente inteira, medida

> **Não é um plano de implementação, é o mapa de por que não existe atalho.**
> Escrito depois de tentar o atalho e bater na trava — que estava certa.

**Goal:** que as 95 máquinas de TI em uso tenham um responsável registrado.

**Estado hoje:** 95 peças constam *em uso*; **0 custódias abertas**; **0 termos
emitidos**.

## O que eu tentei, e por que não funciona

O importador gravou a pessoa em `equipamento_unidade.observacoes`, como texto:
`Com: <nome> (conforme planilha)`. Medido na produção, o dado está completo:

| | |
|---|---|
| Peças ativas | 128 |
| Com pessoa no texto | **101** |
| Em uso **sem** pessoa no texto | **0** |
| Nomes que casam com um `funcionario` | **101 de 101** |

Ou seja: dá para reconstruir quem está com o quê, sem ambiguidade. A tentação é
gerar as 95 custódias por SQL e encerrar o assunto.

**O banco recusa, e a recusa é o desenho:**

```sql
custodia_funcionario_exige_termo:
  CHECK (tipo <> 'funcionario' OR (origem = 'termo' AND termo_id IS NOT NULL))
```

Custódia de pessoa **exige um termo**. O sistema se recusa a afirmar “esta
máquina está com o Fulano” sem o documento que o Fulano assinou — porque é
exatamente isso que um livro de custódia serve para provar. Um vínculo criado a
partir de uma planilha teria a aparência de prova sem ser prova.

**A trava está certa. O atalho é que estava errado.**

## A corrente

```
95 peças em uso sem responsável
  └─ exige custódia de funcionário
       └─ exige TERMO com termo_id          ← custodia_funcionario_exige_termo
            └─ exige ASSINATURA              ← emitirTermo recusa sem ela
                 └─ presencial, ou convite por link (0.72.0)
                      └─ exige E-MAIL CONFIRMADO
                           └─ 0 de 97 confirmados   ← O ELO QUE FALTA
```

O último elo é a regra da 0.69.0: endereço **deduzido** do nome
(`nome.sobrenome@sistenge.com`) não recebe termo enquanto ninguém conferir. Ela
existe porque mandar um documento assinável para um endereço adivinhado é pior
que não mandar.

## Os números que decidem o formato

| | |
|---|---|
| Peças em uso | 95 |
| **Pessoas distintas** | **94** |
| Maior lote por pessoa | **1** |
| Com e-mail cadastrado | 93 |
| **Com e-mail confirmado** | **0** |

**Agrupar por pessoa não economiza nada** — é quase exatamente uma máquina por
pessoa. Então “lote” e “um a um” diferem no esforço de quem opera, não no
número de e-mails: 94 convites de qualquer maneira.

## O próximo passo real

Não é emitir termos. É **conferir os 97 endereços deduzidos** — e isso não manda
e-mail nenhum, não cria custódia nenhuma, não é irreversível.

Hoje a confirmação existe só no formulário de um funcionário por vez
(`FuncionarioForm`, caixa “confirmar e-mail”). Para 97 pessoas isso é 97
navegações.

**Uma tela de conferência em lote** — lista de nome, cargo, endereço deduzido, e
uma caixa por linha — resolve em uma sessão. Quem confere é quem conhece as
pessoas, e no caso é o próprio Evandro, que supervisiona o RH.

Ela é **bounded**: um `page.tsx`, um form cliente, uma action que atualiza
`email_confirmado` em lote. Nenhuma migration. Nenhum envio.

## Depois disso, as duas opções que o Evandro precisa escolher

| | Como é | Custa |
|---|---|---|
| **Lote** | Uma ação gera os 94 termos em rascunho, 94 links e dispara 94 convites | 94 e-mails de uma vez; quem não assinar vira cobrança manual |
| **Um a um** | O fluxo que já existe: novo termo → link → convite | 94 vezes o mesmo caminho, mas cada envio é uma decisão |

**Nenhuma das duas foi construída em lote.** O caminho um-a-um funciona hoje,
ponta a ponta, desde a 0.72.0.

## O que NÃO fazer

- **Não gerar as custódias por SQL.** A trava existe por um motivo, e contorná-la
  por `origem = 'manual'` com `tipo = 'obra'` produziria um livro de custódia que
  diz “está na obra 800” quando a verdade é “está com a Elaine” — pior que o
  silêncio de hoje, porque parece resposta.
- **Não confirmar os 97 e-mails por SQL.** Confirmar é afirmar que alguém
  conferiu. Um `update` em massa transformaria a regra numa formalidade e o
  primeiro endereço errado mandaria um termo assinável para fora.
- **Não deduzir endereço para quem não tem.** São 4 pessoas sem e-mail entre as
  97; o importador já se recusou a adivinhar quando dois nomes colidiam.
