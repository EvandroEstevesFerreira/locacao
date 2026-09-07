-- ============================================================================
-- Certificados do equipamento — o vencimento que é data, e não horímetro
-- (docs/superpowers/specs/2026-09-06-certificados-equipamento-design.md)
-- ============================================================================
--
-- O Loca já avisa revisão POR USO: `intervalo_manutencao_h` no tipo,
-- `apontamento_uso` com a leitura do horímetro, `estadoRevisao` pintando a
-- tela. A metade que custa multa não é essa. Inspeção de PTA, PMOC de
-- ar-condicionado, teste de carga de talha e calibração de instrumento vencem
-- por CALENDÁRIO — 12 meses depois da última, tenha a máquina trabalhado
-- 2.000 horas ou ficado parada no pátio.
--
-- O DESENHO, em uma linha: o TIPO declara o que exige, a PEÇA acumula os
-- certificados, e a view cruza os dois.

-- ---------------------------------------------------------------------------
-- 1. O tipo declara o que exige
-- ---------------------------------------------------------------------------
-- É jsonb pelo mesmo motivo que `campos_ficha` é: uma declaração presa ao tipo,
-- editada na mesma tela do tipo, nunca consultada sozinha. Uma tabela
-- acrescentaria um join a toda leitura do catálogo em troca de nada.
--
-- POR QUE DECLARAR, e não apenas registrar o certificado que existe: sem a
-- declaração, o sistema não distingue "equipamento que não exige inspeção" de
-- "equipamento cuja inspeção ninguém lançou". O segundo é o que gera
-- interdição, e ficaria em silêncio.
--
-- Cada item: { "especie": "pmoc", "periodicidade_meses": 12 }.
alter table public.tipo_equipamento
  add column if not exists certificados_exigidos jsonb not null default '[]'::jsonb;

comment on column public.tipo_equipamento.certificados_exigidos is
  'Exigências legais das peças deste tipo: [{especie, periodicidade_meses}]. A periodicidade PROPOE o vencimento ao lancar; quem manda e a validade impressa no laudo.';

-- ---------------------------------------------------------------------------
-- 2. A peça acumula os certificados
-- ---------------------------------------------------------------------------
create table if not exists public.certificado_equipamento (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao(id) on delete cascade,

  -- O certificado é da PEÇA, não do modelo: duas PTAs iguais têm inspeções em
  -- datas diferentes, feitas por empresas diferentes.
  unidade_id    uuid not null references public.equipamento_unidade(id) on delete cascade,

  -- Vocabulário FECHADO. Campo livre aqui produz 'PMOC', 'P.M.O.C.' e 'Pmoc' na
  -- mesma coluna, e aí o cruzamento com a exigência do tipo não fecha — em
  -- silêncio, que é o pior jeito de não fechar.
  especie       text not null check (especie in (
                  'inspecao_periodica',  -- NR-12 / NR-18
                  'pmoc',                -- Lei 13.589/2018
                  'teste_carga',         -- NR-11 / NR-12
                  'calibracao',
                  'art',
                  'laudo_eletrico',
                  'outro')),

  -- Nulável: laudo antigo às vezes chega só com a validade legível.
  emitido_em    date,

  -- NOT NULL, e é a coluna que o alerta lê. Certificado sem validade não vence
  -- nunca, e "não vence nunca" é sempre erro de digitação, jamais um fato.
  vence_em      date not null,

  numero        text,        -- número da ART, do laudo, do certificado
  responsavel   text,        -- quem emitiu: empresa ou profissional com CREA
  arquivo_path  text,        -- o PDF no bucket. Nulo: a data vale sem o arquivo
  observacoes   text,

  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Vencer antes de ser emitido é digitação trocada, e passaria despercebido
  -- para sempre — o alerta simplesmente nunca dispararia.
  constraint certificado_vence_depois_de_emitido
    check (emitido_em is null or vence_em >= emitido_em)
);

-- SEM unicidade por (unidade_id, especie): o acúmulo É o recurso. Cada
-- renovação é uma linha nova, e a anterior fica como prova de que existiu — que
-- é exatamente o que a fiscalização pede.
--
-- Este índice é a consulta "qual o certificado atual desta peça", palavra por
-- palavra.
create index if not exists idx_certificado_atual
  on public.certificado_equipamento (org_id, unidade_id, especie, vence_em desc)
  where deleted_at is null;

create index if not exists idx_certificado_vencimento
  on public.certificado_equipamento (org_id, vence_em)
  where deleted_at is null;

drop trigger if exists trg_certificado_updated_at on public.certificado_equipamento;
create trigger trg_certificado_updated_at
  before update on public.certificado_equipamento
  for each row execute function public.set_updated_at();

drop trigger if exists trg_audit on public.certificado_equipamento;
create trigger trg_audit after insert or update or delete on public.certificado_equipamento
  for each row execute function public.registrar_auditoria();

-- ---------------------------------------------------------------------------
-- 3. RLS
-- ---------------------------------------------------------------------------
-- O recorte é o da ORGANIZAÇÃO, não o da obra — igual a `reparo_equipamento`.
-- `equipamento_unidade` é da organização inteira (a peça circula entre obras), e
-- um recorte por obra esconderia da obra B que a PTA que ela recebe na semana
-- que vem está com a inspeção vencida.
alter table public.certificado_equipamento enable row level security;

drop policy if exists "certificado_equipamento_select" on public.certificado_equipamento;
drop policy if exists "certificado_equipamento_write"  on public.certificado_equipamento;

create policy "certificado_equipamento_select" on public.certificado_equipamento
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and deleted_at is null
  );

