-- ============================================================================
-- Transferir a custódia de uma pessoa para outra
--
-- "Vou herdar a máquina que era do André, e a minha fica disponível." Hoje
-- isso são dois caminhos separados, em telas diferentes: caçar o termo ativo na
-- lista de Termos, registrar devolução, encerrar; depois voltar à peça e emitir
-- um termo novo. Nada na peça diz que é esse o caminho.
--
-- CONTINUAM SENDO DOIS TERMOS. A trava `custodia_funcionario_exige_termo`
-- (0059) fica exatamente como está: posse de funcionário só nasce de termo
-- assinado, e é essa trava que garante existir um papel dizendo em que estado o
-- equipamento saiu da mão de quem o tinha. O que muda é o CAMINHO, não a regra.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Devolução sem assinatura, com motivo
-- ---------------------------------------------------------------------------
-- 211 pessoas da base estão desligadas, e uma delas que saiu com um notebook
-- não vai assinar devolução nenhuma. Exigir a assinatura ali não protege o
-- patrimônio — só impede que o fato seja registrado, e o equipamento fica para
-- sempre "com" alguém que não trabalha mais aqui.
--
-- O MOTIVO É OBRIGATÓRIO QUANDO A ASSINATURA FALTA, e é o `check` abaixo que
-- garante isso — não a tela. Sem ele, o caminho sem assinatura viraria o
-- caminho mais curto, e em seis meses metade das devoluções não teria nem
-- assinatura nem explicação.
alter table public.termo_equipamento
  add column if not exists devolucao_sem_assinatura_motivo text;

alter table public.termo_equipamento
  drop constraint if exists termo_motivo_sem_assinatura_util;

alter table public.termo_equipamento
  add constraint termo_motivo_sem_assinatura_util
  check (
    devolucao_sem_assinatura_motivo is null
    or length(btrim(devolucao_sem_assinatura_motivo)) >= 10
  );

-- ---------------------------------------------------------------------------
-- 2. O lembrete de entrega pendente
-- ---------------------------------------------------------------------------
-- Entre a devolução e a entrega a peça fica DISPONÍVEL — decisão consciente, e
-- não um estado novo na matriz de transição. O preço disso é que outra pessoa
-- pode levá-la no meio do caminho.
--
-- Esta coluna não impede: ela LEMBRA. A peça mostra "entrega pendente para
-- Fulano" com o botão que retoma de onde parou. Se alguém levar antes, o
-- lembrete some — foi decisão de quem estava lá, e uma trava aqui transformaria
-- uma intenção anotada num impedimento real.
--
-- `on delete set null`: funcionário excluído não pode segurar a peça num
-- lembrete órfão.
alter table public.equipamento_unidade
  add column if not exists entrega_pendente_funcionario_id uuid
    references public.funcionario (id) on delete set null,
  add column if not exists entrega_pendente_em timestamptz;

-- Data e destinatário andam juntos: lembrete sem data não sabe dizer "desde
-- quando", e data sem destinatário não lembra de nada.
alter table public.equipamento_unidade
  drop constraint if exists unidade_entrega_pendente_completa;

alter table public.equipamento_unidade
  add constraint unidade_entrega_pendente_completa
  check (
    (entrega_pendente_funcionario_id is null and entrega_pendente_em is null)
    or (entrega_pendente_funcionario_id is not null and entrega_pendente_em is not null)
  );

-- Parcial: o normal é não haver lembrete nenhum, e a pergunta que o índice
-- serve — "o que está esperando entrega?" — é feita sobre as poucas marcadas.
create index if not exists idx_unidade_entrega_pendente
  on public.equipamento_unidade (org_id)
  where entrega_pendente_funcionario_id is not null;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
-- Aborta se a trava que obriga o termo tiver sumido. Ela é o alicerce do
-- caminho novo: sem ela, "transferir custódia" viraria um botão que grava posse
-- sem documento, e ninguém saberia em que estado a máquina trocou de mão.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'custodia_funcionario_exige_termo'
      and conrelid = 'public.custodia_peca'::regclass
  ) then
    raise exception
      'custodia_funcionario_exige_termo sumiu: posse de funcionario sem termo.';
  end if;
end $$;

notify pgrst, 'reload schema';
