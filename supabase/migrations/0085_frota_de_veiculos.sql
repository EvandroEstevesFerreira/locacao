-- ============================================================================
-- A terceira frota: veículos
-- ============================================================================
--
-- A tela se chama FROTA e não tinha um único carro dentro. Em português frota é
-- a palavra para conjunto de veículos — o nome prometia o que a tela não
-- entregava.
--
-- São ~20 carros mais caminhão e caminhonete, próprios E locados. Isso pesa
-- quase tanto quanto as 128 peças de TI, e faz perguntas diferentes das outras
-- duas frotas:
--
--   TI        → com QUEM está, e o termo assinado
--   Obra      → em qual OBRA, inspeção e revisão por hora
--   Veículos  → quem DIRIGE, licenciamento, seguro, e revisão por km
--
-- O QUE JÁ SERVIA, e por isso não está aqui: a placa é o `identificador`, o
-- chassi é o `numero_serie`, o ano é o `ano`, quem dirige é `custodia_peca`
-- (o mesmo modelo do notebook, com termo), e CRLV e seguro são
-- `certificado_equipamento` — a estrutura que nasceu hoje de manhã para PTA
-- serve o carro inteiro sem uma linha nova.
--
-- O QUE FICOU DE FORA DESTA MIGRATION, de propósito: a revisão por
-- QUILOMETRAGEM. `tipo_equipamento.intervalo_manutencao_h` é `h` no nome e na
-- conta, e `equipamento_unidade.tem_horimetro` também. Os dois nomes aparecem em
-- 11 arquivos que a produção no ar lê agora — renomear junto derrubaria a tela
-- de Configurações até o deploy seguinte. Vai em fatia própria, por expansão.
--
-- Consequência assumida: os tipos de veículo nascem SEM intervalo de
-- manutenção. Melhor nascer sem do que nascer com 10.000 gravado numa coluna
-- que diz horas.

-- ---------------------------------------------------------------------------
-- 1. O perfil de veículo
-- ---------------------------------------------------------------------------
-- `perfil_campos` decide quais campos NATIVOS a tela mostra para a peça. Existe
-- desde a 0059 com 'geral' e 'ti'; o veículo é o terceiro caso, e é ele que faz
-- a tela saber que ali se mostra placa e condutor, e não memória RAM nem obra.
-- O check se chama `categoria_perfil_check` desde a 0059 — e não o nome longo
-- que o Postgres geraria. Um `drop constraint if exists` com o nome errado não
-- reclama: ele não acha nada, segue em frente, e o check antigo continua
-- barrando a linha nova. Foi o que aconteceu na primeira tentativa desta
-- migration.
alter table public.categoria_equipamento
  drop constraint if exists categoria_perfil_check;
alter table public.categoria_equipamento
  drop constraint if exists categoria_equipamento_perfil_campos_check;

alter table public.categoria_equipamento
  add constraint categoria_perfil_check
  check (perfil_campos in ('geral', 'ti', 'veiculo'));

-- ---------------------------------------------------------------------------
-- 2. CRLV e seguro entram no vocabulário de certificado
-- ---------------------------------------------------------------------------
-- Sem estas duas, o licenciamento anual e a apólice cairiam em "Outro" — e um
-- balde chamado "Outro" com metade da frota dentro não dá para filtrar nem
-- alertar por espécie.
--
-- `licenciamento` e não `crlv`: o documento mudou de nome duas vezes (CRV, CRLV,
-- CRLV-e) e vai mudar de novo. A obrigação é licenciar; o papel é detalhe.
alter table public.certificado_equipamento
  drop constraint if exists certificado_equipamento_especie_check;

alter table public.certificado_equipamento
  add constraint certificado_equipamento_especie_check
  check (especie in (
    'inspecao_periodica',
    'pmoc',
    'teste_carga',
    'calibracao',
    'art',
    'laudo_eletrico',
    'licenciamento',   -- CRLV anual
    'seguro',          -- apólice
    'outro'));

-- ---------------------------------------------------------------------------
-- 3. A categoria e os três tipos
-- ---------------------------------------------------------------------------
do $$
declare
  v_org      uuid;
  v_cat      uuid;
  v_leves    jsonb;
  v_pesado   jsonb;
  v_exige    jsonb;
  v_ficha    int;
