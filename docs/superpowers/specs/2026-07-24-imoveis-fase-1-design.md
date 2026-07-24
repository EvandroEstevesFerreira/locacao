# Módulo Imóveis — Fase 1 (cadastro + contratos + anexos)

**Data:** 2026-07-24
**Status:** aprovado (design)

## Objetivo

Novo módulo para a Sistenge gerir **imóveis locados** (kitnet, apartamento, casa,
galpão, escritório). Fase 1 entrega o **cadastro de imóveis** + **histórico de
contratos** por imóvel + **anexos** (contrato do proprietário, comprovante de caução)
+ contatos (proprietário/imobiliária). Reaproveita auth/RBAC, Storage, obra/centro de
custo e os padrões de CRUD existentes.

Decisões (aprovadas): emissão gera contrato próprio + termo (Fase 4); custos integram
ao financeiro (Fase 2); contrato com **histórico** (1:N); vínculo a obra **opcional**.

## Modelo de dados — migration `0017_imoveis_fase1.sql`

Enums:
- `tipo_imovel` = kitnet | apartamento | casa | galpao | escritorio | outro
- `status_imovel` = ativo | desocupacao | encerrado
- `status_caucao` = em_aberto | devolvida | retida

Tabela `imovel` (o bem físico):
- `id, org_id (fk organizacao cascade)`, `tipo tipo_imovel`, `apelido text not null`,
  `endereco text`, `cidade text`, `uf text`, `capacidade_pessoas int`, `area_m2 numeric(10,2)`,
  `obra_id uuid null (fk obra on delete set null)`, `status status_imovel not null default 'ativo'`,
  `proprietario_nome/_telefone/_email text`, `imobiliaria_nome/_telefone/_email text`,
  `observacoes text`, `created_at/updated_at`. Trigger `set_updated_at`.

Tabela `contrato_imovel` (termos ao longo do tempo, 1:N):
- `id, org_id, imovel_id (fk imovel cascade)`, `data_inicio date`, `data_fim date null`,
  `valor_aluguel numeric(14,2) not null default 0`, `valor_condominio numeric(14,2) not null default 0`,
  `dia_vencimento int null`, `indice_reajuste text null`, `data_reajuste date null`,
  `caucao_valor numeric(14,2) null`, `caucao_status status_caucao null`,
  `caucao_comprovante_path text null`, `anexo_contrato_path text null`,
  `vigente boolean not null default true`, `observacoes text`, `created_at/updated_at`.

RLS (ambas): `select` para `authenticated` com `org_id = public.current_org_id()`;
`write` (all) com `org_id = public.current_org_id() and public.pode_operar()`
(operador/administrador/master operam; gestor só lê).

Storage: bucket privado **`imoveis`** + políticas org-scoped (`{org_id}/...`), espelhando
o bucket `contratos`/`vistorias`.

## App

- `src/lib/nav.ts`: novo item **Imóveis** (`/imoveis`, ícone Building2, implementado).
- `src/lib/imoveis.ts` (client-safe): tipos + `TIPO_IMOVEL_INFO`, `STATUS_IMOVEL_INFO`,
  `STATUS_CAUCAO_INFO` (label), helpers de rótulo.
- `/imoveis/page.tsx`: lista com filtros (tipo, status, obra) + KPIs (nº imóveis, aluguel
  mensal total dos contratos vigentes). Colunas: apelido, tipo, endereço/cidade, obra,
  status, aluguel vigente, ações.
- `/imoveis/novo/page.tsx` + `imovel-form.tsx` (client) — dados + contatos + obra (select).
- `/imoveis/[id]/editar/page.tsx` — reusa `imovel-form`.
- `/imoveis/[id]/page.tsx`: detalhe — dados, contatos, e **contratos** (histórico): adicionar/
  editar contrato (`contrato-imovel-form.tsx`), anexo do contrato e comprovante de caução
  (`imovel-anexo-uploader.tsx`, bucket `imoveis`), marcar vigente.
- `src/app/(app)/imoveis/actions.ts`: `salvarImovel`, `excluirImovel`, `salvarContratoImovel`,
  `excluirContratoImovel`, `salvarAnexoImovelContrato(contratoId, campo, path)`,
  `removerAnexoImovelContrato(contratoId, campo)`. Permissão: `podeOperar`.

Regra de "vigente": ao salvar um contrato marcado `vigente`, os demais contratos do mesmo
imóvel têm `vigente=false` (só um vigente por imóvel). Aluguel mensal do imóvel = do contrato vigente.

## Fora de escopo (fases futuras)

Contas de consumo + integração financeira (2); vistorias/reparos/ocorrências (3);
ocupantes + emissão de documentos PDF (4); alertas (5); relatórios exclusivos (6).

## Verificação

1. Criar imóvel (tipo, apelido, contatos, obra) → aparece na lista com status.
2. Adicionar contrato vigente (aluguel/condomínio/caução) → aluguel aparece na lista/KPI;
   anexar contrato e comprovante de caução (bucket `imoveis`).
3. Adicionar 2º contrato vigente → o 1º deixa de ser vigente (histórico preservado).
4. Filtros por tipo/status/obra funcionam. RLS: gestor só lê; operador cria/edita.
5. `npm run lint && npm run build` limpos; migração aplicada e tabelas visíveis.
