-- ============================================================================
-- Assinar o termo DEPOIS da emissão
-- ============================================================================
--
-- O PEDIDO. A assinatura do funcionário passa a ser opcional na emissão: emite
-- agora, manda a via com o link, colhe a assinatura depois. Hoje isso é
-- impossível -- e a trava não está no formulário, está AQUI.
--
-- As duas funções da 0077 recusam termo emitido:
--
--   if v_termo.emitido_em is not null or v_termo.cancelado_em is not null
--
-- em `termo_do_link` (a que abre a página) e em `assinar_termo_por_link` (a que
-- grava). São funções `security definer` com `revoke all from public`: a trava
-- que decide quem pode assinar um documento de responsabilidade.
--
-- O RECORTE, e por que ele é estreito. `cancelado_em` continua barrando SEMPRE.
-- `emitido_em` passa a barrar só quando a assinatura do funcionário JÁ existe --
-- ou seja, termo emitido E assinado volta a ser intocável, que é o estado final
-- desejado. A alternativa "termo emitido é editável" abriria caminho para
-- alterar assinatura já colhida, e é exatamente o que um termo de
-- responsabilidade não pode permitir.
--
-- NÃO CRIA `momento = 'ratificacao'`. Seria mais registro histórico e é
-- desnecessário: `termo_assinatura` já grava `assinado_em` e `assinado_ip` por
-- linha, então a data em que a assinatura veio -- depois da emissão -- já fica
-- registrada sem coluna nem enum novo.
--
-- Os corpos abaixo são os da 0077 com a guarda trocada, e nada mais. `create or
-- replace` preserva dono e privilégios, mas o `revoke`/`grant` é reemitido no
-- fim por ser idempotente e por deixar a permissão visível junto da função.
--
-- ---------------------------------------------------------------------------
-- E A CORRIDA QUE O RECORTE ABRE
-- ---------------------------------------------------------------------------
-- A guarda nova é um `exists`: dois links válidos usados ao mesmo tempo podem
-- passar os dois antes de qualquer insert, e o termo ficaria com DUAS
-- assinaturas do mesmo funcionário -- o PDF mostraria duas linhas para uma
-- pessoa, e quem confere não saberia qual traço vale. O `for update` da 0077
-- protege UM link, não dois.
--
-- O índice único no fim fecha isso por construção. Medido antes de aplicar,
-- em 2026-09-09: `duplicadas = 0` sobre 4 assinaturas em 2 termos emitidos.
-- ============================================================================

