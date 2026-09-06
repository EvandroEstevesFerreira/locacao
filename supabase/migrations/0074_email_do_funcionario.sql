-- ============================================================================
-- E-mail do funcionário
-- (docs/superpowers/specs/2026-09-05-inventario-ti-design.md, fase A)
--
-- POR QUE NÃO FICA NA PEÇA.
--
-- O pedido original era o e-mail no cadastro do equipamento. São 127 máquinas
-- para cerca de 110 pessoas: o endereço de quem tem três máquinas ficaria
-- gravado três vezes. E quando a máquina troca de mão, o e-mail que está NELA é
-- o do detentor ANTERIOR — que é para onde a cópia do termo sairia.
--
-- É o mesmo defeito que este sistema já pagou três vezes: as obras do
-- fornecedor mantidas à mão ao lado dos contratos, o STATUS_AVARIA declarado em
-- dois arquivos, a família do equipamento escrita dentro da descrição.
--
-- O equipamento chega ao e-mail pela CUSTÓDIA, que sabe quem responde por ele
-- hoje.
-- ============================================================================

alter table public.funcionario
  add column if not exists email text,

  -- `email_confirmado` existe porque o e-mail VAI SER ADIVINHADO: a importação
  -- do inventário deriva `nome.sobrenome@sistenge.com`, que é um palpite
  -- bem-informado e não um fato.
  --
  -- A coluna separa "temos um palpite" de "alguém conferiu", e sustenta uma
  -- regra dura: NENHUM TERMO SAI PARA ENDEREÇO NÃO CONFIRMADO. Sem ela, o
  -- primeiro envio em massa descobriria os erros como devolução de e-mail —
  -- ou, pior, entregando o termo de responsabilidade de um funcionário na
  -- caixa de outro.
  add column if not exists email_confirmado boolean not null default false;

-- Parcial e por `lower()`: duas pessoas não dividem um e-mail corporativo, e
-- `Marcio.Oliveira@` e `marcio.oliveira@` são o mesmo endereço. Parcial porque
-- funcionário sem e-mail é o caso normal — 97 já estão cadastrados assim.
create unique index if not exists idx_funcionario_email
  on public.funcionario (org_id, lower(email))
  where email is not null;

notify pgrst, 'reload schema';
