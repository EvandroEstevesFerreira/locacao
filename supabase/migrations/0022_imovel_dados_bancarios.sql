-- ============================================================================
-- Módulo Imóveis — dados bancários do imóvel (pagamento ao proprietário)
-- ============================================================================
alter table public.imovel
  add column if not exists banco          text,
  add column if not exists agencia        text,
  add column if not exists conta          text,
  add column if not exists tipo_conta     text,   -- 'corrente' | 'poupanca'
  add column if not exists titular_conta  text,
  add column if not exists pix_chave      text;

notify pgrst, 'reload schema';
