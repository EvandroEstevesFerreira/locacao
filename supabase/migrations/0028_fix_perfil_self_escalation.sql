-- ============================================================================
-- P0 SEGURANÇA — impede autopromoção via perfil_update_self.
-- A policy permitia o usuário atualizar a própria linha; nada travava as
-- colunas papel/org_id/modulos/ativo. Um trigger passa a bloquear a alteração
-- dessas colunas quando é o próprio usuário (não-master) editando seu perfil.
-- Master continua gerenciando via perfil_admin_manage; nome/prefs seguem livres.
-- ============================================================================
create or replace function public.guard_perfil_self_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Master pode tudo (gestão de usuários passa por policy própria).
  if public.is_master() then
    return new;
  end if;
  -- Auto-edição: campos sensíveis não podem mudar.
  if new.id = auth.uid() then
    if new.papel is distinct from old.papel
       or new.org_id is distinct from old.org_id
       or new.ativo is distinct from old.ativo
       or new.modulos is distinct from old.modulos then
      raise exception 'Não é permitido alterar papel, organização, módulos ou situação do próprio usuário.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_perfil_self_update on public.perfil;
create trigger trg_guard_perfil_self_update
  before update on public.perfil
  for each row execute function public.guard_perfil_self_update();

notify pgrst, 'reload schema';
