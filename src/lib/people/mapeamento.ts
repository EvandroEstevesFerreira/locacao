import {
  SITUACAO_PEOPLE_INFO,
  type PessoaPeople,
  type SituacaoPeople,
} from "./contrato";

/**
 * De pessoa do People para linha de `funcionario`.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * Tudo aqui é PURO e sem I/O, porque é onde estão as regras que doem quando
 * erram — e regra que só roda contra um endpoint que ainda não existe não tem
 * como ser conferida.
 */

/**
 * A linha que vai para o `upsert`.
 *
 * ┌─ AS TRÊS COLUNAS DE CNH NÃO ESTÃO AQUI, E É O PONTO ────────────────────┐
 * │ O People NÃO GUARDA CNH — não há coluna para isso em tabela nenhuma lá. │
 * │ `cnh`, `cnh_categoria` e `cnh_validade` continuam sendo do Loca.        │
 * │                                                                         │
 * │ Um `upsert` que montasse o objeto a partir da pessoa inteira apagaria as │
 * │ três em silêncio, e ninguém notaria até alguém perguntar quem pode       │
 * │ dirigir o caminhão. Por isso o tipo é FECHADO e a ausência delas tem     │
 * │ teste próprio.                                                          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
export type LinhaFuncionario = {
  org_id: string;
  people_id: string;
  nome: string;
  cpf: string | null;
  matricula: string | null;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  email_confirmado: boolean;
  situacao_people: SituacaoPeople;
  ativo: boolean;
  obra_id: string | null;
  sincronizado_em: string;
};

/**
 * `ativo` e `afastado` são `true`; `desligado` é `false`.
 *
 * A situação crua vai junto, em `situacao_people`. Colapsar os três num
 * booleano perderia a distinção que importa para quem está com equipamento: de
 * quem se cobra a devolução hoje.
 */
export function ehAtivo(situacao: SituacaoPeople): boolean {
  return SITUACAO_PEOPLE_INFO[situacao].ativo;
}

/**
 * O código do centro de resultado do People vira `obra_id` do Loca.
 *
 * SEM CORRESPONDÊNCIA, NULO. Chutar por semelhança de nome colocaria
 * equipamento na obra errada, e o erro só apareceria numa cobrança. O contrato
 * avisa que os códigos já divergiram historicamente entre sistemas da casa.
 */
export function resolverObra(
  centroCusto: { codigo: string } | null,
  deParaObra: Map<string, string>,
): string | null {
  if (!centroCusto) return null;
  return deParaObra.get(centroCusto.codigo.trim()) ?? null;
}

/**
 * Normaliza o e-mail para o formato em que o índice único da 0074 o compara.
 *
 * O índice é `(org_id, lower(email))`: `Fulano@` e `fulano@` são o mesmo
 * endereço, e gravar os dois casos diferentes derrubaria a segunda gravação com
 * violação de unicidade no meio de uma rodada.
 *
 * String vazia vira nulo. O contrato diz que campo ausente vem `null`
 * explícito, mas `""` atravessando o índice único faria duas pessoas sem
 * e-mail colidirem — e o índice é parcial justamente para permitir muitas
 * pessoas sem endereço.
 */
export function normalizarEmail(email: string | null): string | null {
  if (email === null) return null;
  const limpo = email.trim().toLowerCase();
  return limpo === "" ? null : limpo;
}

/**
 * Uma pessoa do People, pronta para gravar.
 *
 * O E-MAIL DO PEOPLE MANDA, INCLUSIVE QUANDO É NULO. O Loca tem 97 endereços
 * deduzidos de `nome.sobrenome@sistenge.com`, todos com `email_confirmado =
 * false` — palpites que ninguém conferiu. Palpite não confirmado perde para o
 * silêncio de quem é fonte da verdade.
 *
 * `email_confirmado` acompanha: endereço que veio do cadastro oficial É
 * confirmado, e endereço ausente não tem o que confirmar.
 */
export function mapearPessoa(
  pessoa: PessoaPeople,
  orgId: string,
  deParaObra: Map<string, string>,
  agoraISO: string,
): LinhaFuncionario {
  const email = normalizarEmail(pessoa.email);
  return {
    org_id: orgId,
    people_id: pessoa.id,
    nome: pessoa.nome.trim(),
    cpf: pessoa.cpf,
    matricula: pessoa.matricula,
    cargo: pessoa.cargo,
    telefone: pessoa.telefone,
    email,
    email_confirmado: email !== null,
    situacao_people: pessoa.situacao,
    ativo: ehAtivo(pessoa.situacao),
    obra_id: resolverObra(pessoa.centro_custo, deParaObra),
    sincronizado_em: agoraISO,
  };
}

