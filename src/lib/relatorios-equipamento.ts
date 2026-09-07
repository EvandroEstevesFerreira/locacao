// Os três relatórios do ciclo físico do equipamento — fase 4.
//
// Em arquivo próprio porque `relatorios.ts` já passava de novecentas linhas, e
// porque estes três nascem de um dado que não existia até a fase 2: devolução
// não era documento, avaria não tinha responsável e reparo de equipamento não
// existia.
//
// SEM `import "server-only"`, ao contrário do resto de `src/lib/data/`, e a
// razão é indireta: quem importa daqui é `relatorios.ts`, e ELE é importado por
// um componente cliente — `configuracoes/config-relatorio-form.tsx` precisa de
// `TIPOS_RELATORIO` para montar o seletor. `server-only` aqui envenena a cadeia
// inteira e o build quebra em cinco lugares que não têm nada a ver com isto.
//
// A proteção real não é a diretiva: estas funções recebem o `supabase` de quem
// chama e não abrem cliente nenhum, então não há credencial a vazar.
//
// Eles NÃO engolem erro. `gerarRelatorio` alimenta PDF, Excel e e-mail de cron:
// um `[]` silencioso aqui produziria um relatório plausível e errado entregue a
// um cliente (regra do AGENTS.md). Quem chama trata; `(app)/error.tsx` é a rede.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hojeISOSaoPaulo,
  hojeSaoPaulo,
  dataDeISO,
  periodosEntre,
  type Cadencia,
} from "./locacao";
import type { Relatorio, FiltrosRelatorio, Coluna } from "./relatorios";
import {
  faltaAteRevisao,
  estadoRevisao,
  ESTADO_REVISAO_INFO,
} from "./apontamento";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = SupabaseClient<any, any, any>;

/**
 * Dias de calendário entre duas datas ISO, podendo ser NEGATIVO.
 *
 * Diferente de `diasDePosse`, que trunca em zero: aqui o negativo é informação
 * — "faltam 3 dias para o prazo" é diferente de "no prazo", e a coluna de
 * atraso perde o sentido se todo prazo futuro virar zero.
 *
 * A conta é feita em UTC a partir das partes da data, e não com `new Date(iso)`:
 * as colunas são `date`, o Vercel roda em UTC, e um `Date` construído de um
 * instante deslocaria o dia.
 */
function diasEntre(de: string, ate: string): number {
  const parse = (s: string) => {
    const [a, m, d] = s.split("-").map(Number);
    return Date.UTC(a, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(ate) - parse(de)) / 86_400_000);
}

type Bruta = Record<string, unknown>;
type ContratoEmbed = {
  numero?: string;
  obra_id?: string;
  fornecedor_id?: string;
  obra: { codigo: string; nome: string } | null;
  fornecedor: { nome: string } | null;
} | null;

/**
 * Conferência pendente — o relatório que mais vale dinheiro dos três.
 *
 * DEVOLUÇÃO EM RASCUNHO é o caso caro: o equipamento já saiu da obra, o saldo
 * não baixou, e o contrato segue cobrando diária por ele. Ninguém vê, porque a
 * tela do contrato mostra o item como em aberto — e está certa. O que não
 * aconteceu foi o fechamento do documento.
 *
 * RECEBIMENTO EM RASCUNHO é o inverso: a retirada não foi carimbada, então o
 * custo daquele equipamento está AUSENTE do contrato, e a obra parece mais
 * barata do que é.
 *
 * FECHADO SEM AVISO é o terceiro: o fornecedor não sabe que o equipamento
 * voltou, e é isso que ele vai alegar quando cobrar.
 */
