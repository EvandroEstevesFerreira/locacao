-- ============================================================================
-- Loca — Seed de dados para TESTES práticos
-- ----------------------------------------------------------------------------
-- Popula a organização Sistenge (já existente) com um cenário realista:
--   3 obras, 4 fornecedores, catálogo de itens (equip./retornável/consumível),
--   4 contratos (mensal/semanal), devolução PARCIAL com histórico, e financeiro
--   com parcelas pagas, a vencer (alerta) e VENCIDAS.
--
-- É RE-EXECUTÁVEL: apaga o seed anterior (marcadores OBR-00x / CT-2026-xxx /
-- nomes conhecidos) antes de recriar. Roda inteiro em uma transação (do $$).
-- NÃO cria vistorias/fotos — esse fluxo é testado pela UI (Storage).
--
-- Uso:  DATABASE_URL="postgres://..." node scripts/db/apply.mjs supabase/seed_teste.sql
-- Datas ancoradas em 2026-07-23 (hoje).
-- ============================================================================

do $$
declare
  v_org        uuid;
  v_admin      uuid;
  -- obras
  o_aurora     uuid;
  o_bosque     uuid;
  o_galpao     uuid;
  -- fornecedores
  f_alfa       uuid;
  f_betao      uuid;
  f_delta      uuid;
  f_epsilon    uuid;
  -- itens de catálogo
  i_betoneira  uuid;
  i_compactad  uuid;
  i_gerador    uuid;
  i_escora     uuid;
  i_andaime    uuid;
  i_pta        uuid;
  i_disco      uuid;
  i_lixa       uuid;
  -- contratos
  c1           uuid;   -- CT-2026-001  Aurora / Alfa   (mensal, ativo)
  c2           uuid;   -- CT-2026-002  Bosque / Betão  (semanal, ativo)
  c3           uuid;   -- CT-2026-003  Aurora / Delta  (mensal, vence em 2 dias)
  c4           uuid;   -- CT-2026-004  Galpão / Delta  (mensal, encerrado)
  -- itens locados que precisam de movimentação
  il_pta       uuid;
  il_compact   uuid;
