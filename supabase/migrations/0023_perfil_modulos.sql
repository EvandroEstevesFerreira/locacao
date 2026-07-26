-- ============================================================================
-- Acesso modular por usuário: quais módulos cada perfil pode acessar.
-- NULL = acesso a todos os módulos (retrocompatível). Lista = whitelist.
-- O Master nunca é restringido (regra na aplicação).
-- ============================================================================
alter table public.perfil
  add column if not exists modulos text[];

notify pgrst, 'reload schema';