export async function conferenciaPendente(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeISOSaoPaulo();

  const [rec, dev] = await Promise.all([
    supabase
      .from("recebimento")
      .select(
        "numero_registro, recebido_em, status, aviso_enviado_em, contrato:contrato_id(numero, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome))",
      )
      .order("recebido_em"),
    supabase
      .from("devolucao")
      .select(
        "numero_registro, devolvido_em, status, aviso_enviado_em, contrato:contrato_id(numero, obra_id, fornecedor_id, obra:obra_id(codigo,nome), fornecedor:fornecedor_id(nome))",
      )
      .order("devolvido_em"),
  ]);

  if (rec.error) throw rec.error;
  if (dev.error) throw dev.error;

  function montar(
    r: Bruta,
    tipo: string,
    chaveData: string,
    efeito: string,
  ): Record<string, string | number | null> | null {
    const c = r.contrato as ContratoEmbed;
    if (filtros.obra_id && c?.obra_id !== filtros.obra_id) return null;
    if (filtros.fornecedor_id && c?.fornecedor_id !== filtros.fornecedor_id) {
      return null;
    }

    const rascunho = r.status === "rascunho";
    const semAviso = r.status === "fechado" && r.aviso_enviado_em === null;
    if (!rascunho && !semAviso) return null;

    const data = String(r[chaveData] ?? "");
    return {
      tipo,
      registro: (r.numero_registro as string | null) ?? "(sem número)",
      data: data || null,
      obra: c?.obra ? `${c.obra.codigo} — ${c.obra.nome}` : "—",
      contrato: c?.numero ?? "—",
      fornecedor: c?.fornecedor?.nome ?? "—",
      pendencia: rascunho ? "Em rascunho" : "Fornecedor não avisado",
      // O efeito em dinheiro, escrito. Sem esta coluna o relatório é uma lista
      // de tarefas administrativas; com ela, é a conta que está correndo.
      efeito: rascunho ? efeito : "Fornecedor pode cobrar o que já voltou",
      // Dias parados ordenam pela urgência: um rascunho de três dias é
      // esquecimento, um de trinta é dinheiro.
      dias: data ? diasEntre(data, hoje) : 0,
    };
  }

  const linhas = [
    ...(rec.data ?? []).map((r) =>
      montar(
        r as Bruta,
        "Recebimento",
        "recebido_em",
        "Custo do equipamento ausente do contrato",
      ),
    ),
    ...(dev.data ?? []).map((r) =>
      montar(
        r as Bruta,
        "Devolução",
        "devolvido_em",
        "Diária correndo sobre equipamento já devolvido",
      ),
    ),
  ]
    .filter((l): l is Record<string, string | number | null> => l !== null)
    .sort((a, b) => Number(b.dias) - Number(a.dias));

  return {
    titulo: "Conferência pendente",
    agruparPor: "obra",
    colunas: [
      { key: "tipo", label: "Tipo", tipo: "texto" },
      { key: "registro", label: "Registro", tipo: "texto" },
      { key: "data", label: "Data", tipo: "data" },
      { key: "obra", label: "Obra", tipo: "texto" },
      { key: "contrato", label: "Contrato", tipo: "texto" },
      { key: "fornecedor", label: "Fornecedor", tipo: "texto" },
      { key: "pendencia", label: "Pendência", tipo: "texto" },
      { key: "efeito", label: "O que está acontecendo", tipo: "texto" },
      { key: "dias", label: "Dias parado", tipo: "numero" },
    ],
    linhas,
  };
}

/**
 * Equipamento em conserto — onde a máquina está e há quanto tempo.
 *
 * Só ordens ABERTAS e EM EXECUÇÃO. Uma ordem concluída já devolveu a peça, e
 * misturar as duas transformaria um relatório operacional — o que olhar de
 * manhã — num histórico.
 */
