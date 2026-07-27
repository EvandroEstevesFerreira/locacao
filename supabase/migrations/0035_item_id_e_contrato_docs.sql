-- ============================================================================
-- Contrato de locação: identificação do equipamento no item + documentos
-- adicionais (aditivos/renovações) além do contrato original.
-- ============================================================================

-- Identificação do equipamento (nº de série/registro/tag) por item locado.
alter table public.item_locado
  add column if not exists identificacao text;

-- Documentos do contrato: além do original (contrato_locacao.anexo_path),
-- permite anexar aditivos e renovações ao longo do tempo.
create table if not exists public.contrato_anexo (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizacao (id) on delete cascade,
  contrato_id  uuid not null references public.contrato_locacao (id) on delete cascade,
  tipo         text not null default 'aditivo',  -- 'aditivo' | 'renovacao' | 'outro'
  descricao    text,
  path         text not null,
  data         date,
  created_at   timestamptz not null default now()
);
create index if not exists idx_contrato_anexo_contrato on public.contrato_anexo (contrato_id);

alter table public.contrato_anexo enable row level security;
drop policy if exists "contrato_anexo_select" on public.contrato_anexo;
drop policy if exists "contrato_anexo_write" on public.contrato_anexo;
create policy "contrato_anexo_select" on public.contrato_anexo
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and exists (
      select 1 from public.contrato_locacao c
      where c.id = contrato_id
        and c.deleted_at is null
        and (
          public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
          or public.is_member_of_obra(c.obra_id)
        )
    )
  );
create policy "contrato_anexo_write" on public.contrato_anexo
  for all to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and exists (
      select 1 from public.contrato_locacao c
      where c.id = contrato_id
        and (
          public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
          or public.is_member_of_obra(c.obra_id)
        )
    )
  )
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and exists (
      select 1 from public.contrato_locacao c
      where c.id = contrato_id
        and (
          public.current_papel() = any (array['master'::public.papel_usuario, 'administrador'::public.papel_usuario])
          or public.is_member_of_obra(c.obra_id)
        )
    )
  );

-- Auditoria também nos documentos do contrato.
drop trigger if exists trg_audit on public.contrato_anexo;
create trigger trg_audit after insert or update or delete on public.contrato_anexo
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
