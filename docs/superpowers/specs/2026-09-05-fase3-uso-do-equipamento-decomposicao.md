# Fase 3 — uso do equipamento: decomposição e decisões pendentes

> Subprojeto 3 da spec de recebimento. Este documento **não é uma spec de
> implementação** — é a decomposição que a spec original previu ("o subprojeto 3
> é o maior e provavelmente se decompõe de novo") mais as perguntas que precisam
> de resposta antes de qualquer código.

## O que a fase 3 previa, e o que sobrou dela

| Item previsto | Situação |
|---|---|
| Termo do operador | **Já existia.** `termo_equipamento` (TRM), entregue na 0.49.0 |
| Apontamento de uso | **Entregue na 0.67.0** — ver abaixo |
| Alocação por frente | **Bloqueada.** Só as perguntas 4 e 5 destravam |

### O termo do operador já está pronto

`termo_equipamento` tem `funcionario_id`, `obra_id`, `contrato_id`,
`data_entrega`, `previsao_devolucao`, `encerrado_em` e `cancelado_em`, com
assinatura (`termo_assinatura`), itens (`termo_equipamento_item`) e custódia por
peça (`custodia_peca`, 0059). É exatamente o comprovante de que uma pessoa está
com um equipamento.

**Nada a construir aqui.** Registrar isto evita reconstruir por engano o que a
0.49.0 já entregou.

## 3a — entregue na 0.67.0

Construída sob **duas suposições declaradas**, porque as duas perguntas que
faltavam tinham padrão seguro:

- **Quais peças têm horímetro** → marca-se no cadastro (`tem_horimetro`),
  começando desmarcado. Funciona para cinco ou para cinquenta.
- **Quem lança** → leitura semanal, o desenho de menor atrito, que absorve o
  caso "o encarregado, de memória, uma vez por semana".

Se qualquer das duas estiver errada, o conserto é pequeno: a marca é uma caixa
de seleção, e a periodicidade não está codificada em lugar nenhum — nada impede
lançamento diário.

O que ficou: `apontamento_uso` (0071), o intervalo de revisão por tipo, a seção
de Uso na peça e o relatório "Uso do equipamento".

**Simplificação declarada que continua valendo:** `leituraUltimaRevisao` é zero,
porque a ordem de reparo ainda não registra a leitura do horímetro no momento do
serviço. O intervalo conta desde o começo da vida da máquina — o que acusa
revisão vencida cedo demais, e não tarde demais. Fechar isso é uma fatia
pequena: um campo na ordem de reparo, lido pelo cálculo.

## O que resta é um problema só

A spec original já suspeitava disso: "apontamento de horímetro e alocação por
frente são problemas diferentes com públicos diferentes". Eram mesmo — e o
primeiro está feito.

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

1. ~~Contrato por hora trabalhada ou por calendário?~~ **RESPONDIDA: por
   calendário.** Ver a seção 3a acima.
2. ~~Quais equipamentos têm horímetro?~~ **RESOLVIDA por desenho:** marca-se no
   cadastro da peça, começando desmarcado.
3. ~~Quem preencheria, e onde?~~ **RESOLVIDA por desenho:** leitura semanal, que
   absorve tanto o operador no fim do turno quanto o encarregado no escritório.

### As duas que continuam abertas — e por que não têm padrão seguro

4. **A obra da Sistenge se divide em frentes com nome estável?** Ou a divisão é
   informal e muda a cada mês?

   Sem isso, o cadastro nasce e fica vazio. Frente informal não cabe numa lista
   fechada, e lista fechada de coisa informal é preenchida errado ou não é
   preenchida.

5. **A frente já existe em algum lugar** — no orçamento, no cronograma, no
   avanço — ou seria cadastro novo?

   Esta é a que mais me impede de escolher sozinho. Criar um cadastro de frentes
   que duplica um conceito já existente noutro sistema é **exatamente** o defeito
   que esta sessão inteira combateu: as obras do fornecedor mantidas à mão ao
   lado dos contratos, o `STATUS_AVARIA` em dois arquivos, a família do
   equipamento escrita dentro da descrição. Em todos, o custo foi o mesmo — duas
   verdades que divergem.

   Se a frente vive no orçamento, o desenho certo é LER de lá, não recriar. E eu
   não sei se ela vive.

## Recomendação

**A 3a foi construída sob suposição declarada; a 3b não pode ser.**

A diferença entre as duas é onde a suposição erra. Em 3a, errar sobre "quais
peças têm horímetro" custa uma caixa de seleção — a estrutura serve de qualquer
jeito. Em 3b, errar sobre "onde a frente vive" custa um cadastro paralelo que
diverge do original, e desfazer isso depois exige migrar dado que já foi
digitado.

Enquanto as perguntas 4 e 5 não têm resposta, o `apontamento_uso.obra_id` já
guarda **onde a peça trabalhou** — um nível acima da frente. Para muita
pergunta, obra basta.

## O que a fase 2 já entregou para o ciclo de uso

Enquanto 3a e 3b esperam decisão, o ciclo físico está fechado:

```
recebimento (REC) → termo ao operador (TRM) → devolução (DEV)
                              ↓
                        avaria (AVA) → ordem de reparo (RPE)
```

E os relatórios da fase 4 já leem tudo isso: conferência pendente, equipamento
em conserto e custo de manutenção.