export async function equipamentoFora(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeISOSaoPaulo();
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(
      "numero_registro, status, descricao, executor, aberto_em, enviado_em, previsto_para, valor, responsabilidade, unidade:unidade_id(identificador, item:item_id(descricao))",
    )
    .in("status", ["aberto", "em_execucao"])
    .order("enviado_em");

  if (error) throw error;

  const situacao: Record<string, string> = {
    aberto: "Aberta — peça na obra",
    em_execucao: "Em execução — peça fora",
  };
  const paga: Record<string, string> = {
    indefinida: "A apurar",
    fornecedor: "Do fornecedor",
    obra: "Da obra",
    funcionario: "De funcionário",
  };

  // O recorte por obra NÃO se aplica aqui, e é deliberado: a peça é da
  // ORGANIZAÇÃO e circula entre obras, então filtrar por obra esconderia
  // justamente o conserto da máquina que aquela obra vai receber. Mesma razão
  // da RLS por organização na migration 0068.
  void filtros;

  const linhas = (data ?? []).map((r: Bruta) => {
    const un = r.unidade as {
      identificador?: string;
      item: { descricao: string } | null;
    } | null;
    const enviado = (r.enviado_em as string | null) ?? null;
    const previsto = (r.previsto_para as string | null) ?? null;
    return {
      ordem: (r.numero_registro as string | null) ?? "—",
      peca: un?.identificador ?? "—",
      equipamento: un?.item?.descricao ?? "—",
      servico: r.descricao as string,
      oficina: (r.executor as string | null) ?? "—",
      saida: enviado,
      previsto,
      // Positivo = dias de ATRASO. Negativo = ainda dentro do prazo. É a única
      // coluna que alguém precisa olhar de manhã.
      atraso: previsto ? diasEntre(previsto, hoje) : 0,
      dias_fora: enviado ? diasEntre(enviado, hoje) : 0,
      valor: Number(r.valor),
      paga: paga[r.responsabilidade as string] ?? String(r.responsabilidade),
      situacao: situacao[r.status as string] ?? String(r.status),
    };
  });

  return {
    titulo: "Equipamento em conserto",
    colunas: [
      { key: "ordem", label: "Ordem", tipo: "texto" },
      { key: "peca", label: "Peça", tipo: "texto" },
      { key: "equipamento", label: "Equipamento", tipo: "texto" },
      { key: "servico", label: "Serviço", tipo: "texto" },
      { key: "oficina", label: "Oficina", tipo: "texto" },
      { key: "saida", label: "Saída", tipo: "data" },
      { key: "previsto", label: "Previsto", tipo: "data" },
      { key: "atraso", label: "Atraso (dias)", tipo: "numero" },
      { key: "dias_fora", label: "Dias fora", tipo: "numero" },
      { key: "valor", label: "Valor", tipo: "moeda" },
      { key: "paga", label: "Quem paga", tipo: "texto" },
      { key: "situacao", label: "Situação", tipo: "texto" },
    ],
    linhas,
    grafico: { labelKey: "peca", valorKey: "dias_fora" },
  };
}

/**
 * Custo de manutenção por peça.
 *
 * Só ordens CONCLUÍDAS: valor de ordem em aberto é estimativa, e somar
 * estimativa com realizado produz um total que não bate com nada — nem com o
 * financeiro, nem com a nota da oficina.
 */
