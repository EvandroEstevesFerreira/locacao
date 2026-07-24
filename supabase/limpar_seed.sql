-- ============================================================================
-- Loca — LIMPEZA dos dados de TESTE ([SEED]) antes do uso real
-- ----------------------------------------------------------------------------
-- Remove APENAS o cenário de teste, identificado pelos marcadores do seed:
--   lançamentos '[SEED]%', contratos 'CT-2026-%', unidades 'PAT-%',
--   itens/fornecedores de nomes conhecidos, obras 'OBR-00%'.
-- Dados REAIS (fora desses marcadores) NÃO são tocados.
--
-- Cascatas automáticas ao apagar os contratos 'CT-2026-%':
--   item_locado -> movimentacao ; vistoria -> vistoria_foto, avaria.
-- (lancamento_financeiro.contrato_id é ON DELETE SET NULL, por isso apagamos
--  os lançamentos de teste explicitamente pelo marcador '[SEED]'.)
--
-- OBS.: os ARQUIVOS do Storage (fotos de vistoria) são removidos à parte,
--       pela API de Storage — SQL não apaga o binário no bucket.
--
-- Rodar no SQL Editor do Supabase. Transacional: ou apaga tudo, ou nada.
-- ============================================================================

do $$
declare
  v_org uuid;
begin
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organização encontrada.';
  end if;

  -- Log de alertas de teste (todos os atuais são do cenário seed)
  delete from public.notificacao_log where org_id = v_org;

  -- Financeiro de teste
  delete from public.lancamento_financeiro
   where org_id = v_org and descricao like '[SEED]%';

  -- Contratos de teste (cascata: item_locado, movimentacao, vistoria, fotos, avarias)
  delete from public.contrato_locacao
   where org_id = v_org and numero like 'CT-2026-%';

  -- Unidades de equipamento de teste
  delete from public.equipamento_unidade
   where org_id = v_org and identificador like 'PAT-%';

  -- Itens de catálogo de teste
  delete from public.item_catalogo
   where org_id = v_org and descricao in (
     'Betoneira 400L', 'Compactador de solo', 'Gerador a diesel 15 kVA',
     'Escora metálica 3 m', 'Andaime tubular (módulo)', 'Painel/forma PTA',
     'Disco de corte 12"', 'Lixa d''água grão 220'
   );

  -- Fornecedores de teste
  delete from public.fornecedor
   where org_id = v_org and nome in (
     'Locadora Alfa Equipamentos', 'Betão Andaimes e Escoras',
     'Máquinas Delta Ltda', 'Consumíveis Épsilon'
   );

  -- Vínculos e obras de teste
  delete from public.obra_usuario
   where obra_id in (select id from public.obra where org_id = v_org and codigo like 'OBR-00%');
  delete from public.obra
   where org_id = v_org and codigo like 'OBR-00%';

  raise notice 'Dados de teste removidos da organização %.', v_org;
end $$;
