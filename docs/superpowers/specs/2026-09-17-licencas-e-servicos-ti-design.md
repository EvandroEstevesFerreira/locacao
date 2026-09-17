# Licenças e serviços recorrentes de TI

**Data:** 2026-09-17
**Estado:** desenho fechado — pronto para plano de implementação
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

## As três decisões que dão a forma

Confirmadas com o Evandro em 17/09/2026.

### 1. Tabela própria: `contrato_servico`

Não é discriminador em `contrato_locacao`, e o motivo é uma coluna: lá
`obra_id` é **NOT NULL**, porque todo contrato de locação pertence a uma obra
só. Uma licença não pertence a um centro de custo — ela é **rateada entre
vários**. Afrouxar `obra_id` para caber a licença enfraqueceria a garantia de
que todo contrato de equipamento tem dono, e essa garantia sustenta o escopo
por obra de toda a tela de contratos.

É a decisão oposta à dos centros de custo, e de propósito: lá a tabela separada
teria duplicado a regra de escopo em toda policy; aqui a tabela separada é o
que **preserva** a regra que já existe. O critério é o mesmo nos dois casos —
qual das formas deixa a RLS com um caminho só.

```sql
create table public.contrato_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  fornecedor_id  uuid not null references public.fornecedor (id) on delete restrict,
  nome           text not null,           -- "Microsoft 365 Business Premium"
  categoria      public.categoria_servico not null,  -- licenca | conectividade | seguranca | outro
  quantidade     integer not null check (quantidade > 0),
  valor_unitario_centavos bigint not null check (valor_unitario_centavos >= 0),
  cadencia       public.cadencia_cobranca not null,
  data_inicio    date not null,
  data_fim       date,                    -- nulo = vigência indeterminada
  renova_automaticamente boolean not null default true,
  status         public.status_contrato not null default 'ativo',
  observacoes    text,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
```

**Valor em centavos**, `bigint`, como a 0105 já fez para o valor contratado —
`numeric` em JavaScript vira `number` e um rateio de R$ 3.500 por 43 pessoas é
exatamente o tipo de divisão que perde centavo.

**Sem `obra_id`.** O centro de custo aparece pela atribuição, abaixo.

### 2. Rateio por cabeça atribuída

O custo segue quem usa. O centro de custo de cada licença é o
`funcionario.obra_id` da pessoa a quem ela está atribuída.

```sql
create table public.atribuicao_servico (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  contrato_id    uuid not null references public.contrato_servico (id) on delete cascade,
  funcionario_id uuid not null references public.funcionario (id) on delete restrict,
  atribuido_em   date not null,
  removido_em    date,
  ...
);
```

**A consequência que importa: a licença ociosa fica visível e sem dono.** Com 50
contratadas e 43 atribuídas, as 7 restantes não caem em centro de custo nenhum —
aparecem como "ociosas, R$ 490,00/mês". Um rateio percentual esconderia isso
distribuindo as 7 entre todos, e ninguém jamais cancelaria assinatura nenhuma.

**O rateio muda todo mês**, e isso é correto, não defeito: é o que faz o custo
do RH subir quando o RH contrata alguém. Por isso o rateio é **calculado**, não
gravado — uma tabela de rateio congelado divergiria da atribuição no primeiro
desligamento.

A função pura vive em `src/lib/servicos/rateio.ts` e é testável sem banco:

```ts
ratearPorCabeca(totalCentavos, quantidade, atribuicoes): {
  porCentroCusto: { centroCustoId, pessoas, centavos }[];
  ociosas: { quantidade, centavos };
}
```

**O resto da divisão vai para o maior**, e há teste cobrando que a soma das
partes seja exatamente o total. R$ 3.500 / 43 não fecha, e um centavo perdido
por licença por mês é o tipo de erro que só aparece quando alguém confere a
planilha contra o Mega.

### 3. "Em uso" é digitado, e datado

A atribuição é feita no Loca, à mão. Não há integração com o tenant do
Microsoft 365 — isso é outro projeto (app registration, permissões,
consentimento do admin) e empurraria a entrega para bem depois.

**Por isso a data de conferência é obrigatória, e não enfeite.** Um número de
licenças atribuídas *vai* divergir do tenant real em poucas semanas, e um número
errado de ociosas é pior que nenhum — alguém cancela assinatura em cima dele. A
tela mostra "conferido em 17/09/2026" ao lado da contagem, e destaca quando a
conferência passa de 90 dias.

`contrato_servico.conferido_em date` guarda isso, e ele é **do contrato**, não
da atribuição: o que se confere é a lista inteira contra o provedor, de uma vez.

## O alerta de renovação

Reaproveita `src/app/api/cron/vencimentos/route.ts`, que já escalona 30 → 15 →
3 dias e já tem `notificacao_log` para não repetir aviso. **Não nasce cron
novo:** um segundo cron de aviso é a segunda cópia que diverge, e as duas
mandariam e-mail com regras diferentes sobre a mesma data.

O que muda de forma: `contrato_servico.renova_automaticamente`. Quando é
`true`, o aviso não diz "vence em 30 dias" — diz **"renova automaticamente em
30 dias"**, porque a ação que o alerta pede é oposta. Vencimento cobra
renovação; renovação automática cobra decisão de cancelar. Trocar as duas frases
faz o aviso empurrar a pessoa para o lado errado.

Contrato de vigência indeterminada (`data_fim` nulo) **não gera alerta** — não
há data. O que ele gera é o aviso de conferência vencida, quando
`conferido_em` passa de 90 dias.

## Telas

- `/servicos` — lista de contratos de serviço, com `ListFilters` + `ListSearch`
  + `SelectFilter` por categoria e status, no padrão do resto do Loca.
- `/servicos/[id]` — a ficha: dados do contrato, a lista de atribuições, e o
  rateio calculado do mês, com a linha de ociosas em destaque.
- Bloco no centro de custo: "Serviços rateados para cá", com o valor do mês.
- Módulo novo em `src/lib/modulos.ts` e `src/lib/nav.ts`, chave `servicos`,
  grupo "Obra"? **Não — grupo próprio "TI".** A guarda `modulos.test.ts` cobra
  que toda rota de primeiro nível seja modulável; sem a chave, qualquer usuário
  autenticado entraria.

## RLS

`contrato_servico` **não tem `obra_id`**, então não há escopo por obra a
aplicar: o escopo é a organização, e a permissão é por papel — como
`fornecedor` já faz. `atribuicao_servico` segue o contrato.

Isto é uma exceção consciente ao escopo por obra, e o motivo é que um contrato
rateado entre seis centros de custo não pertence a nenhum: filtrá-lo por vínculo
mostraria a metade do contrato para metade das pessoas, e o total não fecharia
para ninguém.

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
| Licenças e serviços de TI | Escopo confirmado (3 blocos), reaproveitamento mapeado, e as 3 decisões de forma fechadas com o dono do processo: tabela própria, rateio por cabeça calculado, conferência datada. Desenho completo, com o formato das duas tabelas, a função pura de rateio, o alerta e as telas | Plano de implementação, migration, rateio, telas, testes | 20% |

**Próximo passo:** o plano de implementação, em tasks — e a primeira é a função
pura de rateio, porque é ela que tem o bug de centavo e dá para testar sem
banco.
