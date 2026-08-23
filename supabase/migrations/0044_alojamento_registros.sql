-- ============================================================================
-- Alojamento — registros da fase 3: medida disciplinar (FRM-RH-002) e entregas
-- ao ocupante (FRM-RH-003 chaves, FRM-RH-004 kit).
--
-- Ver docs/superpowers/specs/2026-08-22-documentos-alojamento-design.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- medida_disciplinar
--
-- Tabela própria, e não uma extensão de ocorrencia_imovel, por três motivos:
-- aquela é escopada a IMÓVEL e esta a PESSOA; o `tipo` de lá descreve evento
-- físico (avaria, reparo); e — o que decide — a CONFIDENCIALIDADE é outra. Uma
-- avaria todo mundo da obra pode ver; uma advertência, não.
-- ---------------------------------------------------------------------------
create table if not exists public.medida_disciplinar (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  ocupante_id  uuid not null references public.ocupante_imovel (id) on delete cascade,
  imovel_id    uuid not null references public.imovel (id) on delete cascade,
  data         date not null,
  tipo         text not null check (tipo in ('verbal', 'escrita', 'suspensao', 'outra')),
  -- Teto do art. 474 da CLT: suspensão de mais de 30 dias configura rescisão.
  -- A regra pertence ao banco, não só ao formulário.
  suspensao_dias   int check (suspensao_dias between 1 and 30),
  suspensao_inicio date,
  suspensao_fim    date,
  fato_em      timestamptz,
  fato_local   text,
  fato_descricao text not null,
  testemunhas  text,
  regras_violadas text[],          -- itens 6.1, 6.2, 7.1… da POL-RH-001
  clt_artigo   text,               -- alínea do art. 482
  reincidencia boolean not null default false,
  fundamentacao text,
  ciencia      text check (ciencia in ('recebeu', 'com_ressalva', 'recusou')),
  ciencia_em   date,
  documento_path text,             -- PDF assinado, digitalizado
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint medida_suspensao_coerente check (
    tipo <> 'suspensao'
    or (suspensao_dias is not null and suspensao_inicio is not null)
  ),
  constraint medida_suspensao_ordem check (
    suspensao_fim is null or suspensao_inicio is null or suspensao_fim >= suspensao_inicio
  )
);
create index if not exists idx_medida_ocupante on public.medida_disciplinar (ocupante_id);
create index if not exists idx_medida_imovel on public.medida_disciplinar (imovel_id);
create index if not exists idx_medida_org_data on public.medida_disciplinar (org_id, data desc);

create trigger trg_medida_disciplinar_updated_at
  before update on public.medida_disciplinar
  for each row execute function public.set_updated_at();

alter table public.medida_disciplinar enable row level security;
drop policy if exists "medida_disciplinar_select" on public.medida_disciplinar;
drop policy if exists "medida_disciplinar_write" on public.medida_disciplinar;

-- Primeira policy do schema que restringe LEITURA por papel. Registro
-- disciplinar é documento de pasta funcional; quem tem acesso à obra não tem,
-- por isso, direito de ler a advertência de um colega.
--
-- O `(select ...)` em volta das funções é a recomendação de performance de RLS
-- do Supabase: avalia uma vez por consulta, não uma vez por linha.
create policy "medida_disciplinar_select" on public.medida_disciplinar
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
    and deleted_at is null
  );
create policy "medida_disciplinar_write" on public.medida_disciplinar
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_gerir_cadastros())
  );

