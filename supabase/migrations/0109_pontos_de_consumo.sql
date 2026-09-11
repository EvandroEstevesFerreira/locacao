-- ============================================================================
-- v0.110.0 — Pontos de consumo: a chave que liga conta do Mega a imóvel
-- ============================================================================
--
-- O PROBLEMA MEDIDO EM 11/09/2026: o Mega tem 803 títulos do tipo CONTA, de 46
-- agentes (CPFL 287, SABESP 274, DESKTOP 111). Nenhum diz de que imóvel é.
--
-- Casar por valor + vencimento não escala, e isso foi medido, não suposto:
--   * o Mega usa a data do LOTE de pagamento, não o vencimento do boleto —
--     três contas de água de imóveis diferentes caem todas em 24/08;
--   * contas de água colidem por natureza: R$ 74,83, R$ 74,86 e R$ 75,44 no
--     mesmo mês. Uma conta do Loca casou com TRÊS títulos ao mesmo tempo;
--   * 157 dos 803 títulos (20%) colidem em agente + mês + valor.
--
-- A CHAVE É O NÚMERO DA INSTALAÇÃO (CPFL) ou do RGI (SABESP): está impresso em
-- toda conta, não muda nunca, e é único por ponto de consumo. A convenção
-- combinada com o Evandro em 11/09/2026 é que ele vá no campo Documento do
-- lançamento, só dígitos — porque `NumeroDocumento` vem de graça na consulta
-- diária, enquanto o Histórico só existe na rota de detalhe, um título por
-- chamada, com 36% de aproveitamento: sessenta chamadas por dia contra duas.

create table public.ponto_consumo (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizacao (id) on delete cascade,
  imovel_id     uuid not null references public.imovel (id) on delete cascade,

  -- EXATAMENTE os valores de `TIPOS_CONSUMO` em src/lib/imoveis.ts. Escrevi
  -- `condominio` na primeira versão e o app usa `iptu`: o insert seria recusado
  -- pelo banco com o formulário preenchido e nenhuma pista na tela.
  tipo          text not null check (tipo in ('agua', 'luz', 'gas', 'internet', 'iptu', 'outro')),

  -- O número da instalação / RGI / contrato, SÓ DÍGITOS. Guardar sem máscara é
  -- o que permite comparar com o `NumeroDocumento` do Mega sem adivinhar
  -- formatação — lá também entra só dígito.
  identificador text not null check (identificador ~ '^[0-9]+$'),

  -- O `codigo_mega` da concessionária (CPFL 2719, SABESP 2726, DESKTOP 2721…).
  -- Sem ele o identificador seria ambíguo: nada impede duas concessionárias de
  -- usarem o mesmo número de instalação.
  concessionaria_codigo_mega text,
  concessionaria_nome        text,

  -- Ponto desativado não some: conta de imóvel já entregue PRECISA continuar
  -- reconhecível, porque continuar sendo paga é exatamente o vazamento que
  -- este cadastro existe para achar.
  ativo         boolean not null default true,
  observacoes   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Um identificador pertence a UM ponto por concessionária. Sem isto, o mesmo
-- número cadastrado em dois imóveis faria a mesma conta aparecer nos dois.
create unique index uq_ponto_consumo_identificador
  on public.ponto_consumo (org_id, coalesce(concessionaria_codigo_mega, ''), identificador);

create index idx_ponto_consumo_imovel on public.ponto_consumo (imovel_id);

create trigger trg_ponto_consumo_updated_at
  before update on public.ponto_consumo
  for each row execute function public.set_updated_at();

alter table public.ponto_consumo enable row level security;

-- Mesma régua do imóvel: operacional lê e escreve, respeitando o escopo de obra.
create policy "ponto_consumo_select" on public.ponto_consumo
  for select to authenticated
  using (org_id = public.current_org_id());

create policy "ponto_consumo_insert" on public.ponto_consumo
  for insert to authenticated
  with check (org_id = public.current_org_id() and public.pode_operar());

create policy "ponto_consumo_update" on public.ponto_consumo
  for update to authenticated
  using (org_id = public.current_org_id() and public.pode_operar())
  with check (org_id = public.current_org_id());

create policy "ponto_consumo_delete" on public.ponto_consumo
  for delete to authenticated
  using (org_id = public.current_org_id() and public.pode_gerir_cadastros());

comment on table public.ponto_consumo is
  'Instalação/RGI de cada conta de consumo do imóvel. É a chave que liga o '
  'título CONTA do Mega ao imóvel — casar por valor e data não escala: 20% dos '
  'títulos colidem em agente+mês+valor (medido em 11/09/2026).';