export async function manutencaoCusto(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const { data, error } = await supabase
    .from("reparo_equipamento")
    .select(
      "concluido_em, valor, unidade_id, unidade:unidade_id(identificador, item:item_id(descricao))",
    )
    .eq("status", "concluido")
    .order("concluido_em");

  if (error) throw error;

  type Acumulado = {
    peca: string;
    equipamento: string;
    ordens: number;
    total: number;
    ultimo: string | null;
  };
  const porPeca = new Map<string, Acumulado>();

  for (const r of (data ?? []) as Bruta[]) {
    const quando = (r.concluido_em as string | null) ?? "";
    if (filtros.inicio && quando < filtros.inicio) continue;
    if (filtros.fim && quando > filtros.fim) continue;

    const un = r.unidade as {
      identificador?: string;
      item: { descricao: string } | null;
    } | null;
    const chave = String(r.unidade_id);
    const atual = porPeca.get(chave) ?? {
      peca: un?.identificador ?? "—",
      equipamento: un?.item?.descricao ?? "—",
      ordens: 0,
      total: 0,
      ultimo: null,
    };
    atual.ordens += 1;
    atual.total += Number(r.valor);
    // A data do ÚLTIMO conserto responde "faz quanto tempo que essa máquina não
    // dá problema" — e é ela que separa a peça que se estabilizou da que está
    // quebrando toda semana.
    if (!atual.ultimo || quando > atual.ultimo) atual.ultimo = quando || null;
    porPeca.set(chave, atual);
  }

  const linhas = [...porPeca.values()]
    .sort((a, b) => b.total - a.total)
    .map((a) => ({
      peca: a.peca,
      equipamento: a.equipamento,
      ordens: a.ordens,
      total: a.total,
      // Média por ordem: uma peça com uma ordem de R$ 3.000 e outra com dez de
      // R$ 300 somam igual e são problemas completamente diferentes — uma
      // quebrou feio uma vez, a outra não para de quebrar.
      medio: a.ordens > 0 ? Math.round((a.total / a.ordens) * 100) / 100 : 0,
      ultimo: a.ultimo,
    }));

  return {
    titulo: "Custo de manutenção",
    colunas: [
      { key: "peca", label: "Peça", tipo: "texto" },
      { key: "equipamento", label: "Equipamento", tipo: "texto" },
      { key: "ordens", label: "Ordens", tipo: "numero" },
      { key: "total", label: "Total gasto", tipo: "moeda" },
      { key: "medio", label: "Média por ordem", tipo: "moeda" },
      { key: "ultimo", label: "Último conserto", tipo: "data" },
    ],
    linhas,
    grafico: { labelKey: "peca", valorKey: "total" },
  };
}

const COLUNAS_USO: Coluna[] = [
  { key: "peca", label: "Peça", tipo: "texto" },
  { key: "equipamento", label: "Equipamento", tipo: "texto" },
  { key: "leitura", label: "Horímetro", tipo: "numero" },
  { key: "ultima_leitura", label: "Última leitura", tipo: "data" },
  { key: "sem_leitura_ha", label: "Sem leitura há (dias)", tipo: "numero" },
  { key: "horas", label: "Horas no período", tipo: "numero" },
  { key: "intervalo", label: "Revisão a cada (h)", tipo: "numero" },
  { key: "faltam", label: "Faltam (h)", tipo: "numero" },
  { key: "revisao", label: "Situação", tipo: "texto" },
];

/**
 * Uso e revisão das peças com horímetro.
 *
 * A OCIOSIDADE QUE ESTE RELATÓRIO MEDE É OUTRA. O relatório `ociosidade` que já
 * existe mede CALENDÁRIO: o item está locado e não foi devolvido. Uma betoneira
 * que está na obra há 40 dias e trabalhou 6 horas não aparece lá — para aquele
 * relatório ela está em uso.
 *
 * Aqui a conta é por HORA TRABALHADA, e só existe para as peças marcadas com
 * horímetro. É o único relatório do sistema que responde "esta máquina
 * compensa?".
 */
