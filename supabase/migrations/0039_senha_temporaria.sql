-- ============================================================================
-- v0.14.0 — Onboarding: troca forçada da senha temporária no primeiro acesso
-- ============================================================================

alter table public.perfil
  add column if not exists senha_temporaria boolean not null default false;

-- Permite ao próprio usuário sinalizar que trocou a senha, sem depender de
-- service_role nem afrouxar as policies de perfil (SECURITY DEFINER restrito).
create or replace function public.marcar_senha_trocada()
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfil set senha_temporaria = false where id = auth.uid();
$$;

revoke all on function public.marcar_senha_trocada() from public;
grant execute on function public.marcar_senha_trocada() to authenticated;
