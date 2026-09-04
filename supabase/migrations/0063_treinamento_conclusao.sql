-- ============================================================================
-- Registro de conclusão de treinamento
-- (docs/superpowers/specs/2026-09-03-treinamento-design.md)
--
-- O pedido era "manual, treinamento, e todos devem fazer o treinamento". As
-- duas primeiras partes são documentos; a terceira é um CONTROLE, e é a que
-- não se resolve com documento nenhum: sem registro de quem concluiu, "todos
-- foram treinados" é suposição.
--
-- Esta tabela é o registro, e só isso. As trilhas e as aulas moram no código
-- (`src/lib/treinamento/`), versionadas com ele.
-- ============================================================================

create table if not exists public.treinamento_conclusao (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.organizacao (id) on delete cascade,
  perfil_id        uuid not null references public.perfil (id) on delete cascade,
  trilha           text not null,
  -- Versão do CONTEÚDO concluída. A conclusão vale para esta versão e não para
  -- a seguinte: quando a trilha muda, quem concluiu a anterior volta a
  -- aparecer como pendente, e refaz só as aulas que mudaram.
  versao           smallint not null,
  concluido_em     timestamptz not null default now(),
  acertos          smallint not null,
  total_perguntas  smallint not null,
  -- PNG em data URI, do SignaturePad. Nulo enquanto o comprovante não é
  -- assinado — concluir e assinar são dois momentos.
  assinatura       text,
  assinado_ip      text,
  numero_registro  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  -- Uma linha por versão concluída. Refazer a MESMA versão atualiza a linha;
  -- dois cliques no botão não geram dois comprovantes. E o histórico fica:
  -- quem concluiu a v1 e depois a v2 tem duas linhas, e o comprovante de cada
  -- uma continua válido para a versão que ele atesta.
  unique (perfil_id, trilha, versao)
);

create index if not exists idx_treinamento_org on public.treinamento_conclusao (org_id);
create index if not exists idx_treinamento_perfil on public.treinamento_conclusao (perfil_id);

alter table public.treinamento_conclusao drop constraint if exists treinamento_versao_check;
alter table public.treinamento_conclusao add constraint treinamento_versao_check
  check (versao >= 1);

-- Acertou tudo, ou não concluiu. É a regra de aprovação no banco, e não só na
-- tela: um registro com 3 de 4 diria "treinado" sobre alguém que errou
-- justamente a pergunta que precisava.
alter table public.treinamento_conclusao drop constraint if exists treinamento_acertos_check;
alter table public.treinamento_conclusao add constraint treinamento_acertos_check
  check (total_perguntas > 0 and acertos = total_perguntas);

drop trigger if exists trg_treinamento_updated_at on public.treinamento_conclusao;
create trigger trg_treinamento_updated_at
  before update on public.treinamento_conclusao
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- `perfil.id` É o id de `auth.users` (o trigger `handle_new_user` grava
-- `new.id`), então a policy compara com `auth.uid()` direto.
alter table public.treinamento_conclusao enable row level security;

-- Leitura: a própria pessoa vê o seu, master e administrador veem todos da
-- organização. Gestor por obra ficou FORA de propósito — não foi pedido, e
-- acrescentar depois é uma policy, não uma migration de dados.
drop policy if exists "treinamento_select" on public.treinamento_conclusao;
create policy "treinamento_select" on public.treinamento_conclusao
  for select to authenticated
  using (
    org_id = (select public.current_org_id())
    and (
      perfil_id = (select auth.uid())
      or (select public.pode_gerir_cadastros())
    )
  );

-- Escrita: SÓ a própria pessoa, nem o master por ela. Comprovante de
-- treinamento assinado por terceiro não vale nada.
drop policy if exists "treinamento_insert" on public.treinamento_conclusao;
create policy "treinamento_insert" on public.treinamento_conclusao
  for insert to authenticated
  with check (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  );

drop policy if exists "treinamento_update" on public.treinamento_conclusao;
create policy "treinamento_update" on public.treinamento_conclusao
  for update to authenticated
  using (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  )
  with check (
    org_id = (select public.current_org_id())
    and perfil_id = (select auth.uid())
  );

-- Sem policy de DELETE: registro de treinamento não se apaga.

drop trigger if exists trg_audit on public.treinamento_conclusao;
create trigger trg_audit after insert or update or delete on public.treinamento_conclusao
  for each row execute function public.registrar_auditoria();

comment on table public.treinamento_conclusao is
  'Conclusão de trilha de treinamento, uma linha por (pessoa, trilha, versão de conteúdo). "Pendente" é calculado em src/lib/treinamento.ts, nunca armazenado.';

-- ---------------------------------------------------------------------------
-- Prefixo de registro: TRE
-- ---------------------------------------------------------------------------
-- `prefixo_registro` é redefinida por inteiro a cada tipo novo, e
-- `src/lib/registros.test.ts` varre as migrations, pega a ÚLTIMA que a define e
-- compara a lista com o mapa em TypeScript. Acrescentar só de um lado reprova
-- no CI, o que é o comportamento desejado.
create or replace function public.prefixo_registro(p_tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo
    when 'contrato_locacao'      then 'CTR'
    when 'contrato_imovel'       then 'CTI'
    when 'recebimento'           then 'REC'
    when 'movimentacao'          then 'DEV'
    when 'vistoria'              then 'VIS'
    when 'vistoria_imovel'       then 'VIM'
    when 'avaria'                then 'AVA'
    when 'reparo_imovel'         then 'REP'
    when 'medida_disciplinar'    then 'MED'
    when 'entrega_ocupante'      then 'ENT'
    when 'checklist_limpeza'     then 'LIM'
    when 'ocorrencia_imovel'     then 'OCO'
    when 'termo_equipamento'     then 'TRM'
    when 'treinamento_conclusao' then 'TRE'
    else 'REG'
  end;
$$;
