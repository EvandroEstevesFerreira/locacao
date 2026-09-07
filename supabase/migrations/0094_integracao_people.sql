-- ============================================================================
-- A base de pessoas passa a vir do Sistenge People
--
-- Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
-- Contrato da API: fora do git (traz nomes de pessoas reais).
--
-- `funcionario` tem 118 linhas digitadas à mão, com ZERO CPF, ZERO matrícula e
-- ZERO CNH. O People é a fonte da verdade de pessoa na Sistenge e tem 483
-- pessoas no recorte acordado — inclusive 210 desligados de 2026, que entram
-- porque PODEM ESTAR COM EQUIPAMENTO NA MÃO.
--
-- Esta migration só abre espaço. Ela não move dado nenhum: a conciliação das
-- 118 linhas existentes é trabalho humano (43 delas precisam de decisão) e vem
-- depois, na fase 2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. `people_id` — a chave da integração
-- ---------------------------------------------------------------------------
-- NÃO É CPF NEM MATRÍCULA, de propósito. No People, 23 pessoas não têm CPF e 5
-- carregam matrícula gerada por um bug de import da ADP. Chave que falta em 28
-- linhas não é chave.
alter table public.funcionario
  add column if not exists people_id uuid,

  -- A SITUAÇÃO CRUA, além do `ativo` booleano.
  --
  -- `ativo` e `afastado` viram `ativo = true`; `desligado` vira `false`.
  -- Colapsar os três num booleano perderia a distinção que mais importa para
  -- quem está com equipamento: de quem se cobra a devolução HOJE. Afastado
  -- volta; desligado não.
  add column if not exists situacao_people text,

  add column if not exists sincronizado_em timestamptz;

alter table public.funcionario
  drop constraint if exists funcionario_situacao_people_check;

alter table public.funcionario
  add constraint funcionario_situacao_people_check
  check (situacao_people is null
         or situacao_people in ('ativo', 'afastado', 'desligado'));

-- ÚNICO POR ORGANIZAÇÃO, e não global. O Loca é multi-tenant; um único global
-- proibiria o mesmo `people_id` em duas organizações que integrem com
-- instâncias diferentes do People. Parcial porque as 118 linhas de hoje ficam
-- com `people_id` nulo até a conciliação da fase 2.
create unique index if not exists idx_funcionario_people
  on public.funcionario (org_id, people_id)
  where people_id is not null;

-- ---------------------------------------------------------------------------
-- 2. O de-para de obra
-- ---------------------------------------------------------------------------
-- O People manda o código do CENTRO DE RESULTADO ("605", "691"); o Loca tem 8
-- obras com código próprio. Os identificadores não coincidem, e os códigos já
-- divergiram historicamente entre sistemas da casa.
--
-- Coluna e não tabela: são 8 linhas, e na tela da obra o campo fica onde quem
-- sabe a resposta o encontra. Sem correspondência, `obra_id` fica NULO — chutar
-- por semelhança de nome colocaria equipamento na obra errada, e o erro só
-- apareceria numa cobrança.
alter table public.obra
  add column if not exists codigo_people text;

create unique index if not exists idx_obra_codigo_people
  on public.obra (org_id, codigo_people)
  where codigo_people is not null;

-- ---------------------------------------------------------------------------
-- 3. `people_sync` — configuração e cursor, por organização
-- ---------------------------------------------------------------------------
-- Mesmo desenho dos quatro crons que já existem: tabela de configuração por
-- organização, SEGREDO NO AMBIENTE. O token nunca entra no banco.
--
-- SEM LINHA AQUI, NÃO HÁ SINCRONIZAÇÃO. Fail-closed: uma organização só passa a
-- receber pessoas quando alguém declarar explicitamente que ela deve.
--
-- `ultimo_atualizado_em` é o cursor do delta — o maior `atualizado_em` já
-- recebido, que volta ao People como `?desde=`. Nulo significa "primeira
-- carga": varre tudo.
create table if not exists public.people_sync (
  org_id               uuid primary key references public.organizacao (id) on delete cascade,
  ativo                boolean not null default true,
  ultimo_atualizado_em timestamptz,
  ultimo_sync_em       timestamptz,
  ultimo_erro          text,
  pessoas_recebidas    integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.people_sync enable row level security;

drop policy if exists "people_sync_select" on public.people_sync;
drop policy if exists "people_sync_write"  on public.people_sync;

create policy "people_sync_select" on public.people_sync
  for select to authenticated
  using (org_id = (select public.current_org_id()));

-- Só quem gere cadastros mexe: ligar ou desligar a sincronização decide se a base
-- de pessoas do sistema inteiro é a local ou a do People.
create policy "people_sync_write" on public.people_sync
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );

-- ---------------------------------------------------------------------------
-- 4. A conferência
-- ---------------------------------------------------------------------------
-- Aborta se as colunas de CNH tiverem sumido. Elas são o único dado de pessoa
-- que continua sendo do Loca — o People não guarda categoria nem validade em
-- coluna nenhuma —, e a sincronização nunca deve tocá-las. Se alguém as
-- remover achando que o People passou a mandá-las, esta migration reclama.
do $$
declare
  v_cnh int;
begin
  select count(*) into v_cnh
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'funcionario'
    and column_name in ('cnh', 'cnh_categoria', 'cnh_validade');

  if v_cnh <> 3 then
    raise exception
      'As 3 colunas de CNH sao do Loca e devem existir; encontrei %.', v_cnh;
  end if;
end $$;

notify pgrst, 'reload schema';
