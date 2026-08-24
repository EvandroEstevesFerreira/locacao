-- ============================================================================
-- Alertas de vencimento por obra, com central.
--
-- Hoje o robô diário monta UM e-mail com todas as obras e envia para uma lista
-- fixa da organização. Passa a sair um e-mail por obra — com o que é dela — e
-- um central com tudo agrupado.
--
-- Os destinatários da obra vêm de `obra_usuario`, a MESMA fonte que a RLS usa
-- para decidir quem enxerga a obra. Uma lista digitada seria segunda verdade:
-- tirar alguém da obra não tiraria os alertas dela, e a pessoa continuaria
-- recebendo por e-mail o que já não pode ver na tela.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Lista extra: quem NÃO tem login no Loca.
-- ---------------------------------------------------------------------------
-- Encarregado terceirizado, e-mail da obra, mestre sem usuário. São exatamente
-- as pessoas que `obra_usuario` não conhece — e só elas. Quem tem login vem do
-- vínculo, não daqui.
alter table public.obra
  add column if not exists destinatarios_alerta text[] not null default '{}';

-- ---------------------------------------------------------------------------
-- DRIFT: notificacao_log.dias nunca foi versionada.
-- ---------------------------------------------------------------------------
-- O cron lê e grava `dias` (o marco de 30/15/3 que o aviso representa) desde a
-- fase 5, e nenhuma migration a criou. Produção tem a coluna — caso contrário o
-- cron falharia todo dia —, mas um banco novo criado a partir das migrations
-- não teria, e o cron quebraria no primeiro disparo.
--
-- Mesmo caso do `config_alerta.dias_alerta`, que a migration 0029 registrou.
-- Idempotente pelo mesmo motivo: em produção não faz nada.
alter table public.notificacao_log
  add column if not exists dias int;

-- ---------------------------------------------------------------------------
-- notificacao_log ganha o público a que o registro se refere.
-- ---------------------------------------------------------------------------
-- Com dois públicos, o MESMO vencimento é notificado duas vezes no mesmo dia:
-- uma para a obra, outra para a central. Sem `obra_id` na chave, a segunda
-- gravação viola a restrição e aborta o lote inteiro — e o sintoma seria a
-- central parar de receber sem erro visível em lugar nenhum.
alter table public.notificacao_log
  add column if not exists obra_id uuid references public.obra (id) on delete cascade;

comment on column public.notificacao_log.obra_id is
  'Obra a que este envio se refere. NULO = envio para a lista central.';

-- A restrição original de 0009 é (org_id, tipo, referencia_id, data_referencia)
-- e não conhece nem `dias` nem `obra_id`.
--
-- NÃO derrubamos por nome. A coluna `dias` foi criada fora de banda, então a
-- restrição pode ter sido recriada junto, com outro nome — e um
-- `drop constraint if exists <nome_esperado>` viraria no-op silencioso. A
-- restrição antiga sobreviveria e recusaria o segundo envio (o da central),
-- abortando o lote: exatamente a falha que esta migration existe para evitar.
--
-- Então varremos: derruba TODA unique de notificacao_log que não seja a nossa.
do $$
declare
  r record;
begin
  for r in
    select conname
      from pg_constraint
     where conrelid = 'public.notificacao_log'::regclass
       and contype = 'u'
  loop
    execute format('alter table public.notificacao_log drop constraint %I', r.conname);
    raise notice 'notificacao_log: constraint unica removida -> %', r.conname;
  end loop;

  for r in
    select indexrelid::regclass::text as nome
      from pg_index
     where indrelid = 'public.notificacao_log'::regclass
       and indisunique
       and not indisprimary
       and indexrelid::regclass::text <> 'notificacao_log_publico_uniq'
  loop
    execute format('drop index if exists %s', r.nome);
    raise notice 'notificacao_log: indice unico removido -> %', r.nome;
  end loop;
end $$;

-- `coalesce` no índice porque, em Postgres, NULL não é igual a NULL num índice
-- único: duas linhas de central com o mesmo aviso passariam pela restrição e o
-- e-mail central sairia repetido no mesmo dia.
create unique index if not exists notificacao_log_publico_uniq
  on public.notificacao_log (
    org_id,
    tipo,
    referencia_id,
    data_referencia,
    coalesce(dias, -1),
    coalesce(obra_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

create index if not exists idx_notif_obra on public.notificacao_log (obra_id);

notify pgrst, 'reload schema';