/**
 * O maior `atualizado_em` do lote — o cursor da próxima rodada.
 *
 * Comparação de STRING, e não de `Date`. O contrato entrega ISO 8601 com fuso,
 * e ISO com o mesmo fuso ordena lexicograficamente na mesma ordem que
 * cronologicamente. Converter para `Date` só acrescentaria uma chance de o
 * fuso do servidor se meter no meio.
 *
 * Lote vazio devolve o cursor anterior, e não `null`: uma rodada sem novidade
 * NÃO PODE ZERAR o delta, ou a rodada seguinte varreria as 483 de novo.
 */
export function proximoCursor(
  pessoas: { atualizado_em: string }[],
  cursorAtual: string | null,
): string | null {
  let maior = cursorAtual;
  for (const p of pessoas) {
    if (maior === null || p.atualizado_em > maior) maior = p.atualizado_em;
  }
  return maior;
}

/**
 * Tira as repetidas, ficando com a mais recente de cada `people_id`.
 *
 * O CONTRATO AVISA QUE ISSO ACONTECE: uma pessoa atualizada no meio de uma
 * varredura pode chegar duas vezes, porque o People falha deliberadamente para
 * o lado de repetir e nunca de perder.
 *
 * Sem esta passagem, o `upsert` levaria duas linhas com a mesma chave no mesmo
 * comando — o Postgres recusa isso com "ON CONFLICT DO UPDATE command cannot
 * affect row a second time", e a rodada inteira morreria por causa de uma
 * pessoa que mudou de cargo na hora errada.
 *
 * Há também cinco pessoas com dois cadastros no People, por um bug de import.
 * Essas têm `people_id` DIFERENTES e passam as duas de propósito: são duas
 * linhas legítimas até o People mesclá-las.
 */
export function semRepetidas(pessoas: PessoaPeople[]): PessoaPeople[] {
  const porId = new Map<string, PessoaPeople>();
  for (const p of pessoas) {
    const anterior = porId.get(p.id);
    if (!anterior || p.atualizado_em >= anterior.atualizado_em) porId.set(p.id, p);
  }
  return [...porId.values()];
}

/** De quantos em quantos dias a varredura completa roda. */
export const DIAS_ENTRE_VARREDURAS = 7;

/**
 * Hoje é dia de varrer tudo?
 *
 * A sincronização de todo dia é DELTA: traz só quem mudou, e é barata. Mas
 * ausência não é mudança — quem foi mesclado no People nunca mais aparece em
 * resposta nenhuma, e o delta não tem como notar o buraco.
 *
 * A varredura completa é a única que pode marcar alguém como sumido. Marcar a
 * partir de um delta acusaria de ausente todo mundo que simplesmente não mudou
 * nada naquele dia — ou seja, quase todos.
 *
 * Nunca varrida devolve `true`: a primeira rodada é completa por natureza,
 * porque não há cursor de onde partir.
 */
export function precisaVarreduraCompleta(
  ultima: string | null,
  agoraISO: string,
): boolean {
  if (!ultima) return true;
  const dias =
    (Date.parse(agoraISO) - Date.parse(ultima)) / (1000 * 60 * 60 * 24);
  // `NaN` (data ilegível) cai para varrer: errar para o lado de conferir
  // demais custa cinco requisições; para o outro, custa não notar que alguém
  // sumiu.
  return !(dias < DIAS_ENTRE_VARREDURAS);
}

/**
 * Quem estava vinculado e NÃO veio na varredura completa.
 *
 * Devolve os `people_id` órfãos — provável merge de cadastro duplicado do lado
 * do People, ou pessoa que saiu do recorte de 2026.
 *
 * NÃO É EXCLUSÃO, e não deve virar uma. A linha continua com o histórico de
 * equipamento de alguém que talvez ainda esteja com ele; o que se ganha aqui é
 * saber que ela parou de ser atualizada.
 */
export function ausentesNaVarredura(
  vinculadosLocais: string[],
  recebidos: string[],
): string[] {
  const veio = new Set(recebidos);
  return vinculadosLocais.filter((id) => !veio.has(id));
}