begin
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organizacao cadastrada.';
  end if;

  -- `ordem` 75: entre Medição e ensaio (70) e TI (80). Veículo não é
  -- equipamento de canteiro nem de escritório — fica entre os dois, e TI segue
  -- por último.
  insert into public.categoria_equipamento (org_id, nome, ordem, ativo, perfil_campos)
  values (v_org, 'Veículos', 75, true, 'veiculo')
  on conflict (org_id, nome) do update
    set ativo = true,
        perfil_campos = 'veiculo';

  select id into v_cat from public.categoria_equipamento
   where org_id = v_org and nome = 'Veículos';

  -- Mesma trava das outras: redefinir campos de tipo que já tem peça com ficha
  -- preenchida apagaria valores em silêncio.
  select count(*) into v_ficha
  from public.equipamento_unidade u
  join public.item_catalogo i     on i.id = u.item_id
  join public.tipo_equipamento t  on t.id = i.tipo_id
  where t.categoria_id = v_cat and u.ficha <> '{}'::jsonb;

  if v_ficha > 0 then
    raise exception
      'Ha % veiculo(s) com ficha preenchida. Redefinir os campos apagaria valores em silencio.',
      v_ficha;
  end if;

  -- A FICHA DOS LEVES.
  --
  -- Placa não entra: é o `identificador` da peça, e repeti-la aqui criaria dois
  -- lugares para digitar a mesma coisa. Chassi não entra: é o `numero_serie`.
  -- Ano não entra: é coluna nativa. Mesma regra da 0075 e da 0080.
  v_leves := jsonb_build_array(
    jsonb_build_object(
      'chave', 'renavam', 'rotulo', 'Renavam',
      'tipo', 'texto', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false),
    jsonb_build_object(
      'chave', 'combustivel', 'rotulo', 'Combustível',
      'tipo', 'lista', 'unidade', null,
      'opcoes', jsonb_build_array('Flex', 'Gasolina', 'Etanol', 'Diesel', 'Híbrido', 'Elétrico'),
      'obrigatorio', false),
    jsonb_build_object(
      'chave', 'cambio', 'rotulo', 'Câmbio',
      'tipo', 'lista', 'unidade', null,
      'opcoes', jsonb_build_array('Manual', 'Automático', 'Automatizado', 'CVT'),
      'obrigatorio', false),
    jsonb_build_object(
      'chave', 'cor', 'rotulo', 'Cor',
      'tipo', 'texto', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false)
  );

  -- O CAMINHÃO carrega dois campos a mais, e não uma ficha própria: capacidade
  -- e eixos são o que muda a operação — que ponte aguenta, que pátio recebe.
  -- Pô-los na ficha dos leves deixaria dois campos vazios em vinte carros.
  v_pesado := v_leves || jsonb_build_array(
    jsonb_build_object(
      'chave', 'capacidade', 'rotulo', 'Capacidade de carga',
      'tipo', 'numero', 'unidade', 't', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
    jsonb_build_object(
      'chave', 'eixos', 'rotulo', 'Eixos',
      'tipo', 'numero', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false)
  );

  -- Licenciamento e seguro, os dois anuais. São as duas obrigações que param o
  -- carro na blitz — e, ao contrário da inspeção de PTA, todo veículo tem as
  -- duas, sem exceção.
  v_exige := jsonb_build_array(
    jsonb_build_object('especie', 'licenciamento', 'periodicidade_meses', 12),
    jsonb_build_object('especie', 'seguro',        'periodicidade_meses', 12)
  );

  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h,
     campos_ficha, certificados_exigidos, ativo)
  values
    (v_org, v_cat, 'CARRO',        'equipamento', null, v_leves,  v_exige, true),
    (v_org, v_cat, 'CAMINHONETE',  'equipamento', null, v_leves,  v_exige, true),
    (v_org, v_cat, 'CAMINHÃO',     'equipamento', null, v_pesado, v_exige, true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao       = excluded.natureza_padrao,
        campos_ficha          = excluded.campos_ficha,
        certificados_exigidos = excluded.certificados_exigidos,
        ativo                 = true;
end $$;

notify pgrst, 'reload schema';
