// Domínio Certificados do equipamento — client-safe.
//
// O vencimento que é DATA, e não horímetro. `apontamento.ts` cuida da revisão
// por uso (250 h de óleo no gerador); aqui está a metade que custa multa:
// inspeção de PTA, PMOC, teste de carga e calibração vencem por calendário,
// tenha a máquina trabalhado 2.000 horas ou ficado parada no pátio.
//
// A gramática é a mesma de `catalogo.ts`: o TIPO declara o que exige, a PEÇA
// cumpre. `campos_ficha` está para `ficha` assim como `certificados_exigidos`
// está para `certificado_equipamento`.

import { z } from "zod";
import { numeroOpcional, textoOpcional } from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";

// ═══════════════════════════════════════════════════════════════════════════
// O vocabulário
// ═══════════════════════════════════════════════════════════════════════════

/**
 * As espécies de certificado.
 *
 * FECHADO de propósito. Campo livre aqui produz `PMOC`, `P.M.O.C.` e `Pmoc` na
 * mesma coluna, e aí o cruzamento com a exigência do tipo não fecha — em
 * silêncio, que é o pior jeito de não fechar.
 *
 * Não é taxonomia de usuário: são categorias regulatórias, e mudam quando a
 * norma muda, não quando alguém tem uma ideia. `outro` cobre o laudo que não
 * cabe em nenhuma, com o nome dele nas observações.
 */
export const ESPECIES_CERTIFICADO = [
  "inspecao_periodica",
  "pmoc",
  "teste_carga",
  "calibracao",
  "art",
  "laudo_eletrico",
  "outro",
] as const;

export type EspecieCertificado = (typeof ESPECIES_CERTIFICADO)[number];

export const ESPECIE_INFO: Record<
  EspecieCertificado,
  { label: string; ajuda: string }
> = {
  inspecao_periodica: {
    label: "Inspeção periódica",
    ajuda: "PTA, guindaste, elevador de obra. NR-12 e NR-18. Equipamento sem ela é interditado em fiscalização.",
  },
  pmoc: {
    label: "PMOC",
    ajuda: "Plano de manutenção do ar-condicionado. Lei 13.589/2018, obrigatório em ambiente climatizado de uso coletivo.",
  },
  teste_carga: {
    label: "Teste de carga",
    ajuda: "Talha, guincho, cinta, estropo. NR-11 e NR-12. É o item que mata quando falha.",
  },
  calibracao: {
    label: "Calibração ou aferição",
    ajuda: "Instrumento de medição e ensaio. Sem ela a medida não tem valor e o ensaio é refeito.",
  },
  art: {
    label: "ART",
    ajuda: "Anotação de responsabilidade técnica, com o profissional e o CREA que respondem pelo equipamento.",
  },
  laudo_eletrico: {
    label: "Laudo elétrico",
    ajuda: "SPDA, aterramento, quadro de distribuição. NR-10.",
  },
  outro: {
    label: "Outro",
    ajuda: "O que não cabe nas demais. Escreva qual nas observações.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// O estado
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O estado de uma exigência, para a tela decidir a cor e o e-mail a ordem.
 *
 * `ausente` vem PRIMEIRO na gravidade, antes de `vencido`: uma PTA que nunca
 * teve inspeção lançada é pior que uma cuja inspeção venceu ontem — na segunda
 * alguém pelo menos sabia que a exigência existia.
 */
export type EstadoCertificado = "ausente" | "vencido" | "proximo" | "em_dia";

export const ESTADO_CERTIFICADO_INFO: Record<
  EstadoCertificado,
  { label: string; variant: "destructive" | "secondary" | "outline" }
> = {
  ausente: { label: "Sem certificado", variant: "destructive" },
  vencido: { label: "Vencido", variant: "destructive" },
  proximo: { label: "Vence em breve", variant: "secondary" },
  em_dia: { label: "Em dia", variant: "outline" },
};

/** A ordem em que as pendências aparecem: o que dói primeiro, primeiro. */
export const GRAVIDADE: Record<EstadoCertificado, number> = {
  ausente: 0,
  vencido: 1,
  proximo: 2,
  em_dia: 3,
};

/**
 * O estado de uma exigência, dado o vencimento do certificado atual.
 *
 * Compara **strings ISO**, não `Date`: a ordem lexicográfica de `yyyy-mm-dd` é
 * a mesma que a cronológica, e não passa por fuso nenhum. Converter para `Date`
 * traria de volta o bug de UTC que já cobrou um dia extra de multa (0.22.0).
 *
 * O dia do vencimento AINDA VALE. Marcá-lo como vencido tiraria de operação uma
 * máquina que está legal, e ensinaria a desconfiar justamente do aviso que
 * precisa ser levado a sério.
 *
 * `diasAviso` é parâmetro e não constante porque a organização já configura os
 * prazos em `config_alerta.dias_alerta`; fixar 30 aqui faria a tela discordar
 * do e-mail.
 */
export function estadoCertificado(
  venceEm: string | null,
  hojeISO: string,
  diasAviso = 30,
): EstadoCertificado {
  if (!venceEm) return "ausente";
  if (venceEm < hojeISO) return "vencido";
  return venceEm <= somarDias(hojeISO, diasAviso) ? "proximo" : "em_dia";
}

// ═══════════════════════════════════════════════════════════════════════════
// Aritmética de data, sem `Date`
// ═══════════════════════════════════════════════════════════════════════════
//
// `new Date("2026-03-10")` é meia-noite UTC, que em São Paulo é o dia 9. Toda
// conta feita por cima disso sai um dia adiantada — todo dia, em silêncio. As
// duas funções abaixo trabalham no calendário, por decomposição, e só usam
// `Date.UTC` (que não tem fuso) para normalizar o resultado.

function decompor(iso: string): [number, number, number] | null {
  if (!ehDataISO(iso)) return null;
  const [a, m, d] = iso.split("-").map(Number);
  return [a, m, d];
}

const paraISO = (t: number) => new Date(t).toISOString().slice(0, 10);

function somarDias(iso: string, dias: number): string {
  const p = decompor(iso);
  if (!p) return iso;
  return paraISO(Date.UTC(p[0], p[1] - 1, p[2] + dias));
}

/**
 * O vencimento que a tela PROPÕE ao lançar um certificado.
 *
 * Proposta, nunca cálculo: a validade impressa no laudo é que manda, e ela nem
 * sempre segue a regra — inspeção feita com atraso costuma valer 12 meses a
 * partir da vistoria, não do vencimento anterior.
 *
 * Satura no fim do mês: 31 de janeiro mais um mês é 28 de fevereiro, e não 3 de
 * março. Somar mês a mês sem saturar é como uma proposta de vencimento vira
 * uma data que não existe.
 */
export function venceEmProposto(
  emitidoEm: string,
  periodicidadeMeses: number | null,
): string | null {
  const p = decompor(emitidoEm);
  if (!p || !periodicidadeMeses || periodicidadeMeses <= 0) return null;

  const [ano, mes, dia] = p;
  const alvo = mes - 1 + periodicidadeMeses;
  const anoAlvo = ano + Math.floor(alvo / 12);
  const mesAlvo = ((alvo % 12) + 12) % 12;

  // Último dia do mês de destino: dia 0 do mês seguinte.
  const ultimoDia = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0)).getUTCDate();
  return paraISO(Date.UTC(anoAlvo, mesAlvo, Math.min(dia, ultimoDia)));
}

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Uma exigência declarada no tipo.
 *
 * `periodicidade_meses` é opcional: ART não se renova por calendário, ela vale
 * enquanto o profissional responde pelo equipamento. Nula, a tela simplesmente
 * não propõe vencimento.
 */
