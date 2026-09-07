-- ============================================================================
-- As duas exigências que a lei nomeia, nos tipos que nasceram na 0080
-- ============================================================================
--
-- A estrutura da 0081 só produz pendência onde alguém DECLARA a exigência. Sem
-- esta migration, PTA e ar-condicionado ficariam cadastrados e mudos — e a
-- primeira PTA a entrar no sistema nasceria sem cobrar inspeção nenhuma.
--
-- POR QUE APENAS DUAS, com sete espécies disponíveis.
--
-- Estas são as que a lei nomeia sem margem: inspeção periódica de plataforma
-- (NR-12 e NR-18) e PMOC (Lei 13.589/2018). As demais dependem de como a
-- Sistenge opera — gerador precisa de laudo elétrico? o nível a laser é
-- calibrado a cada 12 meses ou a cada 6? — e adivinhar isso encheria a tela da
-- peça de pendência que ninguém pediu, ensinando a ignorar a seção inteira.
--
-- O editor de exigências existe em Configurações → Categorias e tipos. O resto
-- entra por lá, por quem sabe a resposta.
--
-- BETONEIRA e GERADOR ficam sem exigência de propósito, e ANDAIME não teria
-- onde pendurar uma: é controlado por quantidade, e sem peça não há ficha nem
-- certificado.

do $$
declare
  v_org       uuid;
  v_pta       uuid;
  v_clima     uuid;
  v_ja_tem    int;
begin
  select id into v_org from public.organizacao order by created_at limit 1;
  if v_org is null then
    raise exception 'Nenhuma organizacao cadastrada.';
  end if;

  select t.id into v_pta
  from public.tipo_equipamento t
  join public.categoria_equipamento c on c.id = t.categoria_id
  where t.org_id = v_org and c.nome = 'Acesso e altura' and t.nome = 'PTA';

  select t.id into v_clima
  from public.tipo_equipamento t
  join public.categoria_equipamento c on c.id = t.categoria_id
  where t.org_id = v_org and c.nome = 'Climatização' and t.nome = 'AR-CONDICIONADO';

  if v_pta is null or v_clima is null then
    raise exception 'Rode a 0080 antes: pta=% ar-condicionado=%', v_pta, v_clima;
  end if;

  -- A trava: se alguém já ajustou as exigências pela tela, esta migration NÃO
  -- desfaz o ajuste. `on conflict do update` num jsonb inteiro sobrescreve, e
  -- sobrescrever a configuração de quem sabe mais que a migration é como uma
  -- reexecução apaga trabalho.
  select count(*) into v_ja_tem
  from public.tipo_equipamento
  where id in (v_pta, v_clima) and certificados_exigidos <> '[]'::jsonb;

  if v_ja_tem > 0 then
    raise notice 'Exigencias ja configuradas em % tipo(s); nada a fazer.', v_ja_tem;
    return;
  end if;

  -- Inspeção periódica anual. É o documento que a fiscalização pede primeiro, e
  -- sem ele a plataforma é interditada onde estiver.
  update public.tipo_equipamento
     set certificados_exigidos =
       '[{"especie":"inspecao_periodica","periodicidade_meses":12}]'::jsonb
   where id = v_pta;

  -- PMOC. Obrigatório em ambiente climatizado de uso coletivo — que é o
  -- canteiro, o contêiner de escritório e o alojamento.
  update public.tipo_equipamento
     set certificados_exigidos =
       '[{"especie":"pmoc","periodicidade_meses":12}]'::jsonb
   where id = v_clima;
end $$;

notify pgrst, 'reload schema';
