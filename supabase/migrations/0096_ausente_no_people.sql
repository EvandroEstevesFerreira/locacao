-- ============================================================================
-- Quando alguém DESAPARECE do People
--
-- Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
--
-- Cinco pessoas têm hoje dois cadastros no People, por um bug de import da ADP.
-- Quando forem mescladas, o `people_id` do cadastro descartado DEIXA DE
-- EXISTIR — e o próprio People avisou que as chaves envolvidas são
-- `on delete cascade` do lado deles.
--
-- Do nosso lado o estrago é silencioso e de outro tipo: a linha de
-- `funcionario` vinculada àquele id simplesmente PARA DE SER ATUALIZADA. Nada
-- quebra, nada avisa. Ela só envelhece — com o cargo de antigamente e a obra de
-- antigamente — enquanto alguém segue com o notebook.
--
-- O DELTA NÃO CONSEGUE VER ISSO. `?desde=` traz só quem mudou; ausência não é
-- mudança, e quem sumiu nunca mais aparece em resposta nenhuma. Só uma
-- varredura COMPLETA, comparando o que temos com o que veio, enxerga o buraco.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. A marca no funcionário
-- ---------------------------------------------------------------------------
-- Marca, e não exclusão. Uma pessoa pode sumir do recorte por motivo inocente
-- — o desligamento dela saiu da janela de 2026 —, e apagar o vínculo levaria
-- junto o histórico de equipamento de alguém que talvez ainda esteja com ele.
-- Quem decide é gente; a coluna só conta que aconteceu e quando.
alter table public.funcionario
  add column if not exists ausente_no_people_em timestamptz;

-- Parcial: o normal é a coluna estar nula, e o índice existe para a pergunta
-- "quem sumiu?", que é feita sobre as poucas linhas marcadas.
create index if not exists idx_funcionario_ausente
  on public.funcionario (org_id)
  where ausente_no_people_em is not null;

-- ---------------------------------------------------------------------------
-- 2. Quando foi a última varredura completa
-- ---------------------------------------------------------------------------
-- A sincronização de todo dia é delta, que é barata e não enxerga ausência. A
-- completa roda semanalmente e é a única que pode marcar alguém como sumido —
-- marcar a partir de um delta acusaria de ausente todo mundo que simplesmente
-- não mudou nada naquele dia.
alter table public.people_sync
  add column if not exists ultima_varredura_completa timestamptz;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'funcionario'
      and column_name = 'ausente_no_people_em'
  ) then
    raise exception 'A coluna ausente_no_people_em nao foi criada.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'people_sync'
      and column_name = 'ultima_varredura_completa'
  ) then
    raise exception 'A coluna ultima_varredura_completa nao foi criada.';
  end if;
end $$;

notify pgrst, 'reload schema';
