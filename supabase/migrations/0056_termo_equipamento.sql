-- ============================================================================
-- Termo de responsabilidade por uso de equipamento.
--
-- Spec: docs/superpowers/specs/2026-08-25-termo-equipamento-design.md
--
-- O equipamento sai do almoxarifado para a mão do funcionário sem documento
-- nenhum. Quando some ou volta quebrado, não há papel que diga quem estava com
-- ele, em que estado saiu e quando deveria voltar.
-- ============================================================================

-- `estado_equipamento` NÃO nasce aqui: é criado pela migration do cadastro de frota
-- (cadastro de frota). Esta migration apenas o usa.

-- ---------------------------------------------------------------------------
-- funcionario — o primeiro cadastro de PESSOA do sistema
-- ---------------------------------------------------------------------------
-- `perfil` são os usuários com login; `ocupante_imovel` é uma ocupação de
-- alojamento, com quarto e armário. Quem opera equipamento e não mora em
-- alojamento não tem linha em nenhum dos dois.
--
-- Sem `deleted_at` de propósito: desligamento é `ativo = false`, e o vínculo
-- com os termos antigos tem de sobreviver. Menos uma tabela sujeita à armadilha
-- de RLS da 0041.
create table if not exists public.funcionario (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  nome       text not null,
  cpf        text,
  cargo      text,
  matricula  text,
  telefone   text,
  obra_id    uuid references public.obra (id) on delete set null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_funcionario_org on public.funcionario (org_id);
create index if not exists idx_funcionario_obra on public.funcionario (obra_id);
-- Índice parcial: CPF repetido na mesma organização é erro; CPF em branco não,
-- porque nem toda obra tem o dado na hora de emitir o termo.
create unique index if not exists idx_funcionario_cpf
  on public.funcionario (org_id, cpf) where cpf is not null;

-- ---------------------------------------------------------------------------
-- termo_equipamento
-- ---------------------------------------------------------------------------
create table if not exists public.termo_equipamento (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references public.organizacao (id) on delete cascade,
  numero_registro     text,
  funcionario_id      uuid not null references public.funcionario (id) on delete restrict,
  obra_id             uuid references public.obra (id) on delete set null,
  contrato_id         uuid references public.contrato_locacao (id) on delete set null,
  data_entrega        date not null,
  previsao_devolucao  date,
  emitido_em          timestamptz,
  encerrado_em        timestamptz,
  cancelado_em        timestamptz,
  motivo_cancelamento text,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, numero_registro)
);
create index if not exists idx_termo_org on public.termo_equipamento (org_id);
create index if not exists idx_termo_obra on public.termo_equipamento (obra_id);
create index if not exists idx_termo_funcionario on public.termo_equipamento (funcionario_id);

-- SEM `trg_numero_registro`, de propósito. O trigger da 0048 numera no INSERT,
-- e aqui o número tem de sair na EMISSÃO — rascunho não gasta número. A action
-- chama `proximo_numero`. Mesmo desenho do `recebimento` (0049).

create table if not exists public.termo_equipamento_item (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  termo_id         uuid not null references public.termo_equipamento (id) on delete cascade,
  item_id          uuid not null references public.item_catalogo (id) on delete restrict,
  unidade_id       uuid references public.equipamento_unidade (id) on delete restrict,
  item_locado_id   uuid references public.item_locado (id) on delete set null,
  quantidade       numeric(14,2) not null default 1,
  estado_entrega   public.estado_equipamento not null,
  estado_devolucao public.estado_equipamento,
  data_devolucao   date,
  observacoes      text
);
create index if not exists idx_termo_item_termo on public.termo_equipamento_item (termo_id);
create index if not exists idx_termo_item_unidade on public.termo_equipamento_item (unidade_id);

-- Uma linha por (termo, momento, papel). Tabela em vez de vinte colunas quase
-- idênticas na `termo_equipamento` — e a trilha (hora + IP) fica uniforme.
create table if not exists public.termo_assinatura (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizacao (id) on delete cascade,
  termo_id    uuid not null references public.termo_equipamento (id) on delete cascade,
  momento     text not null check (momento in ('entrega','devolucao')),
  papel       text not null check (papel   in ('funcionario','empresa')),
  nome        text not null,
  cpf         text,
  imagem      text,
  assinado_em timestamptz not null default now(),
  assinado_ip inet,
  unique (termo_id, momento, papel)
);