export async function usoEquipamento(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const hoje = hojeISOSaoPaulo();

  const { data: pecas, error } = await supabase
    .from("equipamento_unidade")
    .select(
      "id, identificador, item:item_id(descricao, tipo:tipo_id(intervalo_manutencao))",
    )
    .eq("tem_medidor", true)
    .eq("ativo", true)
    .order("identificador");

  if (error) throw error;
  if ((pecas ?? []).length === 0) {
    return { titulo: "Uso do equipamento", colunas: COLUNAS_USO, linhas: [] };
  }

  const { data: aps, error: erroAps } = await supabase
    .from("apontamento_uso")
    .select("unidade_id, data, leitura, horas, revisao")
    .in(
      "unidade_id",
      (pecas ?? []).map((p: Bruta) => p.id),
    )
    .order("data");

  if (erroAps) throw erroAps;

  type Acc = {
    primeira: string;
    ultima: string;
    leitura: number;
    horas: number;
    /**
     * Horas desde a última revisão. Acumulada AQUI e não por
     * `usoDesdeRevisao`, porque esta consulta vem em ordem CRESCENTE: dando
     * um passo por vez para a frente, zerar na revisão é a mesma conta e não
     * exige guardar o histórico inteiro de cada peça em memória.
     *
     * Ignora o filtro de período do relatório de propósito: o estado da revisão
     * é sobre a máquina HOJE, e recortar por mês diria que uma escavadeira
     * revisada em janeiro nunca foi revisada.
     */
    desdeRevisao: number;
  };
  const porPeca = new Map<string, Acc>();

  for (const a of (aps ?? []) as Bruta[]) {
    const quando = String(a.data);
    // O período filtra as HORAS, não as peças: uma máquina sem apontamento no
    // período continua na lista, com zero — e zero é justamente a resposta que
    // este relatório existe para dar.
    const dentro =
      (!filtros.inicio || quando >= filtros.inicio) &&
      (!filtros.fim || quando <= filtros.fim);

    const chave = String(a.unidade_id);
    const atual = porPeca.get(chave) ?? {
      primeira: quando,
      ultima: quando,
      leitura: Number(a.leitura),
      horas: 0,
      desdeRevisao: 0,
    };
    if (quando < atual.primeira) atual.primeira = quando;
    // A consulta vem ordenada por data crescente, então a última que passa
    // aqui é a mais recente — e é dela que sai a leitura atual do horímetro.
    if (quando >= atual.ultima) {
      atual.ultima = quando;
      atual.leitura = Number(a.leitura);
    }
    if (dentro) atual.horas += Number(a.horas);
    // A revisão zera: as horas daquele período foram trabalhadas ANTES dela.
    if (a.revisao) atual.desdeRevisao = 0;
    else atual.desdeRevisao += Number(a.horas);
    porPeca.set(chave, atual);
  }

  const linhas = (pecas ?? []).map((p: Bruta) => {
    const item = (Array.isArray(p.item) ? p.item[0] : p.item) as {
      descricao?: string;
      tipo:
        | { intervalo_manutencao: number | null }
        | { intervalo_manutencao: number | null }[]
        | null;
    } | null;
    const tipo = (Array.isArray(item?.tipo) ? item?.tipo[0] : item?.tipo) as
      | { intervalo_manutencao: number | null }
      | null;
    const acc = porPeca.get(String(p.id)) ?? null;
    const intervalo = tipo?.intervalo_manutencao ?? null;
    const faltam = faltaAteRevisao(acc?.desdeRevisao ?? null, intervalo);

    return {
      peca: p.identificador as string,
      equipamento: item?.descricao ?? "—",
      leitura: acc ? acc.leitura : null,
      ultima_leitura: acc?.ultima ?? null,
      // Dias desde a última leitura: uma peça com horímetro que ninguém lê há
      // três semanas não está "em dia" — está sem informação, e a coluna
      // separa as duas coisas.
      sem_leitura_ha: acc ? diasEntre(acc.ultima, hoje) : 0,
      horas: acc ? acc.horas : 0,
      intervalo,
      faltam,
      revisao: ESTADO_REVISAO_INFO[estadoRevisao(faltam, intervalo)].label,
    };
  });

  return {
    titulo: "Uso do equipamento",
    colunas: COLUNAS_USO,
    linhas,
    grafico: { labelKey: "peca", valorKey: "horas" },
  };
}

const COLUNAS_FRENTE: Coluna[] = [
  { key: "obra", label: "Obra", tipo: "texto" },
  { key: "frente", label: "Frente", tipo: "texto" },
  { key: "itens", label: "Itens", tipo: "numero" },
  { key: "em_aberto", label: "Em aberto", tipo: "numero" },
  { key: "custo", label: "Custo estimado", tipo: "moeda" },
];

