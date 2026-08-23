-- ============================================================================
-- Alojamento — rotina semanal de limpeza (FRM-RH-005), fase 4.
--
-- O catálogo em tabela é o que VIABILIZA a economia de papel do formulário: com
-- as tarefas classificadas por frequência, a folha semanal imprime só as
-- diárias e semanais, e as mensais saem numa folha própria, uma vez por mês.
-- Sem isso, toda semana a obra imprimiria as 44 tarefas.
-- ============================================================================

create table if not exists public.tarefa_limpeza (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  grupo      text not null,
  descricao  text not null,
  frequencia text not null check (frequencia in ('D', 'S', 'M')),
  ordem      int not null default 0,
  ativo      boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_tarefa_limpeza_org
  on public.tarefa_limpeza (org_id, ordem)
  where deleted_at is null;

create trigger trg_tarefa_limpeza_updated_at
  before update on public.tarefa_limpeza
  for each row execute function public.set_updated_at();

alter table public.tarefa_limpeza enable row level security;
drop policy if exists "tarefa_limpeza_select" on public.tarefa_limpeza;
drop policy if exists "tarefa_limpeza_write" on public.tarefa_limpeza;
create policy "tarefa_limpeza_select" on public.tarefa_limpeza
  for select to authenticated
  using (org_id = (select public.current_org_id()) and deleted_at is null);
-- Alterar o catálogo muda a folha de TODOS os alojamentos: é configuração.
create policy "tarefa_limpeza_write" on public.tarefa_limpeza
  for all to authenticated
  using (org_id = (select public.current_org_id()) and (select public.pode_gerir_cadastros()))
  with check (org_id = (select public.current_org_id()) and (select public.pode_gerir_cadastros()));

drop trigger if exists trg_audit on public.tarefa_limpeza;
create trigger trg_audit after insert or update or delete on public.tarefa_limpeza
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- checklist_limpeza — uma linha por imóvel/semana.
-- ---------------------------------------------------------------------------
create table if not exists public.checklist_limpeza (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  imovel_id     uuid not null references public.imovel (id) on delete cascade,
  -- Sempre a segunda-feira da semana. Calculada com hojeISOSaoPaulo(), nunca
  -- com new Date(): o Vercel roda em UTC e das 21h à meia-noite em Brasília a
  -- semana viraria antes da hora.
  semana_inicio date not null,
  auxiliar_nome text,
  marcacoes     jsonb not null default '{}'::jsonb,  -- {tarefa_id: [1..7]}
  epi           jsonb not null default '[]'::jsonb,
  estoque       jsonb not null default '[]'::jsonb,
  observacoes   text,
  avaliacao     text check (avaliacao in ('conforme', 'parcial', 'nao_conforme')),
  documento_path text,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Impede a duplicata que aparece quando duas pessoas abrem a folha da mesma
  -- semana. Sem isto, a obra fica com dois checklists divergentes e nenhum
  -- deles é o oficial.
  unique (imovel_id, semana_inicio)
);
create index if not exists idx_checklist_limpeza_imovel
  on public.checklist_limpeza (imovel_id, semana_inicio desc);

create trigger trg_checklist_limpeza_updated_at
  before update on public.checklist_limpeza
  for each row execute function public.set_updated_at();

alter table public.checklist_limpeza enable row level security;
drop policy if exists "checklist_limpeza_select" on public.checklist_limpeza;
drop policy if exists "checklist_limpeza_write" on public.checklist_limpeza;
create policy "checklist_limpeza_select" on public.checklist_limpeza
  for select to authenticated
  using (org_id = (select public.current_org_id()) and deleted_at is null);
create policy "checklist_limpeza_write" on public.checklist_limpeza
  for all to authenticated
  using (org_id = (select public.current_org_id()) and (select public.pode_operar()))
  with check (org_id = (select public.current_org_id()) and (select public.pode_operar()));

drop trigger if exists trg_audit on public.checklist_limpeza;
create trigger trg_audit after insert or update or delete on public.checklist_limpeza
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- soft_delete: ramos das duas tabelas novas.
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

    -- Catálogo de tarefas: cadastro, vale para toda a organização.
    when 'tarefa_limpeza' then
      if not v_admin then
        raise exception 'Sem permissão para excluir tarefas de limpeza.' using errcode = '42501';
      end if;
      update public.tarefa_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'checklist_limpeza' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir checklists.' using errcode = '42501';
      end if;
      update public.checklist_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    else
      raise exception 'Entidade inválida: %', p_entidade using errcode = '22023';
  end case;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$$;

revoke all on function public.soft_delete(text, uuid) from public;
revoke all on function public.soft_delete(text, uuid) from anon;
grant execute on function public.soft_delete(text, uuid) to authenticated;

notify pgrst, 'reload schema';
