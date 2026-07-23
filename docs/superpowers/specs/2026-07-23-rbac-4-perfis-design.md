# Design — RBAC de 4 perfis + gestão de usuários (criar/editar)

**Data:** 2026-07-23
**Projeto:** Loca (controle de locações por obra — Sistenge)

## Objetivo

Substituir o RBAC atual (5 papéis: `admin/gestor/financeiro/operacional/visualizador`)
por **4 perfis** com permissões fixas por perfil, e permitir **criar e editar usuários**
dentro de Configurações → Usuários.

## Perfis e matriz de permissões

| Recurso / Ação | master | administrador | gestor | operador |
|---|:---:|:---:|:---:|:---:|
| Ver (tudo) | ✅ | ✅ | ✅ | ✅ |
| Cadastros (obras, fornecedores, itens) — criar/editar | ✅ | ✅ | — | — |
| Contratos + movimentação/devolução | ✅ | ✅ | — | ✅ |
| Vistorias / avarias / fotos | ✅ | ✅ | — | ✅ |
| Financeiro (lançar, dar baixa) | ✅ | ✅ | — | — |
| Gerar relatórios (PDF/Excel) | ✅ | ✅ | ✅ | ✅ |
| Excluir dados críticos (obras, contratos) | ✅ | — | — | — |
| Configurações do sistema (alertas) | ✅ | — | — | — |
| Gestão de usuários e perfis | ✅ | — | — | — |

Resumo:
- **master** — dono do sistema, faz tudo.
- **administrador** — acesso total, exceto as 3 exclusividades do master (usuários, config, exclusões críticas).
- **gestor** — só analisa: lê tudo e gera relatórios; não edita.
- **operador** — opera o operacional (contratos, devoluções, vistorias); não mexe em financeiro/config.

## Escopo por obra

Mantém o mecanismo atual (`obra_usuario`): **master/administrador** enxergam toda a
organização; **gestor/operador** enxergam apenas as obras atribuídas. Módulos são definidos
pelo perfil (decisão "só o perfil define"); a obra é um filtro ortogonal de visibilidade.

## Modelo de dados — migration `0011_fase7_rbac_4_perfis.sql`

- Novo enum `papel_usuario` = `{master, administrador, gestor, operador}` (troca-tipo:
  cria tipo novo, converte a coluna com mapeamento, dropa o antigo, renomeia).
- Mapeamento dos dados existentes: `admin→master`, `financeiro→administrador`,
  `operacional→operador`, `visualizador→gestor`, `gestor→gestor`.
- Default da coluna: `gestor` (menor privilégio; a criação sempre informa o perfil).
- Funções auxiliares (SECURITY DEFINER) centralizam a semântica e mantêm as policies limpas:
  - `current_papel()` (recriada com o novo tipo)
  - `pode_gerir_cadastros()` = master/administrador
  - `pode_operar()` = master/administrador/operador
  - `pode_financeiro()` = master/administrador
  - `is_master()` = master
  - `has_obra_access(obra)` = org + (master/administrador OR is_member_of_obra)
  - `has_contrato_access(contrato)` = org + (master/administrador OR is_member_of_obra)
- Reescrita das policies role-based de todas as tabelas conforme a matriz. DELETE de
  `obra`/`contrato`/`lancamento` = master; config_alerta e gestão de perfis/obra_usuario = master.

## Criação de usuário

- Fluxo escolhido: **e-mail + senha temporária** (não depende de e-mail configurado).
- `criarUsuario` (server action, **somente master**) usa o **service_role** (`createAdminClient`)
  → `auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { nome } })`.
  O trigger `handle_new_user` cria o `perfil`; em seguida a action atualiza `org_id`, `papel`,
  `nome`, `ativo` e sincroniza `obra_usuario` (via service_role, ignora RLS).
- **Dependência:** `SUPABASE_SERVICE_ROLE_KEY` no ambiente (local e Vercel). Sem ela a criação
  retorna erro amigável; o resto do sistema funciona.

## Edição de usuário

- `salvarUsuario` (somente master): edita `nome`, `papel`, `ativo`, `obra_usuario` e,
  opcionalmente, **redefine a senha** (via `auth.admin.updateUserById`).

## Camada de app

- `src/lib/auth.ts`: novo tipo `Papel`, helpers acima, `PAPEL_LABEL`/`PAPEL_INFO`.
- Substituir checagens por role literal pelos helpers em todas as actions/páginas.
- `configuracoes` e `/usuarios*` restritos a **master**.
- Nav: item "Configurações" visível apenas para master (filtro por papel no sidebar).

## Verificação

- Build + lint limpos.
- Teste via REST API autenticada (como nas rodadas anteriores): confirmar que o perfil migrou
  (`admin→master`), que um gestor não edita cadastros e que um operador registra devolução mas
  não mexe no financeiro. Criação de usuário testada quando `SUPABASE_SERVICE_ROLE_KEY` existir.