/**
 * Custo do equipamento por frente de serviço.
 *
 * O QUE ELE RESPONDE E NENHUM OUTRO RESPONDIA: em QUÊ a obra gastou. Até a
 * 0.68.0 o custo de locação morria na obra — sabia-se que a obra consumiu
 * quarenta mil em equipamento, não que trinta foram na fundação.
 *
 * A linha "(sem frente)" é deliberada e não é sujeira: ela mostra quanto do
 * custo ainda não desceu, e é ela que diz se vale confiar no resto do
 * relatório. Escondê-la faria um rateio parcial parecer completo.
 */
export async function custoPorFrente(
  supabase: DB,
  filtros: FiltrosRelatorio,
): Promise<Relatorio> {
  const { data, error } = await supabase
    .from("item_locado")
    .select(
      "quantidade, valor_unitario_periodo, data_retirada, data_devolucao, status, frente:frente_id(nome), contrato:contrato_id(obra_id, cadencia, cobranca_prorata, obra:obra_id(codigo, nome))",
    )
    .order("created_at");

  if (error) throw error;

  const hoje = hojeSaoPaulo();

  type Acc = { obra: string; frente: string; itens: number; abertos: number; custo: number };
  const grupos = new Map<string, Acc>();

  for (const l of (data ?? []) as Bruta[]) {
    const contrato = (Array.isArray(l.contrato) ? l.contrato[0] : l.contrato) as
      | {
          obra_id?: string;
          cadencia: Cadencia;
          cobranca_prorata: boolean;
          obra: { codigo: string; nome: string } | { codigo: string; nome: string }[] | null;
        }
      | null;
    if (filtros.obra_id && contrato?.obra_id !== filtros.obra_id) continue;

    const obraEmbed = (Array.isArray(contrato?.obra) ? contrato?.obra[0] : contrato?.obra) as
      | { codigo: string; nome: string }
      | null;
    const frenteEmbed = (Array.isArray(l.frente) ? l.frente[0] : l.frente) as
      | { nome: string }
      | null;

    const obra = obraEmbed ? `${obraEmbed.codigo} — ${obraEmbed.nome}` : "—";
    const frente = frenteEmbed?.nome ?? "(sem frente)";
    const chave = obra + "\u0000" + frente;

    // O custo é estimado da retirada até a devolução — ou até hoje, se o item
    // ainda está fora. Mesma conta de `itens_abertos`, e é de propósito: dois
    // relatórios que respondem "quanto custou" com números diferentes não
    // servem a ninguém.
    const retirada = l.data_retirada ? dataDeISO(String(l.data_retirada)) : null;
    let custo = 0;
    if (retirada && contrato) {
      const fim = l.data_devolucao ? dataDeISO(String(l.data_devolucao)) : hoje;
      const periodos = periodosEntre(
        contrato.cadencia,
        retirada,
        fim,
        contrato.cobranca_prorata,
      );
      custo = Number(l.quantidade) * Number(l.valor_unitario_periodo) * periodos;
    }

    const atual = grupos.get(chave) ?? {
      obra,
      frente,
      itens: 0,
      abertos: 0,
      custo: 0,
    };
    atual.itens += 1;
    if (l.status === "em_aberto") atual.abertos += 1;
    atual.custo += custo;
    grupos.set(chave, atual);
  }

  const linhas = [...grupos.values()]
    .sort(
      (a, b) => a.obra.localeCompare(b.obra) || b.custo - a.custo,
    )
    .map((g) => ({
      obra: g.obra,
      frente: g.frente,
      itens: g.itens,
      em_aberto: g.abertos,
      custo: Math.round(g.custo * 100) / 100,
    }));

  return {
    titulo: "Custo por frente de serviço",
    agruparPor: "obra",
    colunas: COLUNAS_FRENTE,
    linhas,
    grafico: { labelKey: "frente", valorKey: "custo" },
  };
}
