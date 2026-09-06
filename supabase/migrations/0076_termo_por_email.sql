-- ============================================================================
-- O termo de responsabilidade vai por e-mail ao funcionário
-- (docs/superpowers/specs/2026-09-05-inventario-ti-design.md, fase C.1)
--
-- O termo é assinado NA TELA, na hora, com imagem da assinatura e IP
-- registrado. O e-mail não é o ato: é a ENTREGA DA CÓPIA a quem assinou.
--
-- Por isso o carimbo é uma coluna e não uma condição. Se o Resend cair, o termo
-- continua emitido e assinado, com `email_enviado_em` nulo — e a tela mostra
-- "cópia não enviada" com um botão de reenviar. Sem o carimbo a tela diria
-- "não enviado" para sempre, e alguém reenviaria um termo que a pessoa já tem.
-- ============================================================================

alter table public.termo_equipamento
  add column if not exists email_enviado_em timestamptz;

comment on column public.termo_equipamento.email_enviado_em is
  'Quando a copia do termo assinado foi enviada ao e-mail do funcionario. Nulo = nao enviada; o envio pode ser refeito.';

notify pgrst, 'reload schema';
