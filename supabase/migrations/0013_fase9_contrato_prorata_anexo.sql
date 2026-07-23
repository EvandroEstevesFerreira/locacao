-- ============================================================================
-- Fase 9 — Contrato: cobrança pró-rata + anexo do contrato original
-- ============================================================================

alter table public.contrato_locacao
  add column if not exists cobranca_prorata boolean not null default false,
  add column if not exists anexo_path        text;

-- ----------------------------------------------------------------------------
-- Storage: bucket privado "contratos" para o PDF/arquivo original do contrato.
-- Convenção de caminho: {org_id}/{contrato_id}/{arquivo}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratos', 'contratos', false)
on conflict (id) do nothing;

create policy "contratos_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "contratos_obj_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "contratos_obj_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "contratos_obj_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contratos'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
