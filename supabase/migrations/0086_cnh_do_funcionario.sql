-- ============================================================================
-- A CNH de quem dirige
-- ============================================================================
--
-- O RISCO QUE SÓ A FROTA DE VEÍCULOS TRAZ. Hoje o Loca entregaria um carro a
-- alguém com a habilitação vencida e não teria como saber: `funcionario` tem
-- CPF, cargo, matrícula, telefone e e-mail — e nenhuma linha sobre dirigir.
--
-- Dirigir com CNH vencida há mais de 30 dias é infração gravíssima, sete pontos,
-- multa e retenção do veículo. Com a empresa como proprietária, a autuação vai
-- para a empresa.
--
-- POR QUE NÃO É UM `certificado_equipamento`. A estrutura de certificados que
-- nasceu hoje resolve exatamente este formato de problema — documento com
-- validade, que vence por calendário e precisa avisar antes. Mas ela está presa
-- à PEÇA, e a CNH é da PESSOA: ela vale para todos os carros que o funcionário
-- dirigir, e continua valendo quando ele devolve o carro. Amarrá-la a uma peça
-- faria a mesma habilitação ser cadastrada de novo a cada troca de veículo, e
-- as cópias divergiriam na primeira renovação.
--
-- Colunas, e não tabela: é UM documento por pessoa, sem histórico que alguém vá
-- consultar. Renovou, o número muda e a validade nova substitui a antiga —
-- ninguém precisa saber qual era a CNH de 2019.

alter table public.funcionario
  add column if not exists cnh           text,
  add column if not exists cnh_categoria text,
  add column if not exists cnh_validade  date;

-- Categoria é lista fechada e é a da resolução do Contran. Sem isso convivem
-- 'B', 'b', 'AB' e 'A/B' na mesma coluna, e a pergunta "quem pode dirigir o
-- caminhão" deixa de ter resposta confiável.
--
-- Combinações e não letras soltas: quem tem AB tem as duas, e guardar 'A' e 'B'
-- em duas linhas exigiria uma tabela para uma pergunta que é de uma coluna só.
alter table public.funcionario
  drop constraint if exists funcionario_cnh_categoria_check;

alter table public.funcionario
  add constraint funcionario_cnh_categoria_check
  check (cnh_categoria is null or cnh_categoria in (
    'A', 'B', 'AB', 'C', 'AC', 'D', 'AD', 'E', 'AE'));

-- Validade sem número é registro pela metade, e número sem validade é o caso
-- perigoso: o sistema diria que a pessoa é habilitada e não saberia até quando.
alter table public.funcionario
  drop constraint if exists funcionario_cnh_completa;

alter table public.funcionario
  add constraint funcionario_cnh_completa
  check (
    (cnh is null and cnh_validade is null)
    or (cnh is not null and cnh_validade is not null)
  );

-- O índice serve à pergunta "quem está com a CNH vencendo", que o alerta faz
-- uma vez por dia varrendo a organização inteira.
create index if not exists idx_funcionario_cnh_validade
  on public.funcionario (org_id, cnh_validade)
  where cnh_validade is not null and ativo;

comment on column public.funcionario.cnh_validade is
  'Vencimento da habilitacao. Dirigir vencida ha mais de 30 dias e infracao gravissima, e a autuacao vai para a empresa quando o veiculo e dela.';

notify pgrst, 'reload schema';