-- ---------------------------------------------------------------------------
-- Prefixo
-- ---------------------------------------------------------------------------
-- Redeclarada inteira: `prefixo_registro` é um CASE, não há como acrescentar um
-- ramo sem reescrever. Espelhada em `src/lib/registros.ts` e verificada por
-- `registros.test.ts`.
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'   then 'CTR'
    when 'contrato_imovel'    then 'CTI'
    when 'recebimento'        then 'REC'
    when 'movimentacao'       then 'DEV'
    when 'vistoria'           then 'VIS'
    when 'vistoria_imovel'    then 'VIM'
    when 'avaria'             then 'AVA'
    when 'reparo_imovel'      then 'REP'
    when 'medida_disciplinar' then 'MED'
    when 'entrega_ocupante'   then 'ENT'
    when 'checklist_limpeza'  then 'LIM'
    when 'ocorrencia_imovel'  then 'OCO'
    when 'termo_equipamento'  then 'TRM'
    else 'REG'
  end;
$$;

-- ---------------------------------------------------------------------------
-- Situação, derivada
-- ---------------------------------------------------------------------------
-- Coluna `status` guardada mente depois de uma devolução parcial: quem devolve
-- item esquece de atualizar o cabeçalho. Contar os itens não tem esse defeito.
create or replace view public.termo_equipamento_situacao as
select
  t.id as termo_id,
  case
    when t.cancelado_em is not null then 'cancelado'
    when t.emitido_em   is null     then 'rascunho'
    when t.encerrado_em is not null then 'devolvido'
    when count(i.id) filter (where i.data_devolucao is null) = 0
         and count(i.id) > 0        then 'devolvido'
    when count(i.id) filter (where i.data_devolucao is not null) > 0
                                    then 'devolvido_parcial'
    else 'em_uso'
  end as situacao
from public.termo_equipamento t
left join public.termo_equipamento_item i on i.termo_id = t.id
group by t.id, t.cancelado_em, t.emitido_em, t.encerrado_em;

-- ---------------------------------------------------------------------------
-- RLS — espelha imóveis e contratos
-- ---------------------------------------------------------------------------
alter table public.funcionario             enable row level security;
alter table public.termo_equipamento       enable row level security;
alter table public.termo_equipamento_item  enable row level security;
alter table public.termo_assinatura        enable row level security;

-- Funcionário é da organização inteira: precisa aparecer na lista de escolha de
-- quem emite o termo, e o emissor pode não ter acesso à obra de lotação dele.
drop policy if exists "funcionario_select" on public.funcionario;
create policy "funcionario_select" on public.funcionario
  for select to authenticated
  using (org_id = public.current_org_id());
drop policy if exists "funcionario_insert" on public.funcionario;
create policy "funcionario_insert" on public.funcionario
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_operar());
drop policy if exists "funcionario_update" on public.funcionario;
create policy "funcionario_update" on public.funcionario
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id() and public.pode_operar());
drop policy if exists "funcionario_delete" on public.funcionario;
create policy "funcionario_delete" on public.funcionario
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

drop policy if exists "termo_select" on public.termo_equipamento;
create policy "termo_select" on public.termo_equipamento
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  );
drop policy if exists "termo_write" on public.termo_equipamento;
create policy "termo_write" on public.termo_equipamento
  for all to authenticated
  using (
    org_id = public.current_org_id() and public.pode_operar()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  )
  with check (
    org_id = public.current_org_id() and public.pode_operar()
    and (public.pode_gerir_cadastros() or public.is_member_of_obra(obra_id))
  );

-- Acesso ao termo pai decide o acesso às filhas. SECURITY DEFINER para não
-- recursar na policy de `termo_equipamento`.
create or replace function public.has_termo_access(p_termo uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.termo_equipamento t
    where t.id = p_termo
      and t.org_id = public.current_org_id()
      and (public.pode_gerir_cadastros() or public.is_member_of_obra(t.obra_id))
  );
$$;

do $$
declare t text;
begin
  foreach t in array array['termo_equipamento_item','termo_assinatura'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
         using (org_id = public.current_org_id() and public.has_termo_access(termo_id))',
      t || '_select', t
    );
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (org_id = public.current_org_id() and public.pode_operar() and public.has_termo_access(termo_id))
         with check (org_id = public.current_org_id() and public.pode_operar() and public.has_termo_access(termo_id))',
      t || '_write', t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
drop trigger if exists trg_funcionario_updated_at on public.funcionario;
create trigger trg_funcionario_updated_at before update on public.funcionario
  for each row execute function public.set_updated_at();
drop trigger if exists trg_termo_updated_at on public.termo_equipamento;
create trigger trg_termo_updated_at before update on public.termo_equipamento
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit on public.funcionario;
create trigger trg_audit after insert or update or delete on public.funcionario
  for each row execute function public.registrar_auditoria();
drop trigger if exists trg_audit on public.termo_equipamento;
create trigger trg_audit after insert or update or delete on public.termo_equipamento
  for each row execute function public.registrar_auditoria();

notify pgrst, 'reload schema';
