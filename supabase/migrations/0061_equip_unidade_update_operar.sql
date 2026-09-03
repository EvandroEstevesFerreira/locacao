-- ============================================================================
-- equip_unidade_update: pode_gerir_cadastros() → pode_operar()
--
-- O QUE ESTAVA ERRADO
-- ----------------------------------------------------------------------------
-- A 0011 gateou o UPDATE de `equipamento_unidade` (o mesmo bloco do INSERT)
-- por `pode_gerir_cadastros()` — master/administrador. Mas a permissão que a
-- aplicação checa para mover a peça e para emitir termo é `podeOperar`, que
-- inclui operador. A policy de RLS ficou mais estreita que a permissão que o
-- código já concede, e o resultado não estoura erro: um UPDATE barrado pela
-- cláusula `using` do PostgREST devolve sucesso com 0 linhas afetadas.
--
-- DUAS CONSEQUÊNCIAS, UMA NOVA E UMA JÁ VIVA EM PRODUÇÃO
-- ----------------------------------------------------------------------------
-- 1) `moverPeca` (frota/actions.ts, desta fatia): um operador aciona a action,
--    o INSERT em `custodia_peca` passa (a policy dela já exige só
--    `pode_operar()`), mas os dois UPDATE que deveriam seguir — o de
--    `obra_id` dentro de `abrirCustodia` e o de `situacao` na própria action —
--    são filtrados para 0 linhas. `error` continua `null`, a action devolve
--    `{ ok: true }`, o livro mostra a posse nova e a tela de Frota continua
--    mostrando a peça no lugar antigo. É a divergência silenciosa que os
--    comentários de `custodia-servidor.ts` prometem impedir.
--
-- 2) `emitirTermo` (termos/actions.ts) é gateada pela mesma `podeOperar`, e
--    `moverPecasDoTermo` faz o mesmo UPDATE de `situacao`. Isto é ANTERIOR A
--    ESTA FATIA: todo termo emitido por um operador desde a 0.49.0 deixou a
--    peça marcada como `disponivel` no cadastro, mesmo com o termo aberto — a
--    mentira exata que a matriz de transição de `frota.ts` existe para
--    impedir. Corrigido aqui porque a policy é a mesma para as duas actions.
--
-- POR QUE ALARGAR A POLICY, E NÃO ESTREITAR A ACTION
-- ----------------------------------------------------------------------------
-- Mover peça, emitir termo e mandar para manutenção SÃO operação, e
-- `pode_operar()` é o nome que o próprio projeto dá a isso. Toda tabela
-- operacional irmã já usa essa função: `custodia_peca` (insert e update),
-- `movimento_estoque` (insert), `termo_equipamento` (all). `equipamento_unidade`
-- era a exceção, e é a exceção que estava errada. Estreitar `moverPeca` para
-- `pode_gerir_cadastros()` deixaria o almoxarife sem poder mover a própria
-- peça — e não corrigiria o bug do termo, que precisa do mesmo alargamento.
--
-- TRADE-OFF ACEITO
-- ----------------------------------------------------------------------------
-- RLS é por LINHA, não por coluna: alargar `equip_unidade_update` para
-- `pode_operar()` também dá a um operador com acesso direto à API (fora da
-- aplicação) o poder de alterar `identificador` e `numero_serie` — colunas que
-- `editarPeca` restringe a `podeEditarCadastros()` (master/administrador) só
-- na camada de aplicação, via `editarPecaSchema`. Uma trigger de proteção por
-- coluna foi considerada e REJEITADA: maquinaria desproporcional para um papel
-- interno que já emite termo assinado (`termo_equipamento`, policy `all`) e
-- movimenta estoque (`movimento_estoque`, insert) sem essa granularidade.
--
-- `equip_unidade_insert` NÃO muda: criar peça continua ato de cadastro, e
-- fica em `pode_gerir_cadastros()`.
-- ============================================================================

drop policy if exists "equip_unidade_update" on public.equipamento_unidade;
create policy "equip_unidade_update" on public.equipamento_unidade
  for update to authenticated
  using (org_id = (select public.current_org_id()) and (select public.pode_operar()))
  with check (org_id = (select public.current_org_id()) and (select public.pode_operar()));