/**
 * Apaga valores que colidiriam nos índices únicos do Loca.
 *
 * O PROBLEMA, ENCONTRADO NA PRIMEIRA SINCRONIZAÇÃO DE VERDADE. Cinco pessoas
 * têm hoje dois cadastros no People, por um bug de import da ADP — dois
 * `people_id` diferentes para o mesmo ser humano, e portanto o MESMO CPF. O
 * Loca tem `idx_funcionario_cpf` único em `(org_id, cpf)`, e o lote inteiro
 * morria com "duplicate key value violates unique constraint".
 *
 * `semRepetidas` não pega isto: lá as duas linhas têm a mesma chave e uma
 * vence. Aqui são DUAS PESSOAS legítimas do ponto de vista do People, e as duas
 * têm de entrar — o que não pode entrar duas vezes é o CPF.
 *
 * ┌─ POR QUE APAGAR O VALOR, E NÃO A LINHA ──────────────────────────────────┐
 * │ Descartar um dos cadastros esconderia um vínculo que existe do lado do    │
 * │ People, e é por um deles que alguém pode estar com equipamento. Some o    │
 * │ CPF do perdedor, que é dado repetido e recuperável: quando o People       │
 * │ mesclar os dois, o sobrevivente continua com o dele.                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Quem fica com o valor é o cadastro ATUALIZADO MAIS RECENTEMENTE — o mais
 * provável de ser o que sobrevive à mescla. Empate resolve por `id`, para a
 * rodada de amanhã decidir igual à de hoje.
 *
 * `email` entra junto por ser o outro índice único da tabela. Hoje não há
 * nenhum repetido no People; a guarda existe porque uma mescla mal feita lá
 * produziria exatamente isso, e o sintoma seria de novo o lote inteiro morrendo.
 */
export function resolverColisoes(pessoas: PessoaPeople[]): PessoaPeople[] {
  const ordenadas = [...pessoas].sort((a, b) =>
    a.atualizado_em === b.atualizado_em
      ? a.id.localeCompare(b.id)
      : b.atualizado_em.localeCompare(a.atualizado_em),
  );

  const cpfVisto = new Set<string>();
  const emailVisto = new Set<string>();
  const ajustadas = new Map<string, PessoaPeople>();

  for (const p of ordenadas) {
    let cpf = p.cpf;
    let email = p.email;

    if (cpf) {
      if (cpfVisto.has(cpf)) cpf = null;
      else cpfVisto.add(cpf);
    }

    const chaveEmail = normalizarEmail(email);
    if (chaveEmail) {
      if (emailVisto.has(chaveEmail)) email = null;
      else emailVisto.add(chaveEmail);
    }

    ajustadas.set(p.id, { ...p, cpf, email });
  }

  // Devolve na ordem em que chegou: a ordenação acima é só para decidir quem
  // fica com o valor, e trocar a ordem do lote não é assunto desta função.
  return pessoas.map((p) => ajustadas.get(p.id)!);
}

/** Uma linha local, do ponto de vista das chaves únicas. */
export type ChaveLocal = {
  id: string;
  people_id: string | null;
  email: string | null;
  cpf: string | null;
};

/**
 * As linhas locais que SEGURAM uma chave que o People diz ser de outra pessoa.
 *
 * O PROBLEMA, ENCONTRADO NA TERCEIRA TENTATIVA DA PRIMEIRA SINCRONIZAÇÃO:
 *
 *   duplicate key value violates unique constraint "idx_funcionario_email"
 *
 * Não era duplicata dentro do People — lá os e-mails são todos distintos. Era
 * um endereço DEDUZIDO, gravado no Loca antes da integração, sentado numa linha
 * ainda não conciliada, enquanto o People manda o mesmo endereço para o
 * cadastro de quem ele realmente é.
 *
 * O People é a fonte da verdade de pessoa. Se ele diz que `fulano@` é da pessoa
 * P, nenhuma outra linha daqui pode segurar aquele endereço — e-mail
 * corporativo não é compartilhado. Então a chave é LIBERADA de quem a segura,
 * e o dono recebe a dele na mesma rodada.
 *
 * ┌─ LIBERA A CHAVE, NÃO APAGA A LINHA ──────────────────────────────────────┐
 * │ A linha que perde o e-mail continua existindo, com nome, obra e histórico │
 * │ de equipamento. O que ela perde é um palpite que pertencia a outro \u2014     │
 * │ e mantê-lo faria o termo de responsabilidade de uma pessoa chegar na      │
 * │ caixa de outra, que é o incidente que `email_confirmado` existe para      │
 * │ evitar.                                                                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Linha já vinculada à MESMA pessoa não entra: ali o e-mail é dela mesma, e o
 * upsert vai simplesmente reescrevê-lo.
 */
export function chavesALiberar(
  locais: ChaveLocal[],
  entrando: { people_id: string; email: string | null; cpf: string | null }[],
): { email: string[]; cpf: string[] } {
  const donoDoEmail = new Map<string, string>();
  const donoDoCpf = new Map<string, string>();
  for (const l of entrando) {
    if (l.email) donoDoEmail.set(l.email, l.people_id);
    if (l.cpf) donoDoCpf.set(l.cpf, l.people_id);
  }

  const email: string[] = [];
  const cpf: string[] = [];
  for (const f of locais) {
    const e = normalizarEmail(f.email);
    if (e && donoDoEmail.has(e) && donoDoEmail.get(e) !== f.people_id) {
      email.push(f.id);
    }
    if (f.cpf && donoDoCpf.has(f.cpf) && donoDoCpf.get(f.cpf) !== f.people_id) {
      cpf.push(f.id);
    }
  }
  return { email, cpf };
}