create policy "certificado_equipamento_write" on public.certificado_equipamento
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- ---------------------------------------------------------------------------
-- 4. A view que enxerga a AUSÊNCIA
-- ---------------------------------------------------------------------------
-- O coração da fatia. Cruza o que o TIPO exige com o que a PEÇA tem, e por isso
-- `vence_em is null` É a pendência de ausência.
--
-- Sem o `cross join lateral` sobre a declaração do tipo, uma peça sem
-- certificado nenhum não apareceria em consulta alguma — o caso perigoso seria
-- o único invisível.
--
-- `security_invoker = on` NÃO É OPCIONAL. No Postgres 15+ o padrão é `off`: a
-- view roda com os privilégios do DONO, ignora RLS e devolve as linhas de TODAS
-- as organizações a qualquer autenticado. Foi o incidente da 0.49.1
-- (migration 0058).
drop view if exists public.certificado_pendencia;
create view public.certificado_pendencia
with (security_invoker = on) as
select
  u.org_id,
  u.id                                     as unidade_id,
  u.identificador,
  u.obra_id,
  i.descricao                              as modelo,
  t.nome                                   as tipo,
  e->>'especie'                            as especie,
  nullif(e->>'periodicidade_meses', '')::int as periodicidade_meses,
  c.id                                     as certificado_id,
  c.vence_em
from public.equipamento_unidade u
join public.item_catalogo i     on i.id = u.item_id
join public.tipo_equipamento t  on t.id = i.tipo_id
cross join lateral jsonb_array_elements(
  coalesce(t.certificados_exigidos, '[]'::jsonb)) e
left join lateral (
  select c2.id, c2.vence_em
  from public.certificado_equipamento c2
  where c2.unidade_id = u.id
    and c2.especie = e->>'especie'
    and c2.deleted_at is null
  order by c2.vence_em desc
  limit 1
) c on true
where u.ativo;

comment on view public.certificado_pendencia is
  'Cruza a exigencia do tipo com o certificado atual da peca. vence_em nulo = exigencia que nunca foi cumprida.';

-- ---------------------------------------------------------------------------
-- 5. O bucket
-- ---------------------------------------------------------------------------
-- Bucket próprio, e não o `contratos`: um laudo não é contrato, e as rotinas de
-- exclusão de contrato removem objetos POR CAMINHO — misturar os dois cria o
-- dia em que excluir um contrato apaga o laudo de uma PTA.
insert into storage.buckets (id, name, public)
values ('certificados', 'certificados', false)
on conflict (id) do nothing;

drop policy if exists "certificados_obj_select" on storage.objects;
drop policy if exists "certificados_obj_insert" on storage.objects;
drop policy if exists "certificados_obj_update" on storage.objects;
drop policy if exists "certificados_obj_delete" on storage.objects;

create policy "certificados_obj_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "certificados_obj_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "certificados_obj_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "certificados_obj_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'certificados'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- ---------------------------------------------------------------------------
-- 6. `soft_delete` ganha o ramo do certificado
-- ---------------------------------------------------------------------------
-- A função é um `case` inteiro: não dá para acrescentar um ramo isoladamente,
-- ela é recriada por completo. Os ramos anteriores estão reproduzidos palavra
-- por palavra a partir da definição em produção.
--
-- `pode_operar()` e não `is_master()`: quem lança o certificado errado é quem
-- precisa poder apagá-lo, e o histórico fica no `audit_log` de qualquer forma.
create or replace function public.soft_delete(p_entidade text, p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org    uuid := public.current_org_id();
  v_admin  boolean := public.pode_gerir_cadastros();
  v_linhas int;
begin
  if v_org is null or p_id is null then
    raise exception 'Sessão inválida.' using errcode = '42501';
  end if;

  case p_entidade
    when 'imovel' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir imóveis.' using errcode = '42501';
      end if;
      update public.imovel set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null
          and (v_admin or public.is_member_of_obra(obra_id));

    when 'obra' then
      if not v_admin then
        raise exception 'Sem permissão para excluir obras.' using errcode = '42501';
      end if;
      update public.obra set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'contrato_locacao' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir contratos.' using errcode = '42501';
      end if;
      update public.contrato_locacao set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'lancamento_financeiro' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir lançamentos.' using errcode = '42501';
      end if;
      update public.lancamento_financeiro set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'medida_disciplinar' then
      if not public.is_master() then
        raise exception 'Sem permissão para excluir medidas disciplinares.' using errcode = '42501';
      end if;
      update public.medida_disciplinar set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'entrega_ocupante' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir entregas.' using errcode = '42501';
      end if;
      update public.entrega_ocupante set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    -- Catálogo de tarefas: cadastro, vale para toda a organização.
    when 'tarefa_limpeza' then
      if not v_admin then
        raise exception 'Sem permissão para excluir tarefas de limpeza.' using errcode = '42501';
      end if;
      update public.tarefa_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'checklist_limpeza' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir checklists.' using errcode = '42501';
      end if;
      update public.checklist_limpeza set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    when 'certificado_equipamento' then
      if not public.pode_operar() then
        raise exception 'Sem permissão para excluir certificados.' using errcode = '42501';
      end if;
      update public.certificado_equipamento set deleted_at = now()
        where id = p_id and org_id = v_org and deleted_at is null;

    else
      raise exception 'Entidade inválida: %', p_entidade using errcode = '22023';
  end case;

  get diagnostics v_linhas = row_count;
  return v_linhas > 0;
end;
$function$;

-- `anon` nunca chama soft_delete. A 0042 revogou; recriar a função devolve o
-- EXECUTE do `public`, então revoga de novo.
revoke all on function public.soft_delete(text, uuid) from public, anon;
grant execute on function public.soft_delete(text, uuid) to authenticated;

notify pgrst, 'reload schema';
