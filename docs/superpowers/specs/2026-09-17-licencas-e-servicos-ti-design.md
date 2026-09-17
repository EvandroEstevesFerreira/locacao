# Licenças e serviços recorrentes de TI

**Data:** 2026-09-17
**Estado:** desenho inicial — escopo confirmado, detalhes a brainstormar
**Depende de:** [centros de custo](2026-09-17-centros-de-custo-design.md) (v0.117.0)

---

## Por que isto é uma spec separada

Esta frente saiu de dentro do trabalho de centros de custo, e sair foi a
decisão. As outras duas coisas que o Evandro pediu junto — alocar equipamento
ao departamento e emitir termo de custódia para o pessoal administrativo — não
custaram código nenhum: `equipamento_unidade.obra_id` e `funcionario.obra_id` já
existiam, e só faltava o departamento existir como linha para eles apontarem.

Licenças não são assim. Uma assinatura do Microsoft 365 não tem peça física,
não tem número de série, não é entregue em obra, não volta avariada e não
recebe termo de responsabilidade assinado. Enfiá-la em `equipamento_unidade`
faria toda tela de frota passar a ter um caso especial invisível — e o
inventário de TI deixaria de responder "quantos notebooks eu tenho".

Por isso é subsistema novo, com spec própria. E fica **muito** mais simples de
escrever agora que "centro de custo" existe: o rateio tem para onde apontar.

## Escopo, confirmado com o Evandro em 17/09/2026

Três blocos, os três dentro:

1. **Contrato recorrente com rateio por centro de custo** — o núcleo.
2. **Alerta de renovação / vencimento** — aproveitando o cron que já existe.
3. **Contratadas x em uso** — 50 assinaturas M365, 43 atribuídas.

---

## O que já existe e deve ser reaproveitado

| Peça | Onde | O que serve |
| --- | --- | --- |
| Contrato com cadência e vigência | `contrato_locacao` (migration 0006) | o formato `obra_id + fornecedor_id + cadencia + data_inicio + data_fim_prevista + status` é quase o que uma licença precisa |
| Escalonamento de aviso 30 → 15 → 3 dias | `src/app/api/cron/vencimentos/route.ts` | o bloco 2 inteiro, sem escrever cron novo |
| Centro de custo | `obra.tipo` (migration 0114) | o destino do rateio |
| Fornecedor com código Mega | `fornecedor.codigo_mega` | a conciliação de pagamento já sabe ler |

## As três perguntas que decidem a forma, e ainda não foram feitas

Estas ficam explícitas em vez de resolvidas, porque errá-las custa mais que
adiá-las:

### 1. Licença é um contrato novo ou um `tipo` em `contrato_locacao`?

É a mesma escolha que centros de custo já enfrentou: discriminador na tabela
existente (abordagem A) ou tabela separada (abordagem C). A diferença é que
`contrato_locacao` tem **itens locados com quantidade e valor unitário**, e uma
assinatura de M365 é exatamente isso — 50 unidades a um preço cada.

Inclinação inicial, a confirmar: **discriminador**, pelo mesmo motivo de lá —
uma tabela separada duplicaria a regra de escopo em toda policy. Mas aqui o
argumento é mais fraco, porque licença não tem `obra_id` único: ela é rateada
entre vários. Isso pode ser o que empurra para tabela própria.

### 2. O rateio é percentual fixo ou por cabeça atribuída?

Duas formas, e elas divergem no primeiro mês:

- **Percentual fixo** (RH 20%, Engenharia 50%…): simples, estável, e mente
  quando alguém entra ou sai.
- **Por cabeça atribuída**: o custo segue quem realmente usa. Exige que o bloco
  3 exista primeiro, e faz o rateio mudar todo mês — o que é correto e chato.

Sem decidir isto, o bloco 1 não tem forma.

### 3. "Em uso" é contado a partir de quê?

Se a atribuição de licença a pessoa for digitada à mão, ela **vai** divergir do
tenant do M365 em poucas semanas — e um número de licenças ociosas que está
errado é pior que nenhum número, porque alguém cancela assinatura em cima dele.

As opções são: aceitar a digitação e datá-la ("conferido em"), ou integrar com
o tenant. A segunda é outro projeto.

---

## O que já está decidido

- **Nada disso recebe termo de custódia.** Termo é para bem físico que alguém
  leva e devolve.
- **Nada disso entra em `equipamento_unidade`.** Ver a abertura.
- **O rateio não escreve no Mega.** Pelo mesmo motivo que a conciliação não
  escreve: o Loca sabe o que foi contratado; quem sabe o que saiu do caixa é o
  ERP.
- **O alerta usa o cron de vencimentos existente**, não um cron novo. Um
  segundo cron de aviso é a segunda cópia que diverge.

## Fora de escopo

- Integração com o tenant do Microsoft 365 (ou qualquer provedor).
- Gestão de chaves e senhas de licença — isso é cofre, não inventário.
- Compra e aprovação de licença nova.

---

## Estado da implementação

| Frente | O que foi feito | Falta | % concluído |
| --- | --- | --- | --- |
| Licenças e serviços de TI | Escopo confirmado (3 blocos), reaproveitamento mapeado, 4 decisões travadas, 3 perguntas abertas nomeadas | Responder as 3 perguntas, fechar o desenho, plano, migration, telas, testes | 8% |

**Próximo passo:** brainstormar as três perguntas abertas — começando pela 2
(percentual fixo x por cabeça), porque ela decide se o bloco 3 é pré-requisito
do bloco 1 ou independente dele.
