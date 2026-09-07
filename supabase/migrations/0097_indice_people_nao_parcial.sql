-- ============================================================================
-- O índice de `people_id` não pode ser parcial
--
-- Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
--
-- DEFEITO ENCONTRADO NA PRIMEIRA SINCRONIZAÇÃO DE VERDADE, em 07/09/2026:
--
--   "Falha ao gravar o lote 1: there is no unique or exclusion constraint
--    matching the ON CONFLICT specification"
--
-- A 0094 criou `idx_funcionario_people` como índice PARCIAL,
-- `where people_id is not null`. O `ON CONFLICT (org_id, people_id)` do upsert
-- não consegue inferir um índice parcial: para usá-lo, o comando teria de
-- repetir o mesmo predicado, e o PostgREST não emite `WHERE` nenhum no
-- `on_conflict`. Resultado: toda gravação da sincronização abortava.
--
-- ┌─ O RACIOCÍNIO QUE LEVOU AO PARCIAL ESTAVA ERRADO ────────────────────────┐
-- │ O comentário da 0094 justificava: "parcial porque as 118 linhas de hoje  │
-- │ ficam com `people_id` nulo até a conciliação".                           │
-- │                                                                          │
-- │ Não precisava. No Postgres, dois NULL NUNCA são iguais entre si num      │
-- │ índice único — é o padrão (`NULLS DISTINCT`). Um índice COMPLETO em      │
-- │ (org_id, people_id) já aceita quantas linhas sem vínculo existirem, e é  │
-- │ o único que o ON CONFLICT enxerga.                                       │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- Nada tinha sido gravado quando o erro apareceu: o lote inteiro abortou, o
-- cursor não avançou e a rodada voltou `ok: false`. A janela é tentada de novo
-- inteira, que é exatamente o desenhado.

drop index if exists public.idx_funcionario_people;

-- COMPLETO, e não parcial. `nulls distinct` é o padrão e está aqui escrito de
-- propósito: é a propriedade da qual este índice depende para conviver com as
-- linhas ainda não conciliadas.
create unique index if not exists idx_funcionario_people
  on public.funcionario (org_id, people_id)
  nulls distinct;

-- ---------------------------------------------------------------------------
-- A conferência
-- ---------------------------------------------------------------------------
-- Aborta se o índice voltar a nascer parcial: `indpred` não nulo é a marca de
-- índice com predicado, e é ela que quebra o ON CONFLICT.
do $$
declare
  v_parcial boolean;
begin
  select i.indpred is not null into v_parcial
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  where c.relname = 'idx_funcionario_people';

  if v_parcial is null then
    raise exception 'idx_funcionario_people nao existe.';
  end if;

  if v_parcial then
    raise exception
      'idx_funcionario_people esta PARCIAL; o ON CONFLICT do upsert nao o enxerga.';
  end if;
end $$;

notify pgrst, 'reload schema';