export const exigenciaSchema = z.object({
  especie: z.enum(ESPECIES_CERTIFICADO),
  periodicidade_meses: numeroOpcional.refine(
    (v) => v === null || (Number.isInteger(v) && v > 0 && v <= 120),
    "A periodicidade vai de 1 a 120 meses.",
  ),
});

export type Exigencia = z.output<typeof exigenciaSchema>;

/**
 * As exigências de um tipo.
 *
 * A unicidade da espécie é conferida AQUI e não no banco: `certificados_exigidos`
 * é jsonb, e duas linhas de PMOC no mesmo tipo fariam a view devolver a peça
 * duplicada — dois avisos idênticos para a mesma máquina.
 */
export const exigenciasSchema = z
  .array(exigenciaSchema)
  .max(10, "Dez exigências no mesmo tipo já é um formulário que ninguém preenche.")
  .refine(
    (lista) => new Set(lista.map((e) => e.especie)).size === lista.length,
    { message: "Há duas exigências da mesma espécie." },
  );

export const salvarExigenciasSchema = z.object({
  tipo_id: z.string().uuid(),
  exigencias: exigenciasSchema,
});

export type SalvarExigenciasDados = z.output<typeof salvarExigenciasSchema>;

/**
 * Um certificado lançado na peça.
 *
 * `vence_em` é obrigatório, e o `refine` cruzado repete a trava do banco. Ela
 * existe nos dois lugares de propósito: no banco porque é a última linha de
 * defesa, aqui porque vira mensagem na tela em vez de erro 500.
 */
export const certificadoSchema = z
  .object({
    unidade_id: z.string().uuid("Selecione a peça."),
    especie: z.enum(ESPECIES_CERTIFICADO),
    emitido_em: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .refine((v) => v === null || ehDataISO(v), "Data de emissão inválida."),
    vence_em: z
      .string()
      .trim()
      .refine(ehDataISO, "Informe a data de vencimento."),
    numero: textoOpcional(60),
    responsavel: textoOpcional(120),
    observacoes: textoOpcional(500),
  })
  .refine((c) => c.emitido_em === null || c.vence_em >= c.emitido_em, {
    message: "O vencimento não pode ser anterior à emissão.",
    path: ["vence_em"],
  });

export type CertificadoInput = z.input<typeof certificadoSchema>;
export type CertificadoDados = z.output<typeof certificadoSchema>;

/**
 * O pior estado de cada peça, indexado por `unidade_id`.
 *
 * A lista da frota mostra UM selo por linha, e ele tem de ser o do problema
 * mais grave: uma PTA com a inspeção em dia e o teste de carga ausente não pode
 * aparecer como "em dia" — seria uma tela dizendo que está tudo bem numa
 * máquina que não pode subir.
 */
export function piorPorPeca<T extends { unidadeId: string; estado: EstadoCertificado }>(
  pendencias: T[],
): Map<string, EstadoCertificado> {
  const pior = new Map<string, EstadoCertificado>();
  for (const p of pendencias) {
    const atual = pior.get(p.unidadeId);
    if (atual === undefined || GRAVIDADE[p.estado] < GRAVIDADE[atual]) {
      pior.set(p.unidadeId, p.estado);
    }
  }
  return pior;
}
