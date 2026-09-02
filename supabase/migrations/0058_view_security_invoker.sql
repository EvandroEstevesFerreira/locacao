-- ============================================================================
-- `termo_equipamento_situacao` com security_invoker.
--
-- No Postgres 15+ uma view nasce com `security_invoker = off`: ela executa com
-- os privilégios do DONO (postgres), e não de quem consulta. Como o dono
-- ignora RLS, a view devolvia a situação de TODO termo de TODAS as
-- organizações para qualquer usuário autenticado que fizesse
-- `GET /rest/v1/termo_equipamento_situacao` — id do termo e situação, sem
-- passar pela policy `termo_select`.
--
-- É a mesma armadilha do `createAdminClient()` descrita no AGENTS.md, por outra
-- porta: o isolamento por organização e o escopo por obra do Loca dependem de
-- RLS, e nada estoura erro quando ela é contornada. O advisor de segurança do
-- Supabase marca isto como ERROR (lint 0010).
--
-- Com `security_invoker = on` a view passa a avaliar as policies das tabelas
-- de base no papel de quem consulta. Para o uso legítimo nada muda: a view é
-- lida junto do próprio termo, que já é filtrado pela policy.
--
-- Primeira view do projeto — daí não haver precedente a seguir. Toda view nova
-- nasce com esta opção.
-- ============================================================================

alter view public.termo_equipamento_situacao set (security_invoker = on);

comment on view public.termo_equipamento_situacao is
  'Situação derivada do termo (rascunho, em uso, devolução parcial, devolvido, cancelado). security_invoker = on: respeita a RLS de quem consulta.';
