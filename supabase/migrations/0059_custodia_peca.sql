-- ============================================================================
-- Custódia da peça: quem está, quem ficou, e por quanto tempo
-- (docs/superpowers/specs/2026-09-02-custodia-peca-design.md)
--
-- `equipamento_unidade.obra_id` responde "onde está" e SOBRESCREVE a resposta
-- anterior. Mover a peça da Obra A para a Obra B apagava o fato de ela ter
-- estado na A. Este livro guarda uma linha por PERÍODO de posse, com `fim`
-- nulo na posse aberta.
--
-- Nada aqui altera dado existente: uma tabela nova, colunas opcionais, e uma
-- semeadura a partir dos termos já emitidos.
-- ============================================================================

create table if not exists public.custodia_peca (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizacao (id) on delete cascade,
  unidade_id     uuid not null references public.equipamento_unidade (id) on delete cascade,
  tipo           text not null,
  -- `on delete set null` nas três: apagar a obra não pode apagar a história.
  obra_id        uuid references public.obra (id) on delete set null,
  funcionario_id uuid references public.funcionario (id) on delete set null,
  fornecedor_id  uuid references public.fornecedor (id) on delete set null,
  inicio         date not null,
  -- NULO = posse aberta.
  fim            date,
  origem         text not null,
  termo_id       uuid references public.termo_equipamento (id) on delete set null,
  observacoes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Uma só posse aberta por peça. Índice PARCIAL, e não constraint, porque é o
-- que permite N posses encerradas convivendo com uma aberta — o mesmo recurso
-- que segura "um orçamento vigente por obra" na 0051. Peça sem linha nenhuma é
-- estado legítimo: é o de todas as peças já cadastradas.
create unique index if not exists idx_custodia_aberta
  on public.custodia_peca (unidade_id) where fim is null;

create index if not exists idx_custodia_unidade on public.custodia_peca (unidade_id);
create index if not exists idx_custodia_org on public.custodia_peca (org_id);
create index if not exists idx_custodia_funcionario
  on public.custodia_peca (funcionario_id) where funcionario_id is not null;
create index if not exists idx_custodia_obra
  on public.custodia_peca (obra_id) where obra_id is not null;

alter table public.custodia_peca drop constraint if exists custodia_tipo_check;
alter table public.custodia_peca add constraint custodia_tipo_check
  check (tipo in ('almoxarifado','obra','funcionario','fornecedor'));

alter table public.custodia_peca drop constraint if exists custodia_origem_check;
alter table public.custodia_peca add constraint custodia_origem_check
  check (origem in ('termo','manual'));

-- Sem este check nasce a linha que diz "funcionário" e aponta para uma obra, e
-- a leitura passa a ter de adivinhar de quem é a posse.
--
-- `tipo = 'funcionario'` admite `obra_id` de propósito: o notebook está com a
-- pessoa, e a pessoa está numa obra. As duas coisas são verdade ao mesmo
-- tempo, e é o que faz a tela "o que está na obra" encontrar o notebook.
alter table public.custodia_peca drop constraint if exists custodia_detentor_coerente;
alter table public.custodia_peca add constraint custodia_detentor_coerente
  check (
    case tipo
      when 'almoxarifado' then obra_id is null and funcionario_id is null and fornecedor_id is null
      when 'obra'         then obra_id is not null and funcionario_id is null and fornecedor_id is null
      when 'funcionario'  then funcionario_id is not null and fornecedor_id is null
      when 'fornecedor'   then fornecedor_id is not null and funcionario_id is null
      else false
    end
  );

alter table public.custodia_peca drop constraint if exists custodia_periodo_check;
alter table public.custodia_peca add constraint custodia_periodo_check
  check (fim is null or fim >= inicio);

-- Posse de funcionário só nasce por termo assinado. No BANCO, e não só na
-- tela: a tela pode estar velha, e o valor do termo é justamente ser a única
-- fonte de verdade sobre quem respondeu pelo equipamento.
alter table public.custodia_peca drop constraint if exists custodia_funcionario_exige_termo;
alter table public.custodia_peca add constraint custodia_funcionario_exige_termo
  check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null));

drop trigger if exists trg_custodia_updated_at on public.custodia_peca;
create trigger trg_custodia_updated_at
  before update on public.custodia_peca
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Imutabilidade: só o fechamento pode mudar
-- ---------------------------------------------------------------------------
-- Somente-inclusão com UMA exceção — encerrar uma posse aberta gravando `fim`.
-- A comparação é por jsonb e NÃO lista colunas: coluna acrescentada amanhã
-- fica protegida sem ninguém lembrar de voltar aqui.
create or replace function public.guard_custodia_peca()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Posse não pode ser apagada. Encerre a posse e abra a seguinte.';
  end if;

  if old.fim is not null then
    raise exception 'Esta posse já foi encerrada e não pode ser reaberta.';
  end if;

  if new.fim is null then
    raise exception 'Nada a alterar: só o encerramento da posse pode ser gravado.';
  end if;

  if (to_jsonb(new) - 'fim' - 'updated_at') is distinct from
     (to_jsonb(old) - 'fim' - 'updated_at') then
    raise exception 'Numa posse, só a data de fim pode ser gravada.';
  end if;

  return new;
end;
$$;

-- `from public`, e não só de anon/authenticated: EXECUTE é concedido a PUBLIC
-- por padrão e os dois roles herdam de lá. Revogar só deles retorna sucesso e
-- não revoga nada — foi o incidente da 0.45.1.
revoke execute on function public.guard_custodia_peca() from public;

drop trigger if exists trg_custodia_imutavel on public.custodia_peca;
create trigger trg_custodia_imutavel
  before update or delete on public.custodia_peca
  for each row execute function public.guard_custodia_peca();

