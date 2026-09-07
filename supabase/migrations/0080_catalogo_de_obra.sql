-- ============================================================================
-- O catálogo de obra: Climatização, e as cinco famílias que já são certas
-- ============================================================================
--
-- POR QUE SÓ CINCO, com sete categorias vazias esperando.
--
-- Quais famílias a Sistenge realmente aluga é o que a planilha de coleta
-- responde (retorno pedido para 25/09). Semear PTA, andaime, betoneira,
-- gerador e ar-condicionado é seguro porque foram estas cinco que o e-mail de
-- cobrança nomeou — o responsável da obra vai devolver a planilha falando
-- delas. Semear as outras trinta por adivinhação encheria o seletor de tipos
-- que ninguém escolhe, e cada um deles seria uma correção a mais depois.
--
-- O resto entra por Configurações → Catálogo, conforme o dado chegar.
--
-- O QUE **NÃO** ESTÁ NAS FICHAS, E POR QUÊ.
--
-- Ano de fabricação, número de série, patrimônio e estado têm coluna NATIVA em
-- `equipamento_unidade` (`ano`, `numero_serie`, `identificador`, `estado`), com
-- campo próprio no formulário da peça. Repeti-los na ficha criaria dois lugares
-- para digitar a mesma coisa — que é como as duas cópias divergem. É a mesma
-- regra da 0075, onde a memória RAM ficou de fora pelo mesmo motivo.
--
-- Inspeção anual, PMOC e teste de carga também NÃO entram como campo `data`.
-- Campo de ficha é inerte: ninguém lê, nada avisa, e a renovação sobrescreve a
-- anterior sem deixar histórico. Eles são certificados, e ganham estrutura
-- própria na fatia seguinte.
--
-- UMA TENSÃO ASSUMIDA. Altura de trabalho e capacidade são, a rigor,
-- propriedades do MODELO e não da peça — duas PTAs do mesmo modelo terão o
-- mesmo número digitado duas vezes. A ficha vive na peça porque é lá que o
-- sistema a coloca, e o ganho de poder perguntar "qual PTA alcança 12 m" paga
-- a redundância. Se um dia a ficha subir para o modelo, estes campos sobem
-- junto.

do $$
declare
  v_org         uuid;
  v_acesso      uuid;
  v_concreto    uuid;
  v_energia     uuid;
  v_clima       uuid;
  v_com_valor   int;
