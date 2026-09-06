-- ============================================================================
-- item_parque — quantas peças cada item tem, e em que estado
--
-- A tela de Itens mostrava "17 un." como texto cinza colado ao nome, e esse
-- número não distinguia 17 PARADOS de 17 EM CAMPO — que é a diferença entre ter
-- folga e não ter.
--
-- Contar por situação em PostgREST não dá: não há `count(*) filter (...)` na
-- API. Ou se traz toda peça para o servidor de aplicação e conta lá — 128 hoje,
-- e crescendo —, ou o banco conta. O banco conta.
-- ============================================================================

-- `security_invoker = on` NÃO É OPCIONAL.
--
-- No Postgres 15+ o padrão é `off`: a view executa com os privilégios do DONO,
-- que ignora RLS, e passa a devolver as linhas de TODAS as organizações a
-- qualquer usuário autenticado. Foi o incidente da 0.49.1 (migration 0058), e
-- `src/lib/migrations-seguranca.test.ts` existe para reprovar quem esquecer.
--
-- Aqui doeria em dobro: a contagem por item é justamente o tipo de número que
-- ninguém confere linha a linha.
create or replace view public.item_parque
with (security_invoker = on) as
select
  i.id                                                        as item_id,
  i.org_id,
  i.tipo_id,
  i.categoria_id,
  count(u.id)                                                 as pecas,
  count(*) filter (where u.situacao = 'em_uso')               as em_uso,
  count(*) filter (where u.situacao = 'disponivel')            as disponivel,
  count(*) filter (where u.situacao in ('manutencao', 'baixada', 'perdida'))
                                                              as fora,
  count(*) filter (where u.propriedade = 'locada')            as locadas
from public.item_catalogo i
left join public.equipamento_unidade u on u.item_id = i.id
group by i.id, i.org_id, i.tipo_id, i.categoria_id;

comment on view public.item_parque is
  'Contagem de pecas por item, quebrada por situacao e propriedade. security_invoker = on: respeita a RLS de quem consulta.';

notify pgrst, 'reload schema';