-- ---------------------------------------------------------------------------
-- Campos de TI, na PEÇA
-- ---------------------------------------------------------------------------
-- Na peça e não no catálogo: o mesmo "Notebook Dell Latitude 3490" tem
-- unidades com 8 e com 16 GB, e a verdade fica onde as duas divergem.
--
-- `memoria_gb` é coluna própria porque é por ela que se filtra ("quais
-- notebooks têm 8 GB para trocar este ano"). Processador, armazenamento e SO
-- são descritivos e vivem melhor numa linha escrita como o TI já escreve.
--
-- `imei_2` existe porque celular corporativo com dois chips é comum, e o
-- segundo IMEI é o que a operadora pede no bloqueio por roubo.
alter table public.equipamento_unidade
  add column if not exists imei             text,
  add column if not exists imei_2           text,
  add column if not exists linha_telefonica text,
  add column if not exists operadora        text,
  add column if not exists service_tag      text,
  add column if not exists memoria_gb       smallint,
  add column if not exists configuracao     text;

alter table public.equipamento_unidade drop constraint if exists equip_unidade_memoria_check;
alter table public.equipamento_unidade add constraint equip_unidade_memoria_check
  check (memoria_gb is null or (memoria_gb between 1 and 1024));

-- IMEI é único no mundo por definição, e uma linha telefônica está num
-- aparelho só. Índice parcial para não colidir nas peças sem nenhum dos dois.
create unique index if not exists idx_unidade_imei
  on public.equipamento_unidade (org_id, imei) where imei is not null;
create unique index if not exists idx_unidade_linha
  on public.equipamento_unidade (org_id, linha_telefonica) where linha_telefonica is not null;

comment on column public.equipamento_unidade.obra_id is
  'NULO = almoxarifado central. Escrito SÓ pelo escritor de custódia (src/lib/custodia-servidor.ts) e por adicionarUnidade. Histórico em custodia_peca.';

-- ---------------------------------------------------------------------------
-- Perfil de campos da categoria
-- ---------------------------------------------------------------------------
-- Governa quais campos o formulário da peça mostra. Por PERFIL e não pelo
-- nome: acoplar a UI a `nome = 'TI'` quebra quando alguém renomeia para
-- "Tecnologia".
alter table public.categoria_equipamento
  add column if not exists perfil_campos text not null default 'geral';

alter table public.categoria_equipamento drop constraint if exists categoria_perfil_check;
alter table public.categoria_equipamento add constraint categoria_perfil_check
  check (perfil_campos in ('geral','ti'));

-- `update` por nome é aceitável UMA vez, sobre as 8 categorias semeadas em
-- 0055 — é dado conhecido, não regra permanente.
update public.categoria_equipamento set perfil_campos = 'ti' where nome = 'TI';

-- ---------------------------------------------------------------------------
-- Semeadura retroativa a partir dos termos já emitidos
-- ---------------------------------------------------------------------------
-- Hoje há ZERO termos em produção, então este insert é no-op — e é exatamente
-- por isso que tem de ser agora. Dentro de seis meses seria script de correção
-- com termo real em cima.
--
-- Só termo EMITIDO e NÃO cancelado, e só linha com peça: rascunho não entregou
-- nada, e item por quantidade não tem peça a rastrear.
insert into public.custodia_peca
  (org_id, unidade_id, tipo, obra_id, funcionario_id, inicio, fim, origem, termo_id)
select
  t.org_id,
  i.unidade_id,
  'funcionario',
  t.obra_id,
  t.funcionario_id,
  t.data_entrega,
  coalesce(i.data_devolucao, t.encerrado_em::date),
  'termo',
  t.id
from public.termo_equipamento t
join public.termo_equipamento_item i on i.termo_id = t.id
where t.emitido_em is not null
  and t.cancelado_em is null
  and i.unidade_id is not null
  -- Idempotência: reaplicar a migration não duplica linha.
  and not exists (
    select 1 from public.custodia_peca c
    where c.termo_id = t.id and c.unidade_id = i.unidade_id
  );

-- ---------------------------------------------------------------------------
-- RLS — acompanha `equipamento_unidade`, não o escopo por obra
-- ---------------------------------------------------------------------------
-- Leitura livre na organização. É a mesma exceção consciente registrada na
-- spec de frota, pela mesma razão: um gestor precisa ver que a betoneira
-- ESTEVE na Obra B justamente para ir buscá-la, e escopo por obra na leitura
-- tornaria impossível a pergunta que a tela existe para responder.
alter table public.custodia_peca enable row level security;

drop policy if exists "custodia_select" on public.custodia_peca;
create policy "custodia_select" on public.custodia_peca
  for select to authenticated
  using (org_id = (select public.current_org_id()));

drop policy if exists "custodia_insert" on public.custodia_peca;
create policy "custodia_insert" on public.custodia_peca
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- UPDATE liberado na policy e ESTREITADO pela trigger: a policy diz quem pode
-- encostar na linha, a trigger diz o que pode mudar.
drop policy if exists "custodia_update" on public.custodia_peca;
create policy "custodia_update" on public.custodia_peca
  for update to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (org_id = (select public.current_org_id()));

-- Sem policy de DELETE: livro somente-inclusão não tem exclusão nem para o
-- master. A trigger recusaria, e a ausência de policy recusa antes.

drop trigger if exists trg_audit on public.custodia_peca;
create trigger trg_audit after insert or update or delete on public.custodia_peca
  for each row execute function public.registrar_auditoria();

comment on table public.custodia_peca is
  'Livro de custódia da peça, somente-inclusão. Uma linha por período de posse; fim nulo = posse aberta. Escrito só por src/lib/custodia-servidor.ts.';
