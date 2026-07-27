-- ============================================================================
-- Trilha de auditoria: registra INSERT/UPDATE/DELETE das entidades críticas,
-- com autor (auth.uid), ação, snapshot da linha e timestamp. Só o master da
-- própria organização consulta. A gravação é feita por função SECURITY DEFINER.
-- ============================================================================
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  org_id       uuid,
  entidade     text not null,
  registro_id  uuid,
  acao         text not null,          -- INSERT | UPDATE | DELETE
  autor        uuid,                   -- auth.uid()
  dados        jsonb,                  -- snapshot da linha (nova; antiga no delete)
  criado_em    timestamptz not null default now()
);
create index if not exists idx_audit_log_org_data on public.audit_log (org_id, criado_em desc);
create index if not exists idx_audit_log_entidade on public.audit_log (entidade, registro_id);

alter table public.audit_log enable row level security;
drop policy if exists "audit_log_select" on public.audit_log;
create policy "audit_log_select" on public.audit_log
  for select to authenticated
  using (org_id = public.current_org_id() and public.is_master());
-- Sem policy de INSERT para authenticated: só a função abaixo grava.

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_org uuid;
  v_id  uuid;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  v_org := nullif(v_row->>'org_id', '')::uuid;
  v_id  := nullif(v_row->>'id', '')::uuid;
  insert into public.audit_log (org_id, entidade, registro_id, acao, autor, dados)
  values (v_org, tg_table_name, v_id, tg_op, auth.uid(), v_row);
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'contrato_locacao','item_locado','lancamento_financeiro','obra',
    'fornecedor','imovel','contrato_imovel','ocupante_imovel','perfil'
  ] loop
    execute format('drop trigger if exists trg_audit on public.%I', t);
    execute format(
      'create trigger trg_audit after insert or update or delete on public.%I for each row execute function public.registrar_auditoria()',
      t
    );
  end loop;
end;
$$;

notify pgrst, 'reload schema';