create or replace function public.termo_do_link(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link  record;
  v_termo record;
  v_func  record;
begin
  select * into v_link
  from public.termo_link
  where token_hash = p_token_hash
    and usado_em is null
    and revogado_em is null
    and expira_em > now();
  if not found then return null; end if;

  select t.id, t.data_entrega, t.previsao_devolucao, t.observacoes,
         t.emitido_em, t.cancelado_em, t.funcionario_id,
         o.codigo obra_codigo, o.nome obra_nome
    into v_termo
  from public.termo_equipamento t
  left join public.obra o on o.id = t.obra_id
  where t.id = v_link.termo_id;
  if not found then return null; end if;

  -- CANCELADO barra sempre. EMITIDO barra só se a assinatura do funcionário JÁ
  -- existir -- é esse o recorte que permite emitir agora e colher a assinatura
  -- depois, sem abrir "documento emitido é editável".
  if v_termo.cancelado_em is not null then
    return jsonb_build_object('estado', 'indisponivel');
  end if;
  if v_termo.emitido_em is not null
     and exists (
       select 1 from public.termo_assinatura a
       where a.termo_id = v_termo.id
         and a.momento = 'entrega'
         and a.papel = 'funcionario'
     ) then
    return jsonb_build_object('estado', 'indisponivel');
  end if;

  select nome, cpf into v_func
  from public.funcionario where id = v_termo.funcionario_id;

  -- SEM CPF NÃO HÁ COMO CONFERIR, e assinar sem conferir é o oposto do que
  -- este caminho existe para fazer. Hoje isso vale para os 118 funcionários.
  if v_func.cpf is null or length(regexp_replace(v_func.cpf, '\D', '', 'g')) <> 11 then
    return jsonb_build_object('estado', 'sem_cpf');
  end if;

  return jsonb_build_object(
    'estado', 'pronto',
    'termo_id', v_termo.id,
    -- O NOME VAI, O CPF NÃO. Quem abriu precisa reconhecer o documento como
    -- seu; devolver o CPF transformaria a conferência em cópia e colagem.
    'funcionario', v_func.nome,
    'obra', nullif(concat_ws(' — ', v_termo.obra_codigo, v_termo.obra_nome), ''),
    'data_entrega', v_termo.data_entrega,
    'previsao_devolucao', v_termo.previsao_devolucao,
    'observacoes', v_termo.observacoes,
    'itens', coalesce((
      select jsonb_agg(jsonb_build_object(
               'descricao', i.descricao,
               'patrimonio', u.identificador,
               'quantidade', ti.quantidade,
               'unidade', i.unidade,
               'estado_entrega', ti.estado_entrega
             ) order by i.descricao)
      from public.termo_equipamento_item ti
      join public.item_catalogo i on i.id = ti.item_id
      left join public.equipamento_unidade u on u.id = ti.unidade_id
      where ti.termo_id = v_termo.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.assinar_termo_por_link(
  p_token_hash text,
  p_cpf        text,
  p_imagem     text,
  p_ip         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link  record;
  v_termo record;
  v_func  record;
  v_ip    inet;
begin
  -- `assinado_ip` e do tipo `inet`. Um `x-forwarded-for` malformado — cabecalho
  -- que qualquer intermediario pode estragar — NAO pode custar a assinatura:
  -- o IP e evidencia acessoria, a assinatura e o ato. Cast que falha vira nulo.
  begin
    v_ip := nullif(trim(coalesce(p_ip, '')), '')::inet;
  exception when others then
    v_ip := null;
  end;

  select * into v_link
  from public.termo_link
  where token_hash = p_token_hash
  for update;

  if not found
     or v_link.usado_em is not null
     or v_link.revogado_em is not null
     or v_link.expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'Este link não é mais válido.');
  end if;

  select t.id, t.funcionario_id, t.emitido_em, t.cancelado_em into v_termo
  from public.termo_equipamento t where t.id = v_link.termo_id;
  -- CANCELADO barra sempre. EMITIDO barra só se a assinatura do funcionário JÁ
  -- existir -- é esse o recorte que permite emitir agora e colher a assinatura
  -- depois, sem abrir "documento emitido é editável".
  if v_termo.cancelado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'Este termo foi cancelado.');
  end if;
  if v_termo.emitido_em is not null
     and exists (
       select 1 from public.termo_assinatura a
       where a.termo_id = v_termo.id
         and a.momento = 'entrega'
         and a.papel = 'funcionario'
     ) then
    return jsonb_build_object('ok', false, 'motivo', 'Este termo já foi assinado pelo funcionário.');
  end if;

  select nome, regexp_replace(cpf, '\D', '', 'g') cpf into v_func
  from public.funcionario where id = v_termo.funcionario_id;

  if v_func.cpf is null
     or v_func.cpf <> regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g') then
    -- CPF errado NÃO queima o link: um dígito trocado não pode custar o
    -- documento. A recusa é a mesma frase da inexistência, para não confirmar
    -- a um curioso que o link é bom.
    return jsonb_build_object('ok', false, 'motivo', 'CPF não confere.');
  end if;

  insert into public.termo_assinatura
    (org_id, termo_id, momento, papel, nome, cpf, imagem, assinado_ip)
  values
    (v_link.org_id, v_termo.id, 'entrega', 'funcionario',
     v_func.nome, v_func.cpf, p_imagem, v_ip);

  update public.termo_link set usado_em = now() where id = v_link.id;

  return jsonb_build_object('ok', true, 'termo_id', v_termo.id, 'funcionario', v_func.nome);
end;
$$;

revoke all on function public.termo_do_link(text) from public;
grant execute on function public.termo_do_link(text) to anon, authenticated;
revoke all on function public.assinar_termo_por_link(text, text, text, text) from public;
grant execute on function public.assinar_termo_por_link(text, text, text, text) to anon, authenticated;

-- Uma assinatura por papel, por momento, por termo.
create unique index if not exists idx_termo_assinatura_unica
  on public.termo_assinatura (termo_id, momento, papel);

notify pgrst, 'reload schema';
