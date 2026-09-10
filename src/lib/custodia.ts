// Custódia da peça: quem está com ela, quem ficou, e por quanto tempo.
//
// ═══════════════════════════════════════════════════════════════════════════
// POR QUE ESTE ARQUIVO EXISTE
// ═══════════════════════════════════════════════════════════════════════════
//
// `equipamento_unidade.obra_id` responde "onde está" e sobrescreve a resposta
// anterior. Mover a peça da Obra A para a Obra B apagava o fato de ela ter
// estado na A — e a pergunta que o almoxarifado faz de verdade é "quem ficou
// com ela e por quanto tempo", que um campo sobrescrito não responde.
//
// O livro (`custodia_peca`) guarda uma linha por PERÍODO de posse, com `fim`
// nulo marcando a posse aberta. É o que faz "com quem está" e "com quem ficou"
// serem a mesma tabela lida de dois jeitos, e o tempo sair de `fim - inicio`
// sem janela nem cálculo esperto.
//
// Aqui mora só cálculo e rótulo — nada de banco. A escrita mora em
// `custodia-servidor.ts`, o escritor único.
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import {
  enumOpcional,
  numeroOpcional,
  opcional,
  textoOpcional,
  uuidOpcional,
} from "@/lib/campos";
import { ESTADOS } from "@/lib/frota";

export const TIPOS_DETENTOR = [
  "almoxarifado",
  "obra",
  "funcionario",
  "fornecedor",
] as const;
export type TipoDetentor = (typeof TIPOS_DETENTOR)[number];

export const DETENTOR_INFO: Record<
  TipoDetentor,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  almoxarifado: { label: "Almoxarifado central", variant: "secondary" },
  obra: { label: "Em obra", variant: "default" },
  funcionario: { label: "Com funcionário", variant: "default" },
  fornecedor: { label: "Em manutenção", variant: "outline" },
};

/** Uma linha do livro, com os vínculos já resolvidos pela camada de leitura. */
export type Posse = {
  id: string;
  tipo: TipoDetentor;
  /**
   * O nome do detentor CONGELADO no momento da posse. Preferido sobre o
   * vínculo vivo: embed respeita a RLS da tabela embutida, e `soft_delete` de
   * uma obra apagaria o nome dela de todo o histórico (migration 0062).
   */
  detentorRotulo: string | null;
  obraRotulo: string | null;
  funcionarioNome: string | null;
  fornecedorNome: string | null;
  /** 'yyyy-mm-dd' — coluna `date`, não instante. */
  inicio: string;
  /** NULO = posse aberta. */
  fim: string | null;
  origem: "termo" | "manual";
  termoId: string | null;
  termoNumero: string | null;
  termoCancelado: boolean;
  observacoes: string | null;
};

export type PosseNaLinha = Posse & {
  dias: number;
  periodo: string;
  aberta: boolean;
  /** Posse que veio de termo cancelado: existiu no papel e não valeu. */
  anulada: boolean;
};

/**
 * Quem detém a peça, em uma linha de texto.
 *
 * O SNAPSHOT vem primeiro (`detentorRotulo`, gravado na abertura da posse), e o
 * vínculo vivo é o reserva. A ordem importa: o embed que resolve o vínculo
 * respeita a RLS da tabela embutida, então para um gestor não membro da obra o
 * nome volta nulo mesmo com a obra existindo; e `soft_delete` de uma obra
 * apagaria o nome dela do histórico inteiro. O passado não se lê no presente.
 *
 * As três FK são `on delete set null`: apagar a obra não pode apagar a
 * história. Quando nem snapshot nem vínculo há, dizemos isso — espaço em branco
 * na tela faria quem confere achar que ninguém preencheu.
 */
export function descreverDetentor(p: Posse): string {
  switch (p.tipo) {
    case "almoxarifado":
      return DETENTOR_INFO.almoxarifado.label;
    case "obra":
      return p.detentorRotulo ?? p.obraRotulo ?? "Obra não identificada";
    case "funcionario":
      return p.detentorRotulo ?? p.funcionarioNome ?? "Funcionário não identificado";
    case "fornecedor":
      return `${p.detentorRotulo ?? p.fornecedorNome ?? "Fornecedor não identificado"} (manutenção)`;
  }
}

