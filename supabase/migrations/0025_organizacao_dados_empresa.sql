-- ============================================================================
-- Cadastro completo da empresa (organização): dados usados nos contratos.
-- ============================================================================
alter table public.organizacao
  add column if not exists razao_social         text,
  add column if not exists nome_fantasia        text,
  add column if not exists inscricao_estadual    text,
  add column if not exists inscricao_municipal   text,
  add column if not exists endereco             text,
  add column if not exists cidade               text,
  add column if not exists uf                   text,
  add column if not exists cep                  text,
  add column if not exists telefone             text,
  add column if not exists email                text,
  add column if not exists site                 text,
  add column if not exists representante_nome    text,
  add column if not exists representante_cargo   text,
  add column if not exists representante_cpf     text,
  add column if not exists responsaveis         text,
  add column if not exists observacoes          text;

notify pgrst, 'reload schema';
