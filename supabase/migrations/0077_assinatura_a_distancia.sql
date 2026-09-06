-- ============================================================================
-- Assinatura à distância — fase C.2
-- (docs/superpowers/specs/2026-09-05-inventario-ti-design.md)
--
-- ESTA É A PRIMEIRA PORTA PÚBLICA DO LOCA.
--
-- O middleware libera `/login`, `/auth` e `/offline`; todo o resto exige
-- sessão. Nenhuma rota deste sistema jamais devolveu dado a quem não entrou.
-- Por isso o desenho aqui é mais apertado do que o de qualquer outra migration.
--
-- A PROVA. A pergunta que sustenta o documento é "como se sabe que foi ele quem
-- assinou?". No presencial a resposta é "o operador estava presente". Aqui é:
-- o link foi ao e-mail corporativo CONFERIDO da pessoa E ela digitou o próprio
-- CPF. Dois fatores fracos que, juntos, sustentam a afirmação.
--
-- NASCE INERTE, E ISSO É PROPOSITAL: hoje NENHUM dos 118 funcionários tem CPF
-- cadastrado. Sem CPF a função recusa, e a tela avisa antes de gerar o link.
-- Um link que nunca destrava é pior que nenhum link.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- termo_link
-- ---------------------------------------------------------------------------
create table if not exists public.termo_link (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.organizacao (id) on delete cascade,
  termo_id   uuid not null references public.termo_equipamento (id) on delete cascade,

  -- O TOKEN NÃO É GRAVADO. Só o sha256 dele.
  --
  -- O token em claro existe no e-mail do funcionário e em lugar nenhum mais: se
  -- o banco vazar, os links não vazam junto. É a mesma razão pela qual senha
  -- não se guarda em texto — e um link destes assina um documento.
  token_hash text not null unique,

  expira_em  timestamptz not null,

  -- Uso único. `usado_em` marcado fecha o link para sempre; reabrir a página
  -- depois mostra "já assinado" em vez do documento.
  usado_em   timestamptz,

  -- Revogação é para quando o link foi para o endereço errado. Sem ela, a única
  -- saída seria esperar os 7 dias.
  revogado_em timestamptz,

  criado_por uuid references public.perfil (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_termo_link_termo
  on public.termo_link (termo_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — a tabela é do operador; o público NÃO a lê
-- ---------------------------------------------------------------------------
-- A página pública não faz `select` nesta tabela. Ela chama as funções abaixo,
-- que são `security definer` e devolvem só o que o hash destrava. A RLS aqui
-- protege a tabela de quem ESTÁ logado — o operador de outra organização.
alter table public.termo_link enable row level security;

drop policy if exists "termo_link_select" on public.termo_link;
drop policy if exists "termo_link_write"  on public.termo_link;

create policy "termo_link_select" on public.termo_link
  for select to authenticated
  using (org_id = (select public.current_org_id()));

create policy "termo_link_write" on public.termo_link
  for all to authenticated
  using (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  )
  with check (
    org_id = (select public.current_org_id())
    and (select public.pode_operar())
  );

-- ---------------------------------------------------------------------------
-- A leitura pública
-- ---------------------------------------------------------------------------
-- `security definer` em vez de `createAdminClient()` na aplicação.
--
-- A regra do AGENTS.md existe porque o isolamento por organização depende de
-- RLS, e um handle admin genérico numa ROTA PÚBLICA é a pior versão desse furo:
-- bastaria um bug de parâmetro para a página devolver o termo de outra empresa.
-- Aqui o escopo é imposto pelo BANCO — a função devolve exclusivamente o termo
-- que aquele hash destrava, e a aplicação nunca ganha o handle.
--
-- Devolve `null` para link inexistente, vencido, usado ou revogado. Os quatro
-- casos são o mesmo `null` de propósito: distinguir "não existe" de "vencido"
-- diria a um curioso que aquele hash já foi um link válido.
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

  -- Termo já emitido ou cancelado não tem o que assinar. Um link vivo apontando
  -- para um deles é sinal de que o operador emitiu pela tela depois de mandar
  -- o link — e a página tem de dizer isso, não deixar assinar de novo.
  if v_termo.emitido_em is not null or v_termo.cancelado_em is not null then
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

revoke all on function public.termo_do_link(text) from public;
grant execute on function public.termo_do_link(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A conferência do CPF
-- ---------------------------------------------------------------------------
-- Separada da assinatura porque falha de CPF NÃO pode gastar o link: quem erra
-- um dígito tem de poder tentar de novo. Devolve só verdadeiro/falso — nunca o
-- CPF, nem quantos dígitos batem.
--
-- Compara só os ALGARISMOS: o cadastro pode ter `123.456.789-00` e a pessoa
-- digitar `12345678900`. São o mesmo CPF, e recusar por pontuação seria recusar
-- por nada.
create or replace function public.conferir_cpf_do_link(p_token_hash text, p_cpf text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cpf text;
begin
  select regexp_replace(f.cpf, '\D', '', 'g') into v_cpf
  from public.termo_link l
  join public.termo_equipamento t on t.id = l.termo_id
  join public.funcionario f on f.id = t.funcionario_id
  where l.token_hash = p_token_hash
    and l.usado_em is null
    and l.revogado_em is null
    and l.expira_em > now();

  if v_cpf is null or length(v_cpf) <> 11 then return false; end if;
  return v_cpf = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
end;
$$;

revoke all on function public.conferir_cpf_do_link(text, text) from public;
grant execute on function public.conferir_cpf_do_link(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A assinatura
-- ---------------------------------------------------------------------------
-- Grava a assinatura do funcionário e QUEIMA O LINK, na mesma transação. O
-- `for update` e a recontagem das condições dentro do lock são o que impede
-- dois cliques simultâneos de assinarem duas vezes.
--
-- NÃO EMITE O TERMO. A emissão move peças, numera e manda a via — trabalho que
-- já existe em `emitirTermo` e que exige sessão. Esta função registra a
-- assinatura e devolve o `termo_id`; quem emite é o operador, pela tela, vendo
-- que a assinatura chegou. Duplicar a emissão aqui seria a segunda cópia da
-- regra mais cara do módulo.
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
  if v_termo.emitido_em is not null or v_termo.cancelado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'Este termo não está mais aguardando assinatura.');
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

revoke all on function public.assinar_termo_por_link(text, text, text, text) from public;
grant execute on function public.assinar_termo_por_link(text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
