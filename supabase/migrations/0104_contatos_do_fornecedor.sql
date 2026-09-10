-- ============================================================================
-- Contatos do fornecedor: vários, com cargo, e um principal
-- ============================================================================
--
-- O cadastro tinha UM contato, em três colunas planas de `fornecedor`:
-- `contato_nome`, `contato_telefone` e `contato_email`. Fornecedor de verdade
-- tem o comercial, o do faturamento e o do galpão — e quem liga precisa saber
-- para qual dos três.
--
-- O QUE **NÃO** MUDA, e é a decisão mais importante desta migration:
-- `fornecedor.contato_email` FICA onde está. Ele é a caixa da EMPRESA (no
-- exemplo real, contato@nautika.com.br) e é o destinatário do romaneio de
-- recebimento e do termo de devolução — seis pontos do código dependem dele.
-- Amarrar o documento ao e-mail de uma PESSOA faria o romaneio parar de chegar
-- no dia em que ela saísse da empresa.
--
-- O nome daquela coluna passa a mentir um pouco: `contato_email` não é o e-mail
-- do contato, é o da empresa. Renomear custaria seis call sites sem ganho
-- nenhum, então fica o comentário abaixo em vez do rename.
-- ============================================================================

create table if not exists public.fornecedor_contato (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  fornecedor_id uuid not null references public.fornecedor (id) on delete cascade,
  nome          text not null,
  cargo         text,
  -- Só dígitos, com DDI: "5511947071104". A formatação para
  -- "+55 (11) 94707-1104" é da exibição (`src/lib/telefone.ts`). Guardar as duas
  -- formas no mesmo campo foi o que deixou "11 95914-0002" ao lado de
  -- "5511980765016" no cadastro antigo, sem nenhuma busca casar os dois.
  telefone      text,
  principal     boolean not null default false,
  created_at    timestamptz not null default now()
);

comment on column public.fornecedor.contato_email is
  'Caixa da EMPRESA: destinatario do romaneio e do termo de devolucao. NAO e o e-mail de um contato -- contato vive em fornecedor_contato. O nome da coluna e historico.';

comment on column public.fornecedor_contato.telefone is
  'Digitos com DDI (5511947071104). Formatar com formatarTelefone() de src/lib/telefone.ts.';

create index if not exists idx_fornecedor_contato_fornecedor
  on public.fornecedor_contato (fornecedor_id);

-- UM PRINCIPAL POR FORNECEDOR, no banco e não só na tela.
--
-- Índice PARCIAL, e não constraint: é o que permite N contatos comuns
-- convivendo com um principal. Mesmo recurso do `idx_custodia_aberta` (0059) e
-- do "um orçamento vigente por obra" (0051).
--
-- Zero principal é estado LEGÍTIMO — fornecedor com três contatos e nenhum
-- eleito ainda. E é o que permite a escrita sem transação: a aplicação limpa o
-- principal de todos e só então marca o escolhido. O índice proíbe dois e
-- aceita zero, então a janela intermediária é válida. Marcar antes de limpar
-- reprovaria no meio.
create unique index if not exists idx_fornecedor_contato_principal
  on public.fornecedor_contato (fornecedor_id) where principal;

-- ---------------------------------------------------------------------------
-- RLS: espelha o irmão `fornecedor_obra` (migration 0027)
-- ---------------------------------------------------------------------------
-- E não a 0002, que é a primeira do fornecedor: naquela época os papéis tinham
-- outros nomes, trocados pela 0011 por `pode_gerir_cadastros()`. Copiar a mais
-- antiga daria policy referenciando valor de enum extinto -- foi o que quase
-- aconteceu na 0098.
alter table public.fornecedor_contato enable row level security;

drop policy if exists "fornecedor_contato_select" on public.fornecedor_contato;
create policy "fornecedor_contato_select" on public.fornecedor_contato
  for select to authenticated using (org_id = public.current_org_id());

drop policy if exists "fornecedor_contato_write" on public.fornecedor_contato;
create policy "fornecedor_contato_write" on public.fornecedor_contato
  for all to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros())
  with check (org_id = public.current_org_id() and public.pode_gerir_cadastros());

-- ---------------------------------------------------------------------------
-- O contato que já existe vira o primeiro da lista, marcado principal
-- ---------------------------------------------------------------------------
-- Normaliza o telefone na mesma passada, replicando `normalizarTelefone`:
-- 10 ou 11 dígitos ganham o DDI 55; 12 e 13 que já começam com 55 ficam; o que
-- não encaixa PRESERVA o texto original, porque perder o que a pessoa digitou é
-- pior que guardar sem formato.
insert into public.fornecedor_contato (org_id, fornecedor_id, nome, telefone, principal)
select
  f.org_id,
  f.id,
  f.contato_nome,
  case
    when f.contato_telefone is null or btrim(f.contato_telefone) = '' then null
    when length(regexp_replace(f.contato_telefone, '\D', '', 'g')) in (10, 11)
      then '55' || regexp_replace(f.contato_telefone, '\D', '', 'g')
    when length(regexp_replace(f.contato_telefone, '\D', '', 'g')) in (12, 13)
      and regexp_replace(f.contato_telefone, '\D', '', 'g') like '55%'
      then regexp_replace(f.contato_telefone, '\D', '', 'g')
    else f.contato_telefone
  end,
  true
from public.fornecedor f
where coalesce(btrim(f.contato_nome), '') <> ''
  and not exists (
    select 1 from public.fornecedor_contato c where c.fornecedor_id = f.id
  );

-- `contato_nome` e `contato_telefone` FICAM por enquanto, e de propósito.
--
-- Derrubá-las aqui quebraria a produção na janela entre aplicar a migration e
-- publicar o código novo — quatro telas ainda as leem. O padrão é expandir
-- agora e contrair depois: o código passa a ler `fornecedor_contato`, uma
-- migration seguinte derruba as colunas, e `fornecedor-contato.test.ts` impede
-- que alguém volte a lê-las nesse meio-tempo.
comment on column public.fornecedor.contato_nome is
  'SUPERADA pela tabela fornecedor_contato (0104). Nao ler nem escrever: sera derrubada.';
comment on column public.fornecedor.contato_telefone is
  'SUPERADA pela tabela fornecedor_contato (0104). Nao ler nem escrever: sera derrubada.';

notify pgrst, 'reload schema';
