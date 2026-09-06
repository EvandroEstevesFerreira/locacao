-- ============================================================================
-- categoria_resumo — quantos modelos e peças cada categoria tem
--
-- O trilho de categorias da tela de Itens precisa do total de CADA categoria ao
-- mesmo tempo, inclusive das que o filtro atual esconde: é isso que faz o
-- trilho servir de navegação em vez de só de rótulo.
--
-- Contar na aplicação obrigaria a trazer o catálogo inteiro a cada visita —
-- todas as linhas, só para somar oito números.
-- ============================================================================

-- `security_invoker = on` NÃO É OPCIONAL. No Postgres 15+ o padrão é `off`: a
-- view roda com os privilégios do DONO, que ignora RLS, e passa a devolver as
-- linhas de TODAS as organizações. Foi o incidente da 0.49.1 (migration 0058),
-- e `src/lib/migrations-seguranca.test.ts` reprova quem esquecer.
create or replace view public.categoria_resumo
with (security_invoker = on) as
select
  c.id                                            as categoria_id,
  c.org_id,
  c.nome,
  count(distinct i.id)                            as modelos,
  count(u.id)                                     as pecas,
  count(*) filter (where u.situacao = 'em_uso')   as em_uso
from public.categoria_equipamento c
left join public.item_catalogo i on i.categoria_id = c.id
left join public.equipamento_unidade u on u.item_id = i.id
group by c.id, c.org_id, c.nome;

comment on view public.categoria_resumo is
  'Totais por categoria para o trilho da tela de Itens. security_invoker = on: respeita a RLS de quem consulta.';

notify pgrst, 'reload schema';
