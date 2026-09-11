-- ============================================================================
-- v0.108.0 — Aluguel de imóvel no espelho do Mega
-- ============================================================================
--
-- 21 contratos de imóvel vigentes, R$ 66.575/mês de aluguel, e nenhum
-- lançamento financeiro: o Loca sabe o contrato e não sabe o pagamento. Mesma
-- situação da locação de equipamento antes da 0.106.0.
--
-- O QUE FALTAVA NÃO ERA CÓDIGO, ERA CHAVE. O locador vive em texto livre
-- (`imovel.proprietario_nome`), sem nada que o ligue ao agente do ERP.

-- ---------------------------------------------------------------------------
-- 1. O cache de agentes do Mega
-- ---------------------------------------------------------------------------
--
-- A rota de contas a pagar por período devolve `Agente.Nome` e `Agente.Cnpj`
-- NULOS — só o código vem preenchido (medido em 10/09/2026: 458 parcelas, 224
-- agentes, zero nomes). O nome sai de `/api/globalagente/Agente/{id}`, uma
-- chamada por agente.
--
-- Por isso o cache: resolver 224 códigos toda manhã seria 224 chamadas diárias
-- contra a conta que já foi bloqueada uma vez. Resolvidos uma vez, ficam.
create table public.mega_agente (
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  codigo        text not null,
  nome          text,
  cnpj          text,
  -- Documento só com os dígitos, para casar com o cadastro do Loca sem depender
  -- de máscara. O Mega devolve CNPJ mascarado e, em agente de retenção, devolve
  -- o PRÓPRIO CÓDIGO com padding no lugar do CNPJ — o guia do ERP avisa, e é
  -- por isso que este campo é separado do `cnpj` cru: aqui só entra o que
  -- passou na máscara.
  documento     text,
  resolvido_em  timestamptz not null default now(),
  primary key (org_id, codigo)
);

create index idx_mega_agente_documento on public.mega_agente (org_id, documento);

alter table public.mega_agente enable row level security;

create policy "mega_agente_select" on public.mega_agente
  for select to authenticated
  using (
    org_id = public.current_org_id()
    and public.current_papel() in ('master', 'administrador')
  );

-- ---------------------------------------------------------------------------
-- 2. A chave do locador no cadastro do imóvel
-- ---------------------------------------------------------------------------
alter table public.imovel
  -- O DOCUMENTO É A CHAVE NATURAL, e o Loca precisa dele de qualquer forma para
  -- pagar aluguel. Com ele, `GetAgenteCnpj` resolve o código sozinha; sem ele,
  -- só resta digitar código à mão, e código errado mostra na tela o pagamento
  -- de outra pessoa.
  add column if not exists locador_documento text,
  -- O código do Mega, uma vez resolvido. Guardado, e não recalculado, porque a
  -- resolução custa chamada e o vínculo não muda.
  add column if not exists codigo_mega text,
  -- Quem de fato recebe: às vezes o proprietário, às vezes a imobiliária. O
  -- cadastro já distingue os dois, e o dinheiro segue um só.
  add column if not exists locador_e_imobiliaria boolean not null default false;

create index if not exists idx_imovel_codigo_mega
  on public.imovel (org_id, codigo_mega)
  where codigo_mega is not null;

-- ---------------------------------------------------------------------------
-- 3. O espelho passa a apontar para imóvel também
-- ---------------------------------------------------------------------------
alter table public.mega_titulo
  add column if not exists imovel_id uuid references public.imovel (id) on delete set null;

create index if not exists idx_mega_titulo_imovel on public.mega_titulo (imovel_id);

-- `fornecedor_id` e `imovel_id` são exclusivos: um título é de um ou de outro.
-- Sem isto, um código repetido nos dois cadastros faria o mesmo título aparecer
-- somado duas vezes — no contrato de equipamento e no de imóvel.
alter table public.mega_titulo
  add constraint mega_titulo_um_dono_so
  check (fornecedor_id is null or imovel_id is null);