drop trigger if exists trg_audit on public.medida_disciplinar;
create trigger trg_audit after insert or update or delete on public.medida_disciplinar
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- entrega_ocupante
--
-- Uma tabela para chaves E kit, não duas: os dois documentos são o mesmo ciclo
-- — o alojado recebe na entrada e devolve na saída, com conferência de estado e
-- possível cobrança. Separá-los duplicaria o ciclo e transformaria "o que este
-- alojado ainda não devolveu?" em duas consultas.
--
-- `itens` e `checklist` mudam de forma conforme o tipo (união discriminada numa
-- coluna). Aceitável porque são RETRATO DE FORMULÁRIO IMPRESSO, não dado
-- consultado: ninguém vai perguntar ao banco quantos travesseiros estão rasgados.
-- Avaria que vira obrigação já tem casa em reparo_imovel.
-- ---------------------------------------------------------------------------
create table if not exists public.entrega_ocupante (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  ocupante_id  uuid not null references public.ocupante_imovel (id) on delete cascade,
  imovel_id    uuid not null references public.imovel (id) on delete cascade,
  tipo         text not null check (tipo in ('chaves', 'kit')),
  entregue_em  date,
  devolvido_em date,
  devolucao_motivo text check (devolucao_motivo in
    ('desligamento', 'transferencia', 'termino_contrato', 'outro')),
  itens        jsonb not null default '[]'::jsonb,
  checklist    jsonb not null default '[]'::jsonb,
  avarias      text,
  tratativa    text check (tratativa in
    ('sem_ressalva', 'desgaste_natural', 'atribuivel')),
  documento_path text,
  deleted_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint entrega_devolucao_ordem check (
    devolvido_em is null or entregue_em is null or devolvido_em >= entregue_em
  )
);
create index if not exists idx_entrega_ocupante on public.entrega_ocupante (ocupante_id, tipo);
create index if not exists idx_entrega_imovel on public.entrega_ocupante (imovel_id);
-- Pendências: o que foi entregue e ainda não voltou.
create index if not exists idx_entrega_pendente on public.entrega_ocupante (org_id)
  where devolvido_em is null and deleted_at is null;

create trigger trg_entrega_ocupante_updated_at
  before update on public.entrega_ocupante
  for each row execute function public.set_updated_at();

alter table public.entrega_ocupante enable row level security;
drop policy if exists "entrega_ocupante_select" on public.entrega_ocupante;
drop policy if exists "entrega_ocupante_write" on public.entrega_ocupante;
create policy "entrega_ocupante_select" on public.entrega_ocupante
  for select to authenticated
  using (org_id = (select public.current_org_id()) and deleted_at is null);
create policy "entrega_ocupante_write" on public.entrega_ocupante
  for all to authenticated
  using (org_id = (select public.current_org_id()) and (select public.pode_operar()))
  with check (org_id = (select public.current_org_id()) and (select public.pode_operar()));

drop trigger if exists trg_audit on public.entrega_ocupante;
create trigger trg_audit after insert or update or delete on public.entrega_ocupante
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- soft_delete: a função é um `case` por entidade, não é genérica. Cada tabela
-- nova precisa do seu ramo, senão cai no `else` e lança "Entidade inválida".
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete(p_entidade text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org    uuid := public.current_org_id();
  v_admin  boolean := public.pode_gerir_cadastros();
  v_linhas int;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  case p_entidade
    when 'imovel' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir imóveis.' using errcode = '42501';
      end if;
      update public.imovel set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null
          and (v_admin or public.is_member_of_obra(obra_id));

    when 'obra' then
      if not v_admin then
        raise exception 'Sem permissão para excluir obras.' using errcode = '42501';
      end if;
      update public.obra set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'contrato_locacao' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir contratos.' using errcode = '42501';
      end if;
      update public.contrato_locacao set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'lancamento_financeiro' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir lançamentos.' using errcode = '42501';
      end if;
      update public.lancamento_financeiro set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    -- Apagar advertência é ato crítico: some prova de pasta funcional. Só
    -- master, como contrato e lançamento financeiro.
    when 'medida_disciplinar' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir medidas disciplinares.' using errcode = '42501';
      end if;
      update public.medida_disciplinar set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'entrega_ocupante' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir entregas.' using errcode = '42501';
      end if;
      update public.entrega_ocupante set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    else
      raise exception 'Entidade inválida: %', p_entidade using errcode = '22023';
  end case;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

comment on function public.soft_delete(text, uuid) is
  'Marca deleted_at (soft-delete) validando org/papel/obra. SECURITY DEFINER '
  'porque a policy de SELECT esconde linhas com deleted_at, o que faria o RLS '
  'recusar o próprio UPDATE de exclusão.';

revoke all on function public.soft_delete(text, uuid) from public;
revoke all on function public.soft_delete(text, uuid) from anon;
grant execute on function public.soft_delete(text, uuid) to authenticated;

notify pgrst, 'reload schema';
