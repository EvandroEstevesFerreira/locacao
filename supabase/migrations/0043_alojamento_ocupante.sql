-- ============================================================================
-- Alojamento — dados do ocupante exigidos pelo FRM-RH-001 (Termo de
-- Compromisso de Alojamento).
--
-- O bloco de identificação do termo tem 15 campos. O Loca passa a guardar os
-- três que ele de fato controla (cargo, quarto, armário); RG, data de admissão,
-- encarregado e contato de emergência saem como LINHA EM BRANCO no PDF, para
-- preenchimento manual — o primitivo CampoGrid trata `valor: null` desenhando a
-- linha, então promover qualquer um deles a "guardado" depois é acrescentar a
-- coluna e passar o valor, sem tocar em layout.
--
-- aceite_em / aceite_ip entram NULAS agora, para a fase de aceite digital. O
-- primitivo <Assinaturas modo="aceite"> já existe; criar as colunas junto evita
-- uma migration só para elas depois.
--
-- Sem mudança de RLS: as policies de ocupante_imovel são por linha, não por
-- coluna, e já cobrem as novas.
-- ============================================================================
alter table public.ocupante_imovel
  add column if not exists cargo     text,
  add column if not exists quarto    text,
  add column if not exists armario   text,
  add column if not exists aceite_em timestamptz,
  add column if not exists aceite_ip inet;

comment on column public.ocupante_imovel.cargo is
  'Função/cargo do alojado, impresso no bloco de identificação do FRM-RH-001.';
comment on column public.ocupante_imovel.quarto is
  'Nº do alojamento/quarto designado.';
comment on column public.ocupante_imovel.armario is
  'Nº do armário individual. A chave é pessoal e intransferível (POL-RH-001, item 8).';
comment on column public.ocupante_imovel.aceite_em is
  'Data/hora do aceite eletrônico do termo. Nula enquanto a assinatura for em papel.';
comment on column public.ocupante_imovel.aceite_ip is
  'IP do aceite eletrônico. inet, não text: é um endereço IP.';

notify pgrst, 'reload schema';
