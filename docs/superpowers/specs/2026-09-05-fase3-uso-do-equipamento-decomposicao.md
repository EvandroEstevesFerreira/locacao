# Fase 3 — uso do equipamento: decomposição e decisões pendentes

> Subprojeto 3 da spec de recebimento. Este documento **não é uma spec de
> implementação** — é a decomposição que a spec original previu ("o subprojeto 3
> é o maior e provavelmente se decompõe de novo") mais as perguntas que precisam
> de resposta antes de qualquer código.

## O que a fase 3 previa, e o que sobrou dela

| Item previsto | Situação |
|---|---|
| Termo do operador | **Já existe.** `termo_equipamento` (TRM), entregue na 0.49.0 |
| Apontamento de uso | Não existe. Precisa de decisão |
| Alocação por frente | Não existe. Precisa de decisão |

### O termo do operador já está pronto

`termo_equipamento` tem `funcionario_id`, `obra_id`, `contrato_id`,
`data_entrega`, `previsao_devolucao`, `encerrado_em` e `cancelado_em`, com
assinatura (`termo_assinatura`), itens (`termo_equipamento_item`) e custódia por
peça (`custodia_peca`, 0059). É exatamente o comprovante de que uma pessoa está
com um equipamento.

**Nada a construir aqui.** Registrar isto evita reconstruir por engano o que a
0.49.0 já entregou.

## O que resta são dois problemas diferentes

A spec original já suspeitava disso: "apontamento de horímetro e alocação por
frente são problemas diferentes com públicos diferentes". São mesmo — e a
diferença é quem preenche.

### 3a — Apontamento de uso

**Público:** o operador da máquina, ou o encarregado, todo dia.

**O que responde:** quanto a máquina trabalhou. É o dado que sustenta três
coisas que hoje o Loca não sabe fazer:

- **Locação por hora trabalhada**, quando o contrato é assim em vez de por
  diária. Hoje `cadencia` só conhece períodos de calendário.
- **Manutenção preventiva por uso** — troca de óleo a cada 250 h, não a cada
  três meses.
- **Ociosidade real.** O relatório de ociosidade que existe hoje mede
  equipamento parado por CALENDÁRIO (está locado e não foi devolvido). Uma
  betoneira que está na obra há 40 dias e trabalhou 6 é ociosa de um jeito que
  nenhum relatório atual enxerga.

### 3b — Alocação por frente de serviço

**Público:** o engenheiro ou o encarregado, quando a obra tem frentes.

**O que responde:** qual parte da obra consumiu o equipamento. Hoje o custo
morre na obra; com frente, ele desce ao serviço — fundação, estrutura,
acabamento.

**Depende de a obra ter frentes**, e isso não existe no Loca. `avanco` tem
etapas, mas etapa de avanço físico não é necessariamente frente de alocação de
equipamento.

## As perguntas que precisam de resposta

Nenhuma delas tem default seguro. Errar qualquer uma produz uma tela que
ninguém preenche — e tela de apontamento que ninguém preenche é pior do que não
ter, porque o relatório em cima dela mente com aparência de dado.

### Sobre o apontamento (3a)

1. **A Sistenge tem contrato de locação por hora trabalhada, ou todos são por
   período de calendário?** Se todos são por calendário, o apontamento não tem
   efeito no custo e vira só insumo de manutenção — o que muda o tamanho da
   entrega.
2. **Quais equipamentos têm horímetro?** Gerador e compressor costumam ter;
   betoneira e vibrador quase nunca. Se forem poucos, o apontamento é uma tela
   pequena para uma lista curta, não um módulo.
3. **Quem preencheria, e onde?** No celular, na obra, no fim do turno? Se a
   resposta for "o encarregado, no escritório, uma vez por semana, de memória",
   o dado nasce ruim e o desenho tem de assumir isso — lançamento por período em
   vez de por dia.

### Sobre a frente (3b)

4. **A obra da Sistenge se divide em frentes com nome estável?** Ou a divisão é
   informal e muda a cada mês?
5. **A frente já existe em algum lugar** — no orçamento, no cronograma, no
   avanço — ou seria cadastro novo? Cadastro novo que duplica um conceito que já
   vive noutro sistema é o que produz as duas listas que divergem.

## Recomendação

**Não construir nem 3a nem 3b sem as respostas.** As duas são telas de
lançamento diário: elas só valem pelo que acumulam, e uma tela de lançamento que
não encaixa na rotina de quem lança fica vazia — deixando um relatório que soma
zero e parece dizer que a máquina não trabalhou.

Se for para escolher uma, **3a antes de 3b**: o apontamento vale por si (custo e
manutenção preventiva), enquanto a alocação por frente só vale se houver frente
definida, e a definição vem de fora do Loca.

## O que a fase 2 já entregou para o ciclo de uso

Enquanto 3a e 3b esperam decisão, o ciclo físico está fechado:

```
recebimento (REC) → termo ao operador (TRM) → devolução (DEV)
                              ↓
                        avaria (AVA) → ordem de reparo (RPE)
```

E os relatórios da fase 4 já leem tudo isso: conferência pendente, equipamento
em conserto e custo de manutenção.
