-- ============================================================================
-- Fechamento mensal: a fotografia da competência
-- (subprojeto D do controle orçamentário)
--
-- A diretoria pediu para "abater o saldo dos contratos" ao fim de cada mês. O
-- que isso exige não é uma conta nova — é PARAR DE RECALCULAR.
--
-- Se o fechamento de setembro fosse uma consulta sobre as tabelas vivas, mudar
-- um preço em outubro reescreveria setembro em silêncio: o e-mail que o diretor
-- tem na caixa deixaria de bater com o sistema, e a partir daí nenhum número do
-- histórico seria defensável.
--
-- Então os valores são GRAVADOS, e a linha é IMUTÁVEL: um trigger recusa
-- UPDATE em fechamento não reaberto. Reabrir é um ato explícito, registrado com
-- autor e data.
--
-- Nada aqui altera dado existente: uma tabela nova, um trigger e as policies.
-- ============================================================================

create table if not exists public.fechamento_mensal (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizacao (id) on delete cascade,
  obra_id             uuid not null references public.obra (id) on delete cascade,
  -- Sempre o dia 1 do mês. O check impede competência no meio do mês, que
  -- geraria duas fotografias do mesmo período.
  competencia         date not null check (extract(day from competencia) = 1),

  -- A FOTOGRAFIA. Estes valores não são recalculados nunca.
  orcado              numeric(14,2) not null,
  realizado_acumulado numeric(14,2) not null,
  realizado_mes       numeric(14,2) not null,
  saldo               numeric(14,2) not null,
  -- Nulos são legítimos: obra sem avanço lançado ou sem orçamento fecha o mês
  -- com o que tem, e a ausência fica registrada como ausência.
  avanco_fisico       numeric(5,2),
  consumido           numeric(9,2),

  fechado_em          timestamptz not null default now(),
  fechado_por         uuid references public.perfil (id) on delete set null,
  -- Reabertura: enquanto `reaberto_em` é nulo, a linha é imutável.
  reaberto_em         timestamptz,
  reaberto_por        uuid references public.perfil (id) on delete set null,
  observacoes         text,

  unique (obra_id, competencia)
);

create index if not exists idx_fechamento_obra on public.fechamento_mensal (obra_id, competencia desc);
create index if not exists idx_fechamento_org  on public.fechamento_mensal (org_id);

-- ---------------------------------------------------------------------------
-- A trava de imutabilidade
-- ---------------------------------------------------------------------------
-- É a razão de a tabela existir. Sem ela, "fechamento" seria só um nome: um
-- UPDATE qualquer reescreveria a fotografia e o histórico voltaria a ser
-- opinião.
--
-- O único UPDATE permitido é o que REABRE (preenche `reaberto_em`). Depois de
-- reaberta, a linha aceita correção — e a reabertura fica registrada, que é o
-- que torna a correção auditável em vez de invisível.
create or replace function public.guard_fechamento_imutavel()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  -- Reabrir: passar de nulo para preenchido. Permitido.
  if old.reaberto_em is null and new.reaberto_em is not null then
    return new;
  end if;

  -- Linha já reaberta aceita correção.
  if old.reaberto_em is not null then
    return new;
  end if;

  raise exception
    'Competência fechada em % não pode ser alterada. Reabra o fechamento primeiro.',
    to_char(old.competencia, 'MM/YYYY');
end;
$$;

drop trigger if exists trg_fechamento_imutavel on public.fechamento_mensal;
create trigger trg_fechamento_imutavel
  before update on public.fechamento_mensal
  for each row execute function public.guard_fechamento_imutavel();

-- ---------------------------------------------------------------------------
-- RLS — escopo por obra, escrita para quem gere o financeiro
-- ---------------------------------------------------------------------------
alter table public.fechamento_mensal enable row level security;

drop policy if exists "fechamento_select" on public.fechamento_mensal;
create policy "fechamento_select" on public.fechamento_mensal
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      public.current_papel() in ('master', 'administrador', 'gestor')
      or public.is_member_of_obra(obra_id)
    )
  );

drop policy if exists "fechamento_write" on public.fechamento_mensal;
create policy "fechamento_write" on public.fechamento_mensal
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_financeiro())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_financeiro())
  );