/** 'yyyy-mm-dd' como milissegundos UTC de meia-noite. */
function emUTC(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/**
 * Dias de calendário de uma posse. Posse aberta conta até `hoje`.
 *
 * `hoje` é PARÂMETRO, e quem chama passa `hojeISOSaoPaulo()`. Nunca
 * `new Date()` aqui dentro: `inicio` e `fim` vêm de coluna `date`, o Vercel
 * roda em UTC, e das 21h à meia-noite em Brasília a contagem sairia um dia
 * maior — em cima dela está o tempo que alguém ficou com o equipamento.
 */
export function diasDePosse(inicio: string, fim: string | null, hoje: string): number {
  const fimEfetivo = fim ?? hoje;
  const dias = Math.round((emUTC(fimEfetivo) - emUTC(inicio)) / 86_400_000);
  // Nunca negativo: o check do banco recusa `fim < inicio`, mas a leitura não
  // pode produzir "-3 dias" se linha torta entrar por outro caminho.
  return Math.max(0, dias);
}

/**
 * O tempo em português, aproximado de propósito.
 *
 * Mês é 30 dias e ano é 365: ninguém no almoxarifado precisa saber que a
 * betoneira ficou 1 ano, 2 meses e 4 dias na obra. Precisão de dia existe em
 * `dias`, para quem quiser somar.
 */
export function descreverPeriodo(dias: number): string {
  if (dias <= 0) return "menos de 1 dia";
  if (dias === 1) return "1 dia";
  if (dias < 30) return `${dias} dias`;

  if (dias < 365) {
    const meses = Math.floor(dias / 30);
    return meses === 1 ? "1 mês" : `${meses} meses`;
  }

  const anos = Math.floor(dias / 365);
  const meses = Math.floor((dias % 365) / 30);
  const parteAnos = anos === 1 ? "1 ano" : `${anos} anos`;
  if (meses === 0) return parteAnos;
  return `${parteAnos} e ${meses === 1 ? "1 mês" : `${meses} meses`}`;
}

/**
 * A linha do tempo da peça: posse aberta no topo, resto da mais nova para a
 * mais antiga.
 *
 * A aberta vem primeiro porque a pergunta mais frequente é "onde está AGORA".
 * Ordenar tudo por data deixaria a resposta atual no meio da lista quando
 * houvesse posse retroativa.
 */
export function montarLinhaDoTempo(posses: Posse[], hoje: string): PosseNaLinha[] {
  return posses
    .map((p) => {
      const dias = diasDePosse(p.inicio, p.fim, hoje);
      return {
        ...p,
        dias,
        periodo: descreverPeriodo(dias),
        aberta: p.fim === null,
        anulada: p.termoCancelado,
      };
    })
    .sort((a, b) => {
      if (a.aberta !== b.aberta) return a.aberta ? -1 : 1;
      if (a.inicio !== b.inicio) return a.inicio < b.inicio ? 1 : -1;
      // Desempate estável por id: sem ele a ordem de duas posses do mesmo dia
      // muda entre renderizações e a tela "pisca".
      return a.id < b.id ? 1 : -1;
    });
}

const anoOpcional = numeroOpcional.refine(
  (v) => v === null || (Number.isInteger(v) && v >= 1950 && v <= 2100),
  { message: "Ano deve estar entre 1950 e 2100." },
);

const memoriaOpcional = numeroOpcional.refine(
  (v) => v === null || (Number.isInteger(v) && v > 0 && v <= 1024),
  { message: "Memória em GB, entre 1 e 1024." },
);

const imeiOpcional = opcional.refine((v) => v === null || /^\d{15}$/.test(v), {
  message: "IMEI tem 15 dígitos.",
});

const estadoOpcional = enumOpcional(ESTADOS);

/**
 * Mover a peça — e `funcionario` NÃO está entre os destinos.
 *
 * Posse de pessoa nasce só por termo assinado (decisão de 02/09/2026). O botão
 * de entregar leva a `/termos/novo`. Duas portas para "entregar ao Fulano",
 * uma com assinatura e outra sem, produziriam a divergência que o Loca existe
 * para eliminar — então a porta sem assinatura não existe nem no tipo.
 */
export const moverPecaSchema = z
  .object({
    unidade_id: z.string().uuid("Peça inválida."),
    tipo: z.enum(["almoxarifado", "obra", "fornecedor"]),
    obra_id: uuidOpcional,
    fornecedor_id: uuidOpcional,
    data: z.string().min(1, "Informe a data da movimentação."),
    observacoes: textoOpcional(300),
  })
  .refine((v) => v.tipo !== "obra" || v.obra_id !== null, {
    message: "Selecione a obra.",
    path: ["obra_id"],
  })
  .refine((v) => v.tipo !== "fornecedor" || v.fornecedor_id !== null, {
    message: "Selecione o fornecedor.",
    path: ["fornecedor_id"],
  });

export type MoverPecaInput = z.input<typeof moverPecaSchema>;
export type MoverPecaDados = z.output<typeof moverPecaSchema>;

/**
 * Editar a peça — sem obra e sem situação, de propósito.
 *
 * Esses dois mudam só por Mover, Mandar para manutenção e Baixar, que passam
 * pelo escritor de custódia. Um formulário de edição genérico com `obra_id`
 * dentro seria a primeira porta a furar o livro, e a divergência apareceria em
 * silêncio.
 */
export const editarPecaSchema = z.object({
  id: z.string().uuid("Peça inválida."),
  identificador: z.string().trim().min(1, "Informe o patrimônio.").max(80),
  numero_serie: textoOpcional(80),
  ano: anoOpcional,
  estado: estadoOpcional,
  observacoes: textoOpcional(300),
  imei: imeiOpcional,
  imei_2: imeiOpcional,
  linha_telefonica: textoOpcional(20),
  operadora: textoOpcional(40),
  service_tag: textoOpcional(60),
  memoria_gb: memoriaOpcional,
  configuracao: textoOpcional(200),
  /**
   * Peça com horímetro entra no apontamento de uso (migration 0071).
   *
   * Nasce FALSO: gerador e compressor costumam ter; betoneira e vibrador quase
   * nunca. Ligado para todas, a tela de apontamento encheria de peças que não
   * têm o que apontar, e a lista viraria ruído no primeiro dia.
   */
  tem_medidor: z.boolean().default(false),
  /**
   * Os campos definidos pelo TIPO do item desta peça (migration 0070).
   *
   * Registro CRU aqui de propósito: a forma de cada campo depende do tipo, que
   * só é conhecido no servidor. Quem valida é `validarFicha` na action, contra
   * `tipo_equipamento.campos_ficha` — e ela DESCARTA chave que o tipo não
   * conhece, para que requisição forjada não grave coluna fantasma no jsonb.
   */
  ficha: z.record(z.string(), z.unknown()).default({}),
});

export type EditarPecaInput = z.input<typeof editarPecaSchema>;
export type EditarPecaDados = z.output<typeof editarPecaSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// Quem pode receber um termo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Esta peça pode entrar num termo de responsabilidade?
 *
 * FONTE ÚNICA da regra, e ela nasceu duplicada — de novo. A tela da peça e a de
 * novo termo faziam a mesma pergunta em formatos diferentes: uma comparava
 * `situacao` com `atual === null`, a outra consultava um `Set` de custódias
 * abertas. Duas escritas da mesma regra divergem na primeira correção, e a
 * divergência aqui aparece como um botão que leva a uma lista onde a peça não
 * está.
 *
 * A GUARDA É A POSSE, NÃO A SITUAÇÃO. Peça com custódia aberta já tem alguém
 * que assinou por ela — oferecê-la produziria dois termos sobre o mesmo
 * patrimônio, que é o que o filtro original queria impedir e mirava errado.
 *
 * `em_uso` sem posse aberta ENTRA de propósito: é o estado em que a importação
 * do inventário deixou 95 máquinas, e era um beco sem saída. A matriz de
 * transição só admite chegar a `em_uso` por um termo, e sair dali por devolução
 * registrada num termo — sem esta regra, elas não podiam receber um nem voltar
 * a `disponivel`.
 *
 * `manutencao`, `baixada` e `perdida` ficam de fora: entregar a alguém uma peça
 * que está na oficina ou dada como perdida é um documento que nasce mentindo.
 */
export function podeReceberTermo(p: {
  situacao: string;
  temPosseAberta: boolean;
}): boolean {
  if (p.temPosseAberta) return false;
  return p.situacao === "disponivel" || p.situacao === "em_uso";
}

/**
 * O termo é uma ENTREGA nova, ou a regularização de uma posse que já existe no
 * mundo e não no sistema?
 *
 * Muda o rótulo do botão, e o rótulo importa: "Entregar a funcionário" numa
 * máquina que já está com a pessoa há meses faria quem clica achar que está
 * fazendo outra coisa.
 */
export function ehRegularizacao(p: {
  situacao: string;
  temPosseAberta: boolean;
}): boolean {
  return p.situacao === "em_uso" && !p.temPosseAberta;
}

/**
 * A peça que veio no `?peca=` da URL, conferida contra as que podem receber
 * termo.
 *
 * O QUE ESTA FUNÇÃO IMPEDE: montar um termo sobre peça que já está com outra
 * pessoa. O parâmetro chega pela URL, e URL é digitável, editável e
 * compartilhável — aceitá-la de olhos fechados aceitaria qualquer id que
 * couber ali. A lista de livres já respondeu quem pode receber, com RLS e
 * custódia; aqui só se procura dentro dela.
 *
 * `foraDaLista` distingue os dois "sem peça" que a tela precisa tratar
 * diferente: quem entrou por "Novo termo" não pediu peça nenhuma e não deve
 * ver aviso; quem clicou no botão da peça pediu uma e merece saber por que ela
 * não veio.
 */
export function resolverPecaPedida<T extends { id: string }>(
  pedida: string | undefined | null,
  livres: T[],
): { peca: T | null; foraDaLista: boolean } {
  if (!pedida) return { peca: null, foraDaLista: false };
  const peca = livres.find((p) => p.id === pedida) ?? null;
  return { peca, foraDaLista: peca === null };
}

/** Mínimo de caracteres do motivo, espelhando o `check` da migration 0102. */
export const MOTIVO_SEM_ASSINATURA_MINIMO = 10;

/**
 * A devolução pode ser encerrada?
 *
 * Ou quem entrega assinou, ou há um motivo escrito para não ter assinado. Nunca
 * nenhum dos dois.
 *
 * ┌─ POR QUE PERMITIR SEM ASSINATURA ────────────────────────────────────────┐
 * │ 211 pessoas da base estão desligadas, e uma delas que saiu com um         │
 * │ notebook não vai assinar devolução nenhuma. Exigir a assinatura ali não   │
 * │ protege o patrimônio — só impede que o fato seja registrado, e o          │
 * │ equipamento fica para sempre "com" quem não trabalha mais aqui.           │
 * │                                                                          │
 * │ O motivo obrigatório é o que impede o caminho sem assinatura de virar o   │
 * │ caminho mais curto. Dez caracteres não são burocracia: são a diferença    │
 * │ entre "recolhido pelo RH em 12/08" e um espaço em branco.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function podeEncerrarDevolucao(p: {
  assinou: boolean;
  motivo: string | null;
}): { ok: true } | { ok: false; erro: string } {
  if (p.assinou) return { ok: true };

  const motivo = (p.motivo ?? "").trim();
  if (motivo.length === 0) {
    return {
      ok: false,
      erro: "Sem a assinatura de quem devolve, escreva o motivo — por exemplo, que a pessoa foi desligada e o equipamento foi recolhido.",
    };
  }
  if (motivo.length < MOTIVO_SEM_ASSINATURA_MINIMO) {
    return {
      ok: false,
      erro: `O motivo precisa de ao menos ${MOTIVO_SEM_ASSINATURA_MINIMO} caracteres — o suficiente para alguém entender daqui a um ano.`,
    };
  }
  return { ok: true };
}

/**
 * O lembrete de entrega pendente ainda vale?
 *
 * Entre a devolução e a entrega a peça fica DISPONÍVEL, e não num estado
 * próprio. O lembrete não impede ninguém: se outra pessoa levou a peça no meio
 * do caminho, ele deixa de valer — foi decisão de quem estava lá, e insistir
 * transformaria uma intenção anotada num impedimento real.
 */
export function lembreteValido(p: {
  destinatarioId: string | null;
  situacao: string;
  temPosseAberta: boolean;
}): boolean {
  if (!p.destinatarioId) return false;
  if (p.temPosseAberta) return false;
  return p.situacao === "disponivel";
}

/**
 * A transferência de custódia, de uma pessoa para outra.
 *
 * Um formulário só, dois documentos. Ele encerra o termo de quem está com a
 * peça e — quando o destinatário é informado — deixa anotado para quem ela vai,
 * de modo que o segundo passo saiba de onde retomar.
 *
 * O DESTINATÁRIO É OPCIONAL de propósito. "Devolveu e ainda não sei para quem
 * vai" é caso tão real quanto "vou herdar a máquina do André", e obrigar um
 * nome ali faria quem não sabe inventar um.
 */
export const transferirCustodiaSchema = z
  .object({
    unidade_id: z.string().uuid(),
    data_devolucao: z.string().min(1, "Informe a data da devolução."),
    estado_devolucao: z.enum(ESTADOS),
    observacoes: textoOpcional(300),
    /** Nome de quem devolve, como sai no documento. */
    assinante: z.string().trim().min(1, "Informe o nome de quem devolve."),
    /** A imagem da assinatura, quando houve assinatura. */
    assinatura: opcional,
    motivo_sem_assinatura: textoOpcional(300),
    destinatario_id: z.string().uuid().nullable().optional().default(null),
  })
  .refine(
    (v) =>
      podeEncerrarDevolucao({
        assinou: Boolean(v.assinatura),
        motivo: v.motivo_sem_assinatura,
      }).ok,
    {
      path: ["motivo_sem_assinatura"],
      message:
        "Sem a assinatura de quem devolve, escreva o motivo com ao menos 10 caracteres.",
    },
  );

export type TransferirCustodiaInput = z.input<typeof transferirCustodiaSchema>;
export type TransferirCustodiaDados = z.output<typeof transferirCustodiaSchema>;
