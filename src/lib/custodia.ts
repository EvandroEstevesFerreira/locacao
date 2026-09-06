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
  tem_horimetro: z.boolean().default(false),
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
