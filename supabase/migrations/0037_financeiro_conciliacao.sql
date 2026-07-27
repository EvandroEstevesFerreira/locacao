-- ============================================================================
-- v0.10.0 — Financeiro: conciliação (baixa com valor efetivo, NF/comprovante)
--           + contas a pagar recorrentes (materialização idempotente)
-- ============================================================================

alter table public.lancamento_financeiro
  add column if not exists valor_pago         numeric(14, 2),                 -- valor efetivamente pago (pode diferir de "valor" por multa/juros/desconto)
  add column if not exists multa              numeric(14, 2) not null default 0,
  add column if not exists juros              numeric(14, 2) not null default 0,
  add column if not exists nf_numero          text,
  add column if not exists comprovante_path   text,
  add column if not exists origem             text not null default 'manual',  -- manual | recorrente | avaria | consumo
  add column if not exists contrato_imovel_id uuid references public.contrato_imovel (id) on delete set null;

create index if not exists idx_lancamento_contrato_imovel
  on public.lancamento_financeiro (contrato_imovel_id);

-- Idempotência das contas recorrentes: no máximo uma conta "recorrente" por
-- contrato (equipamento OU imóvel) por competência (mês de referência).
create unique index if not exists uq_lancamento_recorrente_contrato
  on public.lancamento_financeiro (contrato_id, competencia)
  where origem = 'recorrente' and contrato_id is not null and deleted_at is null;

create unique index if not exists uq_lancamento_recorrente_imovel
  on public.lancamento_financeiro (contrato_imovel_id, competencia)
  where origem = 'recorrente' and contrato_imovel_id is not null and deleted_at is null;

-- Reutiliza o bucket privado "contratos" para os comprovantes/NF.
-- Convenção de caminho: {org_id}/comprovantes/{lancamento_id}/{arquivo}
