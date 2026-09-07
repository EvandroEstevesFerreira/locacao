-- ============================================================================
-- O índice que faltava na chave estrangeira do certificado
-- ============================================================================
--
-- Apontado pelos advisors de DESEMPENHO, que eu tinha deixado de rodar: a
-- auditoria de ontem cobriu só segurança.
--
-- `certificado_equipamento.unidade_id` é chave estrangeira com
-- `on delete cascade`, e não tinha índice que a cobrisse. O
-- `idx_certificado_atual` existe, mas é `(org_id, unidade_id, especie,
-- vence_em desc)` — com `org_id` na frente, ele não serve a uma busca por
-- `unidade_id` sozinho.
--
-- DOIS CAMINHOS PAGAM POR ISSO:
--
--   1. Excluir uma peça. O cascade precisa achar os certificados dela, e sem
--      índice varre a tabela inteira.
--   2. `listarCertificadosDaPeca`, que é a seção Certificados da tela da peça:
--      ela filtra por `unidade_id` e deixa a organização para a RLS.
--
-- Hoje a tabela tem zero linha e nada disso se nota. Com a frota de obra e os
-- veículos, cada peça acumula um certificado por ano — e o custo aparece
-- justamente na tela que se abre todo dia.
create index if not exists idx_certificado_unidade
  on public.certificado_equipamento (unidade_id, vence_em desc)
  where deleted_at is null;

-- `idx_certificado_vencimento (org_id, vence_em)` fica. Os advisors o marcam
-- como "não usado", e está certo: o cron de vencimentos ainda não rodou com
-- certificado nenhum cadastrado. Ele existe para a varredura diária por janela
-- de data, que é exatamente o que vai passar por ali quando houver dado.
