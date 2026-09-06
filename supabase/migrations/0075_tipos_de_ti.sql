-- ============================================================================
-- Os tipos de TI e a trava que faz a importação ser idempotente
-- (docs/superpowers/specs/2026-09-05-inventario-ti-design.md, fase B)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Duas descrições iguais no catálogo são sempre defeito
-- ---------------------------------------------------------------------------
-- `item_catalogo` NÃO tinha índice único em (org_id, descricao). O importador
-- resolve o item pela descrição; sem esta trava, a segunda execução criaria 27
-- modelos duplicados EM SILÊNCIO — e "rodar duas vezes não duplica" é o
-- critério de pronto da fase B.
--
-- `lower()` porque "Latitude 3410" e "LATITUDE 3410" são o mesmo modelo, e o
-- catálogo com os dois é uma lista que não dá para procurar.
do $$
declare
  v_dup text;
begin
  select string_agg(descricao, ' | ') into v_dup
  from (
    select min(descricao) descricao
    from public.item_catalogo
    group by org_id, lower(descricao)
    having count(*) > 1
  ) d;

  if v_dup is not null then
    raise exception 'Ha descricoes duplicadas no catalogo, funda-as antes: %', v_dup;
  end if;
end $$;

create unique index if not exists idx_item_catalogo_descricao
  on public.item_catalogo (org_id, lower(descricao));

-- ---------------------------------------------------------------------------
-- 2. NOTEBOOK, DESKTOP e SERVIDOR
-- ---------------------------------------------------------------------------
-- Os três compartilham a MESMA ficha. Um servidor sem tela e um notebook pedem
-- os mesmos seis dados; três fichas separadas seriam três cópias que divergem
-- na primeira vez que alguém acrescentar um campo.
--
-- MONITOR não entra: os dois monitores da planilha estavam na aba DEVOLVIDAS,
-- que ficou fora do escopo.
--
-- O QUE **NÃO** ESTÁ NA FICHA, E POR QUÊ.
--
-- A memória RAM tem coluna NATIVA (`equipamento_unidade.memoria_gb`), com campo
-- próprio no formulário da peça. Repeti-la aqui criaria dois lugares para
-- digitar a mesma coisa — que é como as duas cópias divergem. O mesmo vale para
-- a service tag (`service_tag`) e o patrimônio (`identificador`).
--
-- Isto REMOVE o campo "Memória RAM" que já estava no tipo DESKTOP. Nenhuma peça
-- tem valor gravado nele (a única peça existente tem `ficha` vazia), então nada
-- é orfanado — e o `do $$` abaixo aborta se isso deixar de ser verdade.
do $$
declare
  v_org        uuid;
  v_categoria  uuid;
  v_campos     jsonb;
  v_com_valor  int;
begin
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organizacao cadastrada.';
  end if;

  select id into v_categoria
  from public.categoria_equipamento
  where org_id = v_org and nome = 'TI';
  if v_categoria is null then
    raise exception 'Categoria "TI" nao encontrada.';
  end if;

  -- Nenhuma peça pode ter ficha preenchida sob os tipos que vamos redefinir.
  select count(*) into v_com_valor
  from public.equipamento_unidade u
  join public.item_catalogo i on i.id = u.item_id
  join public.tipo_equipamento t on t.id = i.tipo_id
  where t.org_id = v_org
    and t.categoria_id = v_categoria
    and u.ficha <> '{}'::jsonb;

  if v_com_valor > 0 then
    raise exception
      'Ha % peca(s) de TI com ficha preenchida. Redefinir os campos do tipo apagaria valores em silencio.',
      v_com_valor;
  end if;

  v_campos := jsonb_build_array(
    jsonb_build_object(
      'chave', 'nome_dispositivo', 'rotulo', 'Nome do dispositivo',
      'tipo', 'texto', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false),
    jsonb_build_object(
      'chave', 'sistema_operacional', 'rotulo', 'Sistema operacional',
      'tipo', 'lista', 'unidade', null,
      -- As 10 grafias da planilha ("Microsoft Windows 11 Pro" e "Microsoft
      -- Windows 11 Professional" são o mesmo SO) viram estas 6 opções.
      'opcoes', jsonb_build_array(
        'Windows 11 Pro', 'Windows 10 Pro', 'Windows 10 Home Single Language',
        'Windows 7 Professional', 'Windows Server 2019 Standard', 'Outro'),
      'obrigatorio', false),
    jsonb_build_object(
      'chave', 'processador', 'rotulo', 'Processador',
      'tipo', 'texto', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false),
    jsonb_build_object(
      'chave', 'armazenamento', 'rotulo', 'Armazenamento',
      'tipo', 'texto', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false),
    jsonb_build_object(
      'chave', 'tipo_disco', 'rotulo', 'Tipo de disco',
      'tipo', 'lista', 'unidade', null,
      'opcoes', jsonb_build_array('SSD', 'NVMe', 'Rígido'),
      'obrigatorio', false),
    jsonb_build_object(
      'chave', 'garantia_ate', 'rotulo', 'Garantia até',
      'tipo', 'data', 'unidade', null, 'opcoes', '[]'::jsonb, 'obrigatorio', false)
  );

  insert into public.tipo_equipamento (org_id, categoria_id, nome, natureza_padrao, campos_ficha, ativo)
  select v_org, v_categoria, n, 'equipamento', v_campos, true
  from unnest(array['NOTEBOOK', 'DESKTOP', 'SERVIDOR']) as n
  on conflict (org_id, categoria_id, nome) do update
    set campos_ficha = excluded.campos_ficha,
        ativo        = true;
end $$;

notify pgrst, 'reload schema';