begin
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organizacao cadastrada.';
  end if;

  -- -------------------------------------------------------------------------
  -- 1. Climatização, a categoria que faltava
  -- -------------------------------------------------------------------------
  -- Ar-condicionado não cabia em nenhuma das oito: não é acesso, não é energia,
  -- não é ferramenta. Ficaria em "sem categoria", que é o balde onde o item
  -- some.
  --
  -- `ordem` 65 e não 90: TI é 80 e fica por último de propósito — é a única
  -- categoria que não é de obra. Climatização entra ao lado de Energia (60),
  -- com que divide instalação predial.
  insert into public.categoria_equipamento (org_id, nome, ordem, ativo, perfil_campos)
  values (v_org, 'Climatização', 65, true, 'geral')
  on conflict (org_id, nome) do update
    set ativo = true;

  select id into v_acesso   from public.categoria_equipamento
    where org_id = v_org and nome = 'Acesso e altura';
  select id into v_concreto from public.categoria_equipamento
    where org_id = v_org and nome = 'Concretagem';
  select id into v_energia  from public.categoria_equipamento
    where org_id = v_org and nome = 'Energia';
  select id into v_clima    from public.categoria_equipamento
    where org_id = v_org and nome = 'Climatização';

  if v_acesso is null or v_concreto is null or v_energia is null or v_clima is null then
    raise exception 'Faltou alguma categoria: acesso=% concretagem=% energia=% climatizacao=%',
      v_acesso, v_concreto, v_energia, v_clima;
  end if;

  -- -------------------------------------------------------------------------
  -- 2. A trava: redefinir campos não pode apagar valor de peça
  -- -------------------------------------------------------------------------
  -- Hoje nenhuma peça existe sob estes tipos — eles estão nascendo. A trava é
  -- para a SEGUNDA execução: se alguém rodar de novo depois que a obra
  -- preencheu 40 fichas de PTA, o `do update` do `on conflict` trocaria os
  -- campos e orfanaria os valores em silêncio.
  select count(*) into v_com_valor
  from public.equipamento_unidade u
  join public.item_catalogo i     on i.id = u.item_id
  join public.tipo_equipamento t  on t.id = i.tipo_id
  where t.org_id = v_org
    and t.categoria_id in (v_acesso, v_concreto, v_energia, v_clima)
    and u.ficha <> '{}'::jsonb;

  if v_com_valor > 0 then
    raise exception
      'Ha % peca(s) de obra com ficha preenchida. Redefinir os campos do tipo apagaria valores em silencio.',
      v_com_valor;
  end if;

  -- -------------------------------------------------------------------------
  -- 3. Os cinco tipos
  -- -------------------------------------------------------------------------

  -- PTA — um tipo só, com o formato na ficha.
  --
  -- Tesoura, articulada e telescópica poderiam ser três tipos. São um só porque
  -- o que muda entre elas — alcance e forma de chegar lá — é exatamente o que a
  -- ficha já pergunta, e três tipos exigiriam manter três fichas iguais em
  -- sincronia. Filtrar por `formato` responde a mesma pergunta.
  --
  -- 250 h é o intervalo de manutenção que os fabricantes publicam para
  -- plataformas motorizadas. Se a Sistenge pratica outro, é um campo na tela de
  -- Configurações, não uma migration.
  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h, campos_ficha, ativo)
  values (
    v_org, v_acesso, 'PTA', 'equipamento', 250,
    jsonb_build_array(
      jsonb_build_object(
        'chave', 'formato', 'rotulo', 'Formato',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Tesoura', 'Articulada', 'Telescópica'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'altura_de_trabalho', 'rotulo', 'Altura de trabalho',
        'tipo', 'numero', 'unidade', 'm', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'capacidade', 'rotulo', 'Capacidade',
        'tipo', 'numero', 'unidade', 'kg', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'tracao', 'rotulo', 'Tração',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Elétrica', 'Diesel', 'Híbrida'),
        'obrigatorio', false)
    ),
    true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao         = excluded.natureza_padrao,
        intervalo_manutencao_h  = excluded.intervalo_manutencao_h,
        campos_ficha            = excluded.campos_ficha,
        ativo                   = true;

  -- ANDAIME — material retornável, e por isso sem ficha.
  --
  -- Andaime fachadeiro se aluga por painel e se devolve contando painel; não há
  -- peça com patrimônio para carregar ficha. `campos_ficha` vazio é a afirmação
  -- correta, não uma omissão: um tipo controlado por quantidade não tem peça
  -- onde gravar valor.
  --
  -- Se a obra controlar painel a painel com plaqueta, isto muda para
  -- 'equipamento' pela tela — sem migration.
  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h, campos_ficha, ativo)
  values (v_org, v_acesso, 'ANDAIME', 'material_retornavel', null, '[]'::jsonb, true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao         = excluded.natureza_padrao,
        intervalo_manutencao_h  = excluded.intervalo_manutencao_h,
        campos_ficha            = excluded.campos_ficha,
        ativo                   = true;

  -- BETONEIRA — sem intervalo por horímetro: a maioria não tem horímetro.
  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h, campos_ficha, ativo)
  values (
    v_org, v_concreto, 'BETONEIRA', 'equipamento', null,
    jsonb_build_array(
      jsonb_build_object(
        'chave', 'capacidade', 'rotulo', 'Capacidade',
        'tipo', 'numero', 'unidade', 'L', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'acionamento', 'rotulo', 'Acionamento',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Elétrico', 'Motor a gasolina', 'Motor a diesel'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'tensao', 'rotulo', 'Tensão',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('127 V', '220 V', '380 V'),
        'obrigatorio', false)
    ),
    true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao         = excluded.natureza_padrao,
        intervalo_manutencao_h  = excluded.intervalo_manutencao_h,
        campos_ficha            = excluded.campos_ficha,
        ativo                   = true;

  -- GERADOR — 250 h, o intervalo de troca de óleo dos grupos geradores.
  --
  -- `cabinado` não é detalhe estético: gerador aberto não pode operar perto de
  -- frente de serviço por ruído, e é a primeira pergunta de quem procura um.
  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h, campos_ficha, ativo)
  values (
    v_org, v_energia, 'GERADOR', 'equipamento', 250,
    jsonb_build_array(
      jsonb_build_object(
        'chave', 'potencia', 'rotulo', 'Potência',
        'tipo', 'numero', 'unidade', 'kVA', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'combustivel', 'rotulo', 'Combustível',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Diesel', 'Gasolina'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'cabinado', 'rotulo', 'Cabinado',
        'tipo', 'sim_nao', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'tanque', 'rotulo', 'Tanque',
        'tipo', 'numero', 'unidade', 'L', 'opcoes', '[]'::jsonb, 'obrigatorio', false)
    ),
    true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao         = excluded.natureza_padrao,
        intervalo_manutencao_h  = excluded.intervalo_manutencao_h,
        campos_ficha            = excluded.campos_ficha,
        ativo                   = true;

  -- AR-CONDICIONADO — o gás entra porque decide o custo da manutenção.
  --
  -- R-22 está em descontinuação (Protocolo de Montreal): recarregar um aparelho
  -- de R-22 hoje custa mais que o conserto, e saber quantos ainda existem no
  -- parque é uma decisão de troca, não um dado de ficha técnica.
  insert into public.tipo_equipamento
    (org_id, categoria_id, nome, natureza_padrao, intervalo_manutencao_h, campos_ficha, ativo)
  values (
    v_org, v_clima, 'AR-CONDICIONADO', 'equipamento', null,
    jsonb_build_array(
      jsonb_build_object(
        'chave', 'capacidade', 'rotulo', 'Capacidade',
        'tipo', 'numero', 'unidade', 'BTU/h', 'opcoes', '[]'::jsonb, 'obrigatorio', false),
      jsonb_build_object(
        'chave', 'formato', 'rotulo', 'Formato',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Split hi-wall', 'Cassete', 'Piso-teto', 'Janela', 'Portátil'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'ciclo', 'rotulo', 'Ciclo',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('Só frio', 'Quente/frio'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'tensao', 'rotulo', 'Tensão',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('127 V', '220 V'),
        'obrigatorio', false),
      jsonb_build_object(
        'chave', 'gas_refrigerante', 'rotulo', 'Gás refrigerante',
        'tipo', 'lista', 'unidade', null,
        'opcoes', jsonb_build_array('R-410A', 'R-32', 'R-22'),
        'obrigatorio', false)
    ),
    true)
  on conflict (org_id, categoria_id, nome) do update
    set natureza_padrao         = excluded.natureza_padrao,
        intervalo_manutencao_h  = excluded.intervalo_manutencao_h,
        campos_ficha            = excluded.campos_ficha,
        ativo                   = true;
end $$;

notify pgrst, 'reload schema';
