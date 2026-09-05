-- ============================================================================
-- Laudo de avaria — fase 2b
-- (docs/superpowers/specs/2026-09-05-devolucao-avaria-reparo-design.md)
--
-- `avaria` existe desde a 0007 com quatro campos: descrição, custo estimado,
-- status e, desde a 0040, o lançamento financeiro. Falta o essencial para
-- emitir um LAUDO: qual peça, quando foi constatada, em qual devolução, e quem
-- responde.
--
-- Sem responsável, um laudo não é laudo — é reclamação.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Qual peça
-- ---------------------------------------------------------------------------
-- Nulo quando o item é controlado por quantidade: não há UMA escora avariada,
-- há quatro escoras de um lote. Forçar a peça nesses casos obrigaria a inventar
-- um patrimônio que não existe.
alter table public.avaria
  add column if not exists unidade_id uuid
    references public.equipamento_unidade (id) on delete set null;

create index if not exists idx_avaria_unidade
  on public.avaria (unidade_id) where unidade_id is not null;

-- ---------------------------------------------------------------------------
-- Em qual devolução
-- ---------------------------------------------------------------------------
-- Nulo quando a avaria foi constatada EM USO, e não na volta. As duas coisas
-- acontecem: a betoneira que quebra no meio da obra não espera a devolução para
-- ser avariada, e o laudo dela precisa existir antes.
alter table public.avaria
  add column if not exists devolucao_id uuid
    references public.devolucao (id) on delete set null;

create index if not exists idx_avaria_devolucao
  on public.avaria (devolucao_id) where devolucao_id is not null;

-- ---------------------------------------------------------------------------
-- Quando foi constatada
-- ---------------------------------------------------------------------------
-- Hoje só existe o `created_at` da linha, que é quando alguém DIGITOU. A data
-- da constatação é outra coisa, e é ela que vai no laudo: é sobre ela que se
-- discute se o dano é anterior ou posterior à locação.
--
-- Default `current_date` para não deixar as linhas existentes nulas — elas não
-- têm data melhor, e nulo obrigaria todo leitor a tratar o caso.
alter table public.avaria
  add column if not exists data date not null default current_date;

-- ---------------------------------------------------------------------------
-- Quem responde
-- ---------------------------------------------------------------------------
-- NASCE 'indefinida', e este é o ponto: o laudo é emitido para APURAR, não
-- depois de apurado. Um conjunto sem "indefinida" forçaria quem preenche a
-- apontar um culpado no momento da constatação — que é exatamente quando ainda
-- não se sabe. E o palpite viraria o registro oficial.
alter table public.avaria
  add column if not exists responsabilidade text not null default 'indefinida'
    check (responsabilidade in ('indefinida', 'fornecedor', 'obra', 'funcionario'));

comment on column public.avaria.responsabilidade is
  'Quem responde pelo dano. Nasce indefinida — o laudo apura, não pressupõe.';

-- ---------------------------------------------------------------------------
-- O laudo
-- ---------------------------------------------------------------------------
-- Separado de `descricao` de propósito. `descricao` é a linha curta que aparece
-- na lista da vistoria e no lançamento financeiro; o laudo é o texto corrido
-- que sustenta a cobrança — o que foi encontrado, como se concluiu, o que se
-- propõe. Fundir os dois faria a lista da vistoria mostrar três parágrafos por
-- linha, ou o laudo caber em 300 caracteres.
alter table public.avaria
  add column if not exists laudo text;

-- ---------------------------------------------------------------------------
-- Numeração
-- ---------------------------------------------------------------------------
-- `avaria` JÁ está no `prefixo_registro` como AVA desde a 0048 e JÁ tem o
-- gatilho. Nada a fazer aqui — a avaria nasce numerada, ao contrário do
-- recebimento e da devolução, e é correto: ela não tem estado de rascunho.

notify pgrst, 'reload schema';