begin
  -- --------------------------------------------------------------------------
  -- 0) Localizar a organização e o admin
  -- --------------------------------------------------------------------------
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organização encontrada. Cadastre o admin/organização antes de rodar o seed.';
  end if;

  select id into v_admin from public.perfil
   where org_id = v_org and papel = 'admin'
   order by created_at limit 1;

  -- --------------------------------------------------------------------------
  -- 1) LIMPEZA do seed anterior (ordem respeita as FKs restrict)
  -- --------------------------------------------------------------------------
  delete from public.lancamento_financeiro
   where org_id = v_org and descricao like '[SEED]%';

  delete from public.contrato_locacao
   where org_id = v_org and numero like 'CT-2026-%';        -- cascata: item_locado, movimentacao

  delete from public.equipamento_unidade
   where org_id = v_org and identificador like 'PAT-%';

  delete from public.item_catalogo
   where org_id = v_org and descricao in (
     'Betoneira 400L', 'Compactador de solo', 'Gerador a diesel 15 kVA',
     'Escora metálica 3 m', 'Andaime tubular (módulo)', 'Painel/forma PTA',
     'Disco de corte 12"', 'Lixa d''água grão 220'
   );

  delete from public.fornecedor
   where org_id = v_org and nome in (
     'Locadora Alfa Equipamentos', 'Betão Andaimes e Escoras',
     'Máquinas Delta Ltda', 'Consumíveis Épsilon'
   );

  delete from public.obra_usuario
   where obra_id in (select id from public.obra where org_id = v_org and codigo like 'OBR-00%');

  delete from public.obra
   where org_id = v_org and codigo like 'OBR-00%';

  -- --------------------------------------------------------------------------
  -- 2) OBRAS
  -- --------------------------------------------------------------------------
  insert into public.obra (org_id, codigo, nome, endereco, responsavel, centro_custo, status)
  values (v_org, 'OBR-001', 'Edifício Aurora',
          'Av. Paulista, 1500 — São Paulo/SP', 'Carlos Mendes', 'CC-3001', 'ativa')
  returning id into o_aurora;

  insert into public.obra (org_id, codigo, nome, endereco, responsavel, centro_custo, status)
  values (v_org, 'OBR-002', 'Residencial Bosque Verde',
          'Rua das Acácias, 240 — Campinas/SP', 'Fernanda Lima', 'CC-3002', 'ativa')
  returning id into o_bosque;

  insert into public.obra (org_id, codigo, nome, endereco, responsavel, centro_custo, status)
  values (v_org, 'OBR-003', 'Galpão Logístico Norte',
          'Rod. Presidente Dutra, km 220 — Guarulhos/SP', 'Roberto Alves', 'CC-3003', 'pausada')
  returning id into o_galpao;

  -- Vincula o admin às obras (opcional; admin já enxerga tudo)
  if v_admin is not null then
    insert into public.obra_usuario (obra_id, perfil_id) values
      (o_aurora, v_admin), (o_bosque, v_admin), (o_galpao, v_admin)
    on conflict do nothing;
  end if;

  -- --------------------------------------------------------------------------
  -- 3) FORNECEDORES
  -- --------------------------------------------------------------------------
  insert into public.fornecedor (org_id, nome, cnpj, contato_nome, contato_telefone, contato_email, observacoes)
  values (v_org, 'Locadora Alfa Equipamentos', '12345678000190',
          'Paulo Souza', '(11) 4002-8922', 'contato@alfaloc.com.br',
          'Locação de betoneiras, escoras e formas.')
  returning id into f_alfa;

  insert into public.fornecedor (org_id, nome, cnpj, contato_nome, contato_telefone, contato_email, observacoes)
  values (v_org, 'Betão Andaimes e Escoras', '98765432000155',
          'Marina Costa', '(19) 3232-1010', 'vendas@betaoandaimes.com.br',
          'Andaimes tubulares e escoras — cobrança semanal.')
  returning id into f_betao;

  insert into public.fornecedor (org_id, nome, cnpj, contato_nome, contato_telefone, contato_email, observacoes)
  values (v_org, 'Máquinas Delta Ltda', '45678912000133',
          'Jorge Nunes', '(11) 2555-7788', 'locacao@maquinasdelta.com.br',
          'Geradores, compactadores e maquinário pesado.')
  returning id into f_delta;

  insert into public.fornecedor (org_id, nome, cnpj, contato_nome, contato_telefone, contato_email, observacoes)
  values (v_org, 'Consumíveis Épsilon', '32165498000177',
          'Ana Reis', '(11) 3011-4545', 'pedidos@epsilonsupri.com.br',
          'Discos, lixas e material de consumo.')
  returning id into f_epsilon;

  -- --------------------------------------------------------------------------
  -- 4) CATÁLOGO DE ITENS
  -- --------------------------------------------------------------------------
  -- Equipamentos (controle por unidade)
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'equipamento', 'Betoneira 400L', 'un') returning id into i_betoneira;
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'equipamento', 'Compactador de solo', 'un') returning id into i_compactad;
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'equipamento', 'Gerador a diesel 15 kVA', 'un') returning id into i_gerador;

  -- Materiais retornáveis (controle por quantidade/saldo)
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'material_retornavel', 'Escora metálica 3 m', 'un') returning id into i_escora;
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'material_retornavel', 'Andaime tubular (módulo)', 'un') returning id into i_andaime;
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'material_retornavel', 'Painel/forma PTA', 'un') returning id into i_pta;

  -- Consumíveis (não retornam)
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'consumivel', 'Disco de corte 12"', 'un') returning id into i_disco;
  insert into public.item_catalogo (org_id, tipo, descricao, unidade)
    values (v_org, 'consumivel', 'Lixa d''água grão 220', 'un') returning id into i_lixa;

  -- Unidades físicas dos equipamentos (patrimônio)
  insert into public.equipamento_unidade (org_id, item_id, identificador, observacoes) values
    (v_org, i_betoneira, 'PAT-BET-001', 'Betoneira 400L — motor elétrico'),
    (v_org, i_compactad, 'PAT-CMP-001', 'Compactador tipo sapo'),
    (v_org, i_gerador,   'PAT-GER-001', 'Gerador 15 kVA — cabine silenciada');

  -- --------------------------------------------------------------------------
  -- 5) CONTRATOS + ITENS LOCADOS
  -- --------------------------------------------------------------------------

  -- CT-2026-001 — Aurora / Alfa — MENSAL — ativo
  insert into public.contrato_locacao (org_id, obra_id, fornecedor_id, numero, cadencia, data_inicio, data_fim_prevista, status, observacoes)
  values (v_org, o_aurora, f_alfa, 'CT-2026-001', 'mensal', date '2026-06-01', date '2026-09-30', 'ativo',
          'Estrutura e concretagem — fase de fundação.')
  returning id into c1;

  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status)
    values (v_org, c1, i_betoneira, 1,  450.00, date '2026-06-01', date '2026-09-30', 'em_aberto');
  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status)
    values (v_org, c1, i_escora,   50,    8.00, date '2026-06-01', date '2026-09-30', 'em_aberto');
  -- PTA: 10 un., com devolução PARCIAL de 3 (saldo 7, ainda em aberto)
  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status, observacoes)
    values (v_org, c1, i_pta, 10, 25.00, date '2026-06-01', date '2026-09-30', 'em_aberto',
            'Painéis de forma — devolução gradual conforme desforma.')
  returning id into il_pta;

  insert into public.movimentacao (org_id, item_locado_id, tipo, quantidade, data, observacoes)
    values (v_org, il_pta, 'devolucao', 3, date '2026-07-15', 'Devolução parcial — 3 painéis desformados.');

  -- CT-2026-002 — Bosque Verde / Betão — SEMANAL — ativo
  insert into public.contrato_locacao (org_id, obra_id, fornecedor_id, numero, cadencia, data_inicio, data_fim_prevista, status, observacoes)
  values (v_org, o_bosque, f_betao, 'CT-2026-002', 'semanal', date '2026-07-10', date '2026-08-21', 'ativo',
          'Andaimes para alvenaria e reboco externo.')
  returning id into c2;

  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status)
    values (v_org, c2, i_andaime, 30, 12.00, date '2026-07-10', date '2026-08-21', 'em_aberto');
  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status)
    values (v_org, c2, i_escora,  40,  2.50, date '2026-07-10', date '2026-08-21', 'em_aberto');

  -- CT-2026-003 — Aurora / Delta — MENSAL — vence em 2 dias (alerta!)
  insert into public.contrato_locacao (org_id, obra_id, fornecedor_id, numero, cadencia, data_inicio, data_fim_prevista, status, observacoes)
  values (v_org, o_aurora, f_delta, 'CT-2026-003', 'mensal', date '2026-05-15', date '2026-07-25', 'ativo',
          'Gerador de apoio — vencimento próximo, avaliar renovação.')
  returning id into c3;

  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, status)
    values (v_org, c3, i_gerador, 1, 1200.00, date '2026-05-15', date '2026-07-25', 'em_aberto');

  -- CT-2026-004 — Galpão Norte / Delta — MENSAL — ENCERRADO (compactador devolvido)
  insert into public.contrato_locacao (org_id, obra_id, fornecedor_id, numero, cadencia, data_inicio, data_fim_prevista, status, observacoes)
  values (v_org, o_galpao, f_delta, 'CT-2026-004', 'mensal', date '2026-03-01', date '2026-06-30', 'encerrado',
          'Compactação de piso — contrato encerrado.')
  returning id into c4;

  insert into public.item_locado (org_id, contrato_id, item_id, quantidade, valor_unitario_periodo, data_retirada, data_devolucao_prevista, data_devolucao, status)
    values (v_org, c4, i_compactad, 1, 800.00, date '2026-03-01', date '2026-06-30', date '2026-06-28', 'devolvido')
  returning id into il_compact;

  insert into public.movimentacao (org_id, item_locado_id, tipo, quantidade, data, observacoes)
    values (v_org, il_compact, 'devolucao', 1, date '2026-06-28', 'Devolução total no encerramento do contrato.');

  -- --------------------------------------------------------------------------
  -- 6) FINANCEIRO (contas a pagar)  — [SEED] marca as parcelas do seed
  -- --------------------------------------------------------------------------
  -- CT-2026-001 (Aurora): jun pago, jul a vencer (alerta), ago a vencer
  insert into public.lancamento_financeiro (org_id, obra_id, contrato_id, descricao, competencia, valor, vencimento, status, data_pagamento) values
    (v_org, o_aurora, c1, '[SEED] CT-2026-001 — competência 06/2026', date '2026-06-01', 1100.00, date '2026-06-05', 'pago', date '2026-06-05'),
    (v_org, o_aurora, c1, '[SEED] CT-2026-001 — competência 07/2026', date '2026-07-01', 1100.00, date '2026-07-25', 'pendente', null),
    (v_org, o_aurora, c1, '[SEED] CT-2026-001 — competência 08/2026', date '2026-08-01', 1025.00, date '2026-08-25', 'pendente', null);

  -- CT-2026-002 (Bosque): uma VENCIDA e uma a vencer amanhã
  insert into public.lancamento_financeiro (org_id, obra_id, contrato_id, descricao, competencia, valor, vencimento, status, data_pagamento) values
    (v_org, o_bosque, c2, '[SEED] CT-2026-002 — semana 10–16/07', date '2026-07-01', 460.00, date '2026-07-17', 'pendente', null),
    (v_org, o_bosque, c2, '[SEED] CT-2026-002 — semana 17–23/07', date '2026-07-01', 460.00, date '2026-07-24', 'pendente', null);

  -- CT-2026-003 (Aurora/Gerador): mai/jun pagos, jul a vencer (alerta)
  insert into public.lancamento_financeiro (org_id, obra_id, contrato_id, descricao, competencia, valor, vencimento, status, data_pagamento) values
    (v_org, o_aurora, c3, '[SEED] CT-2026-003 — competência 06/2026', date '2026-06-01', 1200.00, date '2026-06-10', 'pago', date '2026-06-10'),
    (v_org, o_aurora, c3, '[SEED] CT-2026-003 — competência 07/2026', date '2026-07-01', 1200.00, date '2026-07-25', 'pendente', null);

  -- CT-2026-004 (Galpão, encerrado): tudo pago
  insert into public.lancamento_financeiro (org_id, obra_id, contrato_id, descricao, competencia, valor, vencimento, status, data_pagamento) values
    (v_org, o_galpao, c4, '[SEED] CT-2026-004 — competência 04/2026', date '2026-04-01', 800.00, date '2026-04-05', 'pago', date '2026-04-05'),
    (v_org, o_galpao, c4, '[SEED] CT-2026-004 — competência 05/2026', date '2026-05-01', 800.00, date '2026-05-05', 'pago', date '2026-05-05'),
    (v_org, o_galpao, c4, '[SEED] CT-2026-004 — competência 06/2026', date '2026-06-01', 800.00, date '2026-06-05', 'pago', date '2026-06-05');

  raise notice 'Seed aplicado com sucesso na organização %.', v_org;
end $$;
