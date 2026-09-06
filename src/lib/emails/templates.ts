// Os nove e-mails do Loca.
//
// Cada template só decide CONTEÚDO — o que se diz, em que ordem, com que ênfase
// — e monta tudo com os primitivos de `./layout`. Nenhum sabe desenhar: mudar o
// visual dos nove é mexer em `layout.ts`, e nenhum template acompanha.
//
// Assunto e corpo saem juntos: o assunto é parte do template, não do call site.
// Hoje ele está espalhado em string literal em `usuarios/actions.ts` e nas duas
// rotas de cron, e por isso já divergiu ("Loca — seu acesso foi criado" contra
// "Loca — Avisos de vencimento").

import * as L from "./layout";
import { esc, linhasSimples, type Contexto, type LinhaTabela, type Metrica } from "./base";

export type EmailPronto = {
  assunto: string;
  html: string;
  /**
   * Alternativa em texto puro.
   *
   * Não é enfeite: mensagem só-HTML pontua pior em filtro de spam, e é o que
   * aparece na pré-visualização de alguns clientes. Derivada do HTML para não
   * existir uma segunda redação que possa divergir da primeira.
   */
  texto: string;
};

/** Deriva a parte `text/plain` do HTML montado. */
export function textoDe(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(br|\/tr|\/p|\/h1|\/h2|\/li|\/table)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pronto(assunto: string, html: string): EmailPronto {
  return { assunto, html, texto: textoDe(html) };
}

const plural = (n: number, um: string, muitos: string) =>
  `${n} ${n === 1 ? um : muitos}`;

// ---------------------------------------------------------------------------
// 1 e 2 — Avisos de vencimento
// ---------------------------------------------------------------------------

export type LinhaAlerta = {
  categoria: string;
  descricao: string;
  data: string;
  obra?: string;
  custo?: string;
};

const COLUNAS_ALERTA = [
  { label: "Tipo" },
  { label: "Descrição" },
  { label: "Obra" },
  { label: "Custo mensal", tipo: "moeda" as const },
  { label: "Data", tipo: "data" as const },
];

function linhasAlerta(linhas: LinhaAlerta[]): LinhaTabela[] {
  return linhasSimples(
    linhas.map((l) => [
      esc(l.categoria),
      esc(l.descricao),
      esc(l.obra ?? "—"),
      esc(l.custo ?? "—"),
      esc(l.data),
    ]),
  );
}

export type DadosVencimentosObra = {
  /** Rótulo da obra, ou vazio quando o aviso é da organização inteira. */
  obra?: string;
  linhas: LinhaAlerta[];
};

export function vencimentosObra(
  d: DadosVencimentosObra,
  ctx: Contexto,
): EmailPronto {
  const metricas: Metrica[] = [
    { valor: String(d.linhas.length), rotulo: d.linhas.length === 1 ? "aviso" : "avisos" },
  ];

  const corpo =
    L.p(
      `Estes são os vencimentos que pedem atenção${
        d.obra ? ` na obra <strong>${esc(d.obra)}</strong>` : ""
      }.`,
    ) +
    L.tabela(COLUNAS_ALERTA, linhasAlerta(d.linhas)) +
    L.botao(`${ctx.appUrl}/contratos`, "Abrir no Loca") +
    L.nota("Cada obra recebe apenas os avisos que são dela.");

  return pronto(
    `Loca · Avisos de vencimento${d.obra ? ` — ${d.obra}` : ""}`,
    L.pagina(
      {
        titulo: "Avisos de vencimento",
        subtitulo: d.obra ? `${ctx.remetente.nome} — ${d.obra}` : ctx.remetente.nome,
        metricas,
      },
      corpo,
      ctx,
    ),
  );
}

export type GrupoAlerta = {
  obra: string;
  linhas: LinhaAlerta[];
  /** Obra sem ninguém para avisar — a central absorveu e precisa DIZER isso. */
  semDestinatarios?: boolean;
};

export type DadosVencimentosCentral = { grupos: GrupoAlerta[] };

export function vencimentosCentral(
  d: DadosVencimentosCentral,
  ctx: Contexto,
): EmailPronto {
  const total = d.grupos.reduce((s, g) => s + g.linhas.length, 0);

  // Numa variável, e não interpolado no meio do template: quebrado em duas
  // linhas o HTML renderiza igual (o navegador colapsa o espaço), mas a frase
  // deixa de existir como string contígua — e nenhum teste consegue afirmá-la.
  const resumo = `${plural(total, "aviso", "avisos")} em ${plural(
    d.grupos.length,
    "grupo",
    "grupos",
  )}`;

  // O índice existe para que a forma do e-mail se leia antes das tabelas: com
  // seis obras, saber "onde está o volume" sem rolar é o que faz alguém agir.
  const indice = L.lista(
    d.grupos.map(
      (g) =>
        `<strong>${esc(g.obra)}</strong> — ${plural(g.linhas.length, "aviso", "avisos")}` +
        (g.semDestinatarios
          ? `<br><span style="font-size:12px;">&#9888; sem destinatários próprios — só a central foi avisada</span>`
          : ""),
    ),
  );

  const secoes = d.grupos
    .map((g) => L.secao(g.obra) + L.tabela(COLUNAS_ALERTA, linhasAlerta(g.linhas)))
    .join("");

  const corpo =
    indice +
    secoes +
    L.botao(`${ctx.appUrl}/contratos`, "Abrir no Loca") +
    L.nota(
      "Você recebe este resumo por gerenciar todos os contratos. Cada obra recebe separadamente o que é dela.",
    );

  return pronto(
    "Loca · Avisos de vencimento — resumo geral",
    L.pagina(
      {
        titulo: "Avisos de vencimento",
        subtitulo: `${ctx.remetente.nome} — ${resumo}`,
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 3 e 4 — Acesso
// ---------------------------------------------------------------------------

export type DadosAcessoCriado = {
  nome: string;
  email: string;
  senha: string;
  perfil: string;
};

export function acessoCriado(
  d: DadosAcessoCriado,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Olá, ${esc(d.nome)}. Seu acesso ao <strong>Loca</strong> — o controle de locações da Sistenge — está pronto.`,
    ) +
    L.dados([
      ["Endereço do sistema", `<a href="${esc(ctx.appUrl)}" style="color:#0F172A;">${esc(ctx.appUrl)}</a>`],
      ["E-mail de acesso", esc(d.email)],
      ["Senha temporária", `<code style="font-size:15px;letter-spacing:1px;">${esc(d.senha)}</code>`],
      ["Perfil", esc(d.perfil)],
    ]) +
    L.aviso(
      "A senha acima é <strong>temporária</strong>. O Loca vai pedir uma nova no seu primeiro acesso.",
      "info",
    ) +
    L.botao(ctx.appUrl, "Acessar o Loca") +
    L.nota("Não compartilhe esta senha. Se você não esperava este acesso, avise o administrador.");

  return pronto(
    "Loca · Seu acesso foi criado",
    L.pagina(
      { titulo: "Seu acesso ao Loca foi criado", subtitulo: ctx.remetente.nome },
      corpo,
      ctx,
    ),
  );
}

export type DadosSenhaRedefinida = { nome: string; email: string; senha: string };

export function senhaRedefinida(
  d: DadosSenhaRedefinida,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Olá, ${esc(d.nome)}. A senha da sua conta no <strong>Loca</strong> foi redefinida por um administrador.`,
    ) +
    L.dados([
      ["E-mail de acesso", esc(d.email)],
      ["Nova senha temporária", `<code style="font-size:15px;letter-spacing:1px;">${esc(d.senha)}</code>`],
    ]) +
    L.aviso(
      "Se <strong>não foi você</strong> quem pediu esta redefinição, avise o administrador agora — alguém tem acesso à sua conta.",
      "critico",
    ) +
    L.botao(ctx.appUrl, "Entrar e trocar a senha") +
    L.nota("O Loca vai pedir uma senha nova no próximo acesso.");

  return pronto(
    "Loca · Sua senha foi redefinida",
    L.pagina(
      { titulo: "Sua senha do Loca foi redefinida", subtitulo: ctx.remetente.nome },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 5 — Relatório automático (com PDF anexo)
// ---------------------------------------------------------------------------

export type DadosRelatorio = {
  titulo: string;
  periodo: string;
  colunas: { label: string; tipo?: "texto" | "moeda" | "numero" | "data" }[];
  /**
   * Linhas em texto CRU, como saem do banco — quem escapa é o template.
   * `enfase` marca as linhas de fechamento que `expandirLinhas` produz.
   */
  linhas: { celulas: string[]; enfase?: "subtotal" | "total" }[];
  /** Linha de fechamento, quando o relatório tem total. */
  total?: { rotulo: string; valor: string };
  anexo?: string;
};

export function relatorioAutomatico(
  d: DadosRelatorio,
  ctx: Contexto,
): EmailPronto {
  const metricas: Metrica[] = [
    { valor: String(d.linhas.length), rotulo: d.linhas.length === 1 ? "registro" : "registros" },
  ];
  if (d.total) metricas.push({ valor: d.total.valor, rotulo: d.total.rotulo });

  const tabela =
    d.linhas.length === 0
      ? L.aviso("Sem registros no período.", "info")
      : L.tabela(
          d.colunas,
          d.linhas.map((l) => ({ celulas: l.celulas.map(esc), enfase: l.enfase })),
        );

  const corpo =
    L.p(`Resumo automático de <strong>${esc(ctx.remetente.nome)}</strong>.`) +
    tabela +
    (d.anexo
      ? L.nota(`O relatório completo está anexado a este e-mail: <strong>${esc(d.anexo)}</strong>.`)
      : "") +
    L.botao(`${ctx.appUrl}/relatorios`, "Ver no Loca");

  return pronto(
    `Loca · ${d.titulo} — ${d.periodo}`,
    L.pagina(
      { titulo: d.titulo, subtitulo: `${ctx.remetente.nome} — ${d.periodo}`, metricas },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 6 — Recebimento de equipamento, avisando o fornecedor
//
// Desenhado aqui; a LIGAÇÃO com o fluxo de recebimento pertence à entrega da
// spec 2026-08-23-recebimento-equipamento-design.md.
// ---------------------------------------------------------------------------

export type ItemRecebido = {
  descricao: string;
  quantidade: string;
  patrimonio?: string;
};

export type DadosRecebimento = {
  /** Número do registro, ex.: REC-2026-0014. */
  numero: string;
  fornecedor: string;
  obra: string;
  data: string;
  contrato?: string;
  itens: ItemRecebido[];
  anexo?: string;
  observacoes?: string;
};

export function recebimentoFornecedor(
  d: DadosRecebimento,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Confirmamos o recebimento do equipamento abaixo na obra <strong>${esc(d.obra)}</strong>. ` +
        `O romaneio <strong>${esc(d.numero)}</strong> registra a conferência feita na entrega.`,
    ) +
    L.dados([
      ["Registro", esc(d.numero)],
      ["Fornecedor", esc(d.fornecedor)],
      ["Obra", esc(d.obra)],
      ...(d.contrato ? ([["Contrato", esc(d.contrato)]] as [string, string][]) : []),
      ["Data do recebimento", esc(d.data)],
    ]) +
    L.secao("Itens recebidos") +
    L.tabela(
      [{ label: "Item" }, { label: "Patrimônio / série" }, { label: "Qtd.", tipo: "numero" }],
      linhasSimples(
        d.itens.map((i) => [esc(i.descricao), esc(i.patrimonio ?? "—"), esc(i.quantidade)]),
      ),
    ) +
    (d.observacoes ? L.aviso(esc(d.observacoes), "atencao") : "") +
    (d.anexo
      ? L.nota(`Romaneio em PDF anexo: <strong>${esc(d.anexo)}</strong>.`)
      : "") +
    L.nota("Divergência na conferência? Responda este e-mail citando o número do registro.");

  return pronto(
    `Recebimento ${d.numero} — ${d.obra}`,
    L.pagina(
      {
        titulo: "Recebimento de equipamento",
        subtitulo: `${d.numero} · ${d.obra}`,
        metricas: [
          { valor: String(d.itens.length), rotulo: d.itens.length === 1 ? "item" : "itens" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 6b — Devolução de equipamento, enviada ao fornecedor
// ---------------------------------------------------------------------------

export type ItemDevolvido = {
  descricao: string;
  quantidade: string;
  patrimonio?: string;
  /** Rótulo já em português: "Conforme", "Com avaria", "Não devolvido". */
  condicao?: string;
};

export type DadosDevolucao = {
  /** Número do registro, ex.: DEV-2026-0009. */
  numero: string;
  fornecedor: string;
  obra: string;
  data: string;
  contrato?: string;
  itens: ItemDevolvido[];
  anexo?: string;
  observacoes?: string;
  /**
   * Itens que voltaram com avaria ou não voltaram. Vêm separados do resto de
   * propósito: é sobre eles que o fornecedor vai cobrar reposição, e enterrá-los
   * numa coluna da tabela geral é como a ressalva passa despercebida até virar
   * discussão de fatura.
   */
  ressalvas?: string[];
};

export function devolucaoFornecedor(
  d: DadosDevolucao,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Informamos a devolução do equipamento abaixo, retirado da obra <strong>${esc(d.obra)}</strong>. ` +
        `O termo <strong>${esc(d.numero)}</strong> registra a conferência feita na entrega.`,
    ) +
    L.dados([
      ["Registro", esc(d.numero)],
      ["Fornecedor", esc(d.fornecedor)],
      ["Obra", esc(d.obra)],
      ...(d.contrato ? ([["Contrato", esc(d.contrato)]] as [string, string][]) : []),
      ["Data da devolução", esc(d.data)],
    ]) +
    L.secao("Itens devolvidos") +
    L.tabela(
      [
        { label: "Item" },
        { label: "Patrimônio / série" },
        { label: "Qtd.", tipo: "numero" },
        { label: "Condição" },
      ],
      linhasSimples(
        d.itens.map((i) => [
          esc(i.descricao),
          esc(i.patrimonio ?? "—"),
          esc(i.quantidade),
          esc(i.condicao ?? "Conforme"),
        ]),
      ),
    ) +
    (d.ressalvas && d.ressalvas.length > 0
      ? L.secao("Ressalvas") +
        L.aviso(d.ressalvas.map((r) => esc(r)).join("<br />"), "atencao")
      : "") +
    (d.observacoes ? L.nota(esc(d.observacoes)) : "") +
    (d.anexo
      ? L.nota(`Termo de devolução em PDF anexo: <strong>${esc(d.anexo)}</strong>.`)
      : "") +
    L.nota(
      "Divergência na conferência? Responda este e-mail citando o número do registro.",
    );

  return pronto(
    `Devolução ${d.numero} — ${d.obra}`,
    L.pagina(
      {
        titulo: "Devolução de equipamento",
        subtitulo: `${d.numero} · ${d.obra}`,
        metricas: [
          { valor: String(d.itens.length), rotulo: d.itens.length === 1 ? "item" : "itens" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 7 — Documento gerado, enviado ao fornecedor ou proprietário
// ---------------------------------------------------------------------------

export type DadosDocumento = {
  /** Rótulo do tipo, ex.: "Contrato de locação de imóvel". */
  tipo: string;
  numero: string;
  destinatario: string;
  /** Obra ou imóvel a que o documento se refere. */
  referencia: string;
  data: string;
  anexo: string;
  /** O que se espera de quem recebe. */
  acao?: string;
};

export function documentoParaTerceiro(
  d: DadosDocumento,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Prezados, ${esc(d.destinatario)}. Segue o documento <strong>${esc(d.tipo)}</strong>, ` +
        `sob o número <strong>${esc(d.numero)}</strong>.`,
    ) +
    L.dados([
      ["Documento", esc(d.tipo)],
      ["Número", esc(d.numero)],
      ["Referência", esc(d.referencia)],
      ["Emitido em", esc(d.data)],
      ["Anexo", esc(d.anexo)],
    ]) +
    (d.acao ? L.aviso(esc(d.acao), "info") : "") +
    L.nota(
      "Este e-mail e o documento anexo tratam do mesmo registro. Ao responder, mantenha o número no assunto.",
    );

  return pronto(
    `${d.tipo} ${d.numero} — ${d.referencia}`,
    L.pagina(
      { titulo: d.tipo, subtitulo: `${d.numero} · ${d.referencia}` },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 8 — Avaria em vistoria, cobrada do fornecedor
// ---------------------------------------------------------------------------

export type LinhaAvaria = {
  item: string;
  descricao: string;
  valor: string;
};

export type DadosAvaria = {
  numero: string;
  fornecedor: string;
  obra: string;
  /** "entrada" ou "devolução", como o usuário lê. */
  tipoVistoria: string;
  data: string;
  avarias: LinhaAvaria[];
  total: string;
  prazoResposta?: string;
};

export function avariaCobranca(
  d: DadosAvaria,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Na vistoria de ${esc(d.tipoVistoria)} do dia ${esc(d.data)}, na obra ` +
        `<strong>${esc(d.obra)}</strong>, foram registradas as avarias abaixo.`,
    ) +
    L.aviso(
      `Valor apurado: <strong>${esc(d.total)}</strong>.` +
        (d.prazoResposta ? ` Prazo para manifestação: <strong>${esc(d.prazoResposta)}</strong>.` : ""),
      "critico",
    ) +
    L.dados([
      ["Registro", esc(d.numero)],
      ["Fornecedor", esc(d.fornecedor)],
      ["Vistoria", `${esc(d.tipoVistoria)} — ${esc(d.data)}`],
    ]) +
    L.secao("Avarias registradas") +
    L.tabela(
      [{ label: "Item" }, { label: "Ocorrência" }, { label: "Valor", tipo: "moeda" }],
      linhasSimples(d.avarias.map((a) => [esc(a.item), esc(a.descricao), esc(a.valor)])),
    ) +
    L.nota(
      "As fotos da vistoria estão no registro do Loca. Para contestar, responda este e-mail citando o número acima.",
    );

  return pronto(
    `Avarias em vistoria ${d.numero} — ${d.obra}`,
    L.pagina(
      {
        titulo: "Avarias registradas em vistoria",
        subtitulo: `${d.numero} · ${d.obra}`,
        metricas: [
          { valor: String(d.avarias.length), rotulo: d.avarias.length === 1 ? "avaria" : "avarias" },
          { valor: d.total, rotulo: "valor apurado" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// 9 — Fluxo de caixa do mês
// ---------------------------------------------------------------------------

export type MesFluxoEmail = {
  mes: string;
  previsto: string;
  realizado: string;
  saldo: string;
};

export type DadosFluxo = {
  periodo: string;
  meses: MesFluxoEmail[];
  totalPrevisto: string;
  totalRealizado: string;
  anexo?: string;
};

export function fluxoCaixaMensal(
  d: DadosFluxo,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Projeção de desembolso com locações de <strong>${esc(ctx.remetente.nome)}</strong> ` +
        `no período de ${esc(d.periodo)}.`,
    ) +
    L.tabela(
      [
        { label: "Mês" },
        { label: "Previsto", tipo: "moeda" },
        { label: "Realizado", tipo: "moeda" },
        { label: "Saldo", tipo: "moeda" },
      ],
      linhasSimples(
        d.meses.map((m) => [esc(m.mes), esc(m.previsto), esc(m.realizado), esc(m.saldo)]),
      ),
    ) +
    (d.anexo
      ? L.nota(`Planilha completa em anexo: <strong>${esc(d.anexo)}</strong>.`)
      : "") +
    L.botao(`${ctx.appUrl}/financeiro`, "Abrir o financeiro");

  return pronto(
    `Loca · Fluxo de caixa — ${d.periodo}`,
    L.pagina(
      {
        titulo: "Fluxo de caixa de locações",
        subtitulo: `${ctx.remetente.nome} — ${d.periodo}`,
        metricas: [
          { valor: d.totalPrevisto, rotulo: "previsto" },
          { valor: d.totalRealizado, rotulo: "realizado" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}

// ── Avanço semanal da obra ───────────────────────────────────────────────────
// O e-mail que cruza prazo com avanço. Nenhum dos dois números decide nada
// sozinho: "31% de obra" só vira diagnóstico ao lado de "55% de prazo". E isso
// pesa mais em locação do que em qualquer outra conta, porque equipamento
// alugado cobra por TEMPO, não por produção — obra atrasada paga diária de
// betoneira parada.

export type LinhaAvanco = {
  /** Rótulo da obra, "OB-042 — Vista Verde". */
  obra: string;
  /** Avanço físico acumulado, já formatado ("31%") ou "—". */
  fisico: string;
  /** Prazo decorrido, já formatado ("55%") ou "—". */
  prazo: string;
  /** Desvio em pontos, com o sentido escrito ("24 pts de atraso"). */
  desvio: string;
  /** Previsão de término, ou a frase de ritmo insuficiente. */
  previsao: string;
  /** Itens locados em aberto na obra. */
  itens: string;
};

/** Obra ativa que ficou sem lançamento nesta semana. */
export type LinhaSemLancamento = {
  obra: string;
  /** "3 semanas sem informação" ou "nunca informada". */
  desde: string;
};

const COLUNAS_AVANCO = [
  { label: "Obra" },
  { label: "Avanço" },
  { label: "Prazo" },
  { label: "Desvio" },
  { label: "Previsão" },
  { label: "Itens" },
];

export type DadosAvancoSemanal = {
  /** Segunda-feira da semana, já formatada em pt-BR. */
  semana: string;
  linhas: LinhaAvanco[];
  /** Cobrança: sem ela o cadastro seca e três subprojetos perdem o insumo. */
  semLancamento: LinhaSemLancamento[];
};

export function avancoSemanal(d: DadosAvancoSemanal, ctx: Contexto): EmailPronto {
  const atrasadas = d.linhas.filter((l) => l.desvio.includes("atraso")).length;

  const metricas: Metrica[] = [
    { valor: String(d.linhas.length), rotulo: d.linhas.length === 1 ? "obra" : "obras" },
    { valor: String(atrasadas), rotulo: atrasadas === 1 ? "atrasada" : "atrasadas" },
  ];

  const corpo =
    L.p(
      `Prazo decorrido contra avanço físico, na semana de <strong>${esc(d.semana)}</strong>. ` +
        "O desvio é o que se lê: prazo correndo mais rápido que a obra significa " +
        "equipamento alugado parado, e diária que continua contando.",
    ) +
    (d.linhas.length > 0
      ? L.tabela(
          COLUNAS_AVANCO,
          linhasSimples(
            d.linhas.map((l) => [
              esc(l.obra),
              esc(l.fisico),
              esc(l.prazo),
              esc(l.desvio),
              esc(l.previsao),
              esc(l.itens),
            ]),
          ),
        )
      : L.nota("Nenhuma obra com avanço lançado ainda.")) +
    (d.semLancamento.length > 0
      ? L.secao("Sem lançamento nesta semana") +
        L.lista(d.semLancamento.map((l) => `${esc(l.obra)} — ${esc(l.desde)}`)) +
        L.aviso(
          "Semana sem lançamento deixa o acompanhamento cego: sem avanço físico, " +
            "o percentual de orçamento consumido não tem contraponto.",
          "atencao",
        )
      : "") +
    L.botao(`${ctx.appUrl}/avanco`, "Lançar o avanço") +
    L.nota("Cada obra recebe apenas o que é dela.");

  return pronto(
    `Loca · Avanço das obras — semana de ${d.semana}`,
    L.pagina(
      {
        titulo: "Avanço das obras",
        subtitulo: `${ctx.remetente.nome} — semana de ${d.semana}`,
        metricas,
      },
      corpo,
      ctx,
    ),
  );
}

// ── Indicadores quinzenais ───────────────────────────────────────────────────
// O e-mail da diretoria. Uma linha por obra, ordenada por quem precisa de
// atenção primeiro — quem tem 7 obras não lê 7 linhas procurando o problema.

export type LinhaIndicador = {
  obra: string;
  prazo: string;
  avanco: string;
  consumido: string;
  /** Projeção com o estouro embutido, ou o motivo de não haver projeção. */
  projecao: string;
  itens: string;
  /** Desembolso previsto até o fim dos contratos. */
  previsao: string;
  situacao: string;
};

export type DadosIndicadores = {
  /** "1ª quinzena de setembro/2026" ou "2ª quinzena…". */
  periodo: string;
  linhas: LinhaIndicador[];
  /** Quantas obras projetam estouro, e a soma em reais já formatada. */
  comEstouro: number;
  estouroTotal: string;
  /** Obras sem dado suficiente — o que impede o e-mail de mentir por otimismo. */
  semDados: number;
  previsaoTotal: string;
};

const COLUNAS_INDICADOR = [
  { label: "Obra" },
  { label: "Prazo" },
  { label: "Avanço" },
  { label: "Consumido" },
  { label: "Projeção" },
  { label: "Itens" },
  { label: "Até o fim" },
  { label: "Situação" },
];

export function indicadoresQuinzenais(
  d: DadosIndicadores,
  ctx: Contexto,
): EmailPronto {
  const metricas: Metrica[] = [
    { valor: String(d.linhas.length), rotulo: d.linhas.length === 1 ? "obra" : "obras" },
    {
      valor: String(d.comEstouro),
      rotulo: d.comEstouro === 1 ? "projeta estouro" : "projetam estouro",
    },
  ];

  const corpo =
    L.p(
      `Indicadores de locação da <strong>${esc(d.periodo)}</strong>. O que se lê é a ` +
        "relação entre os três: prazo decorrido, avanço físico e orçamento " +
        "consumido. Consumo acima da entrega significa equipamento alugado " +
        "parado, e diária que continua contando.",
    ) +
    (d.comEstouro > 0
      ? L.aviso(
          `${d.comEstouro} ${d.comEstouro === 1 ? "obra projeta" : "obras projetam"} ` +
            `estouro de orçamento, somando <strong>${esc(d.estouroTotal)}</strong>.`,
          "critico",
        )
      : "") +
    (d.linhas.length > 0
      ? L.tabela(
          COLUNAS_INDICADOR,
          linhasSimples(
            d.linhas.map((l) => [
              esc(l.obra),
              esc(l.prazo),
              esc(l.avanco),
              esc(l.consumido),
              esc(l.projecao),
              esc(l.itens),
              esc(l.previsao),
              esc(l.situacao),
            ]),
          ),
        )
      : L.nota("Nenhuma obra ativa no período."))
    +
    L.dados([["Desembolso previsto até o fim dos contratos", d.previsaoTotal]]) +
    // A ressalva vem DEPOIS dos números, de propósito: quem lê a tabela precisa
    // saber quantas linhas são conclusão e quantas são ausência de dado.
    (d.semDados > 0
      ? L.nota(
          `${d.semDados} de ${d.linhas.length} obras estão sem dado suficiente para ` +
            "diagnosticar — falta orçamento cadastrado, avanço lançado ou período " +
            "da obra. Linha sem diagnóstico não é obra saudável.",
        )
      : "") +
    L.botao(`${ctx.appUrl}/`, "Abrir o painel");

  return pronto(
    `Loca · Indicadores de locação — ${d.periodo}`,
    L.pagina(
      {
        titulo: "Indicadores de locação",
        subtitulo: `${ctx.remetente.nome} — ${d.periodo}`,
        metricas,
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// Termo de responsabilidade — cópia para quem assinou
// ---------------------------------------------------------------------------

export type ItemTermoEmail = {
  descricao: string;
  patrimonio?: string;
  quantidade: string;
  estado: string;
};

export type DadosTermoFuncionario = {
  /** Número do registro, ex.: TRM-2026-0007. */
  numero: string;
  funcionario: string;
  obra?: string;
  dataEntrega: string;
  previsaoDevolucao?: string;
  itens: ItemTermoEmail[];
  anexo: string;
  observacoes?: string;
};

/**
 * A cópia do termo que a pessoa acabou de assinar.
 *
 * NÃO é pedido de assinatura. A assinatura foi colhida na tela, com imagem e IP
 * registrados — quando este e-mail sai, o documento já existe e já vale. O
 * texto diz isso na primeira linha, porque um e-mail com um termo anexo é
 * naturalmente lido como "assine e devolva", e quem lê assim guarda o anexo
 * esperando um passo que não existe.
 */
export function termoFuncionario(
  d: DadosTermoFuncionario,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Segue a sua via do termo de responsabilidade <strong>${esc(d.numero)}</strong>, ` +
        `assinado em ${esc(d.dataEntrega)}. <strong>Não é preciso responder nem devolver nada</strong> — ` +
        "é a sua cópia, para guardar.",
    ) +
    L.dados([
      ["Registro", esc(d.numero)],
      ["Funcionário", esc(d.funcionario)],
      ...(d.obra ? ([["Obra", esc(d.obra)]] as [string, string][]) : []),
      ["Data da entrega", esc(d.dataEntrega)],
      ...(d.previsaoDevolucao
        ? ([["Previsão de devolução", esc(d.previsaoDevolucao)]] as [string, string][])
        : []),
    ]) +
    L.secao("Equipamento sob sua responsabilidade") +
    L.tabela(
      [
        { label: "Item" },
        { label: "Patrimônio" },
        { label: "Qtd.", tipo: "numero" },
        { label: "Estado na entrega" },
      ],
      linhasSimples(
        d.itens.map((i) => [
          esc(i.descricao),
          esc(i.patrimonio ?? "—"),
          esc(i.quantidade),
          esc(i.estado),
        ]),
      ),
    ) +
    (d.observacoes ? L.nota(esc(d.observacoes)) : "") +
    L.nota(`Termo assinado em PDF anexo: <strong>${esc(d.anexo)}</strong>.`) +
    // O aviso de perda/dano fecha o e-mail porque é a obrigação que o termo
    // cria. Enterrá-lo no meio faria a cópia parecer um comprovante e não um
    // compromisso.
    L.aviso(
      "Perda, furto ou dano deve ser comunicado imediatamente. " +
        "Ao sair da empresa ou trocar de equipamento, devolva os itens acima.",
      "atencao",
    );

  return pronto(
    `Seu termo de responsabilidade ${d.numero}`,
    L.pagina(
      {
        titulo: "Termo de responsabilidade",
        subtitulo: `${d.numero} · ${d.funcionario}`,
        metricas: [
          { valor: String(d.itens.length), rotulo: d.itens.length === 1 ? "item" : "itens" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}

// ---------------------------------------------------------------------------
// Assinatura à distância — o convite
// ---------------------------------------------------------------------------

export type DadosConviteAssinatura = {
  funcionario: string;
  obra?: string;
  dataEntrega: string;
  itens: ItemTermoEmail[];
  url: string;
  /** Ex.: "7 dias". */
  validade: string;
};

/**
 * O pedido de assinatura à distância.
 *
 * AO CONTRÁRIO de `termoFuncionario`, este e-mail PEDE uma ação — e por isso
 * diz, logo no começo, que vai ser preciso o CPF. Quem abre o link no ônibus
 * sem saber disso fecha a página e não volta.
 *
 * Não leva o PDF anexo de propósito: o documento ainda não está assinado, e um
 * anexo circulando antes da assinatura é exatamente o que a numeração e a
 * emissão existem para impedir. A via em PDF vai depois, pelo outro e-mail.
 */
export function conviteAssinatura(
  d: DadosConviteAssinatura,
  ctx: Contexto,
): EmailPronto {
  const corpo =
    L.p(
      `Você recebeu o equipamento abaixo e precisa confirmar o recebimento. ` +
        `Abra o link, <strong>confirme o seu CPF</strong> e aceite o termo — leva menos de um minuto.`,
    ) +
    L.dados([
      ["Funcionário", esc(d.funcionario)],
      ...(d.obra ? ([["Obra", esc(d.obra)]] as [string, string][]) : []),
      ["Data da entrega", esc(d.dataEntrega)],
    ]) +
    L.secao("Equipamento") +
    L.tabela(
      [
        { label: "Item" },
        { label: "Patrimônio" },
        { label: "Qtd.", tipo: "numero" },
        { label: "Estado" },
      ],
      linhasSimples(
        d.itens.map((i) => [
          esc(i.descricao),
          esc(i.patrimonio ?? "—"),
          esc(i.quantidade),
          esc(i.estado),
        ]),
      ),
    ) +
    L.botao(d.url, "Conferir e assinar") +
    // A validade e o uso único vão escritos porque mudam o comportamento de
    // quem lê: guardar o e-mail "para depois" é o jeito de perder o link.
    L.nota(
      `O link vale por <strong>${esc(d.validade)}</strong> e serve <strong>uma vez só</strong>. ` +
        "Se expirar, peça um novo ao setor que enviou este e-mail.",
    ) +
    L.aviso(
      "Se você não recebeu este equipamento, não assine — responda este e-mail avisando.",
      "atencao",
    );

  return pronto(
    "Confirme o recebimento do seu equipamento",
    L.pagina(
      {
        titulo: "Termo de responsabilidade",
        subtitulo: `Assinatura de ${d.funcionario}`,
        metricas: [
          { valor: String(d.itens.length), rotulo: d.itens.length === 1 ? "item" : "itens" },
        ],
      },
      corpo,
      ctx,
    ),
  );
}
