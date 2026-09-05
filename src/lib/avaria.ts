// Domínio Avaria — schemas e rótulos, client-safe.
//
// A avaria existe desde a 0007 com quatro campos. A fase 2b acrescenta o que
// falta para EMITIR UM LAUDO: qual peça, quando foi constatada, em qual
// devolução e quem responde.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import { textoOpcional, uuidOpcional } from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";

// ═══════════════════════════════════════════════════════════════════════════
// Responsabilidade
// ═══════════════════════════════════════════════════════════════════════════

export const RESPONSABILIDADES = [
  "indefinida",
  "fornecedor",
  "obra",
  "funcionario",
] as const;
export type Responsabilidade = (typeof RESPONSABILIDADES)[number];

/**
 * `indefinida` é o PADRÃO, e é o ponto do conjunto.
 *
 * O laudo é emitido para APURAR, não depois de apurado. Um conjunto sem
 * "indefinida" forçaria quem preenche a apontar um culpado no momento da
 * constatação — que é exatamente quando ainda não se sabe. E o palpite viraria
 * o registro oficial, com nome de pessoa dentro.
 */
export const RESPONSABILIDADE_INFO: Record<
  Responsabilidade,
  {
    label: string;
    variant: "secondary" | "outline" | "destructive" | "default";
    ajuda: string;
  }
> = {
  indefinida: {
    label: "A apurar",
    variant: "secondary",
    ajuda: "Ainda não se sabe. É como toda avaria começa.",
  },
  fornecedor: {
    label: "Do fornecedor",
    variant: "outline",
    ajuda:
      "O dano é anterior à locação ou decorre de desgaste natural. Não se cobra da obra.",
  },
  obra: {
    label: "Da obra",
    variant: "destructive",
    ajuda:
      "Dano ocorrido no uso, sem responsável individual identificado. Vira custo da obra.",
  },
  funcionario: {
    label: "De funcionário",
    variant: "destructive",
    ajuda:
      "Dano por mau uso, negligência ou extravio atribuível a alguém. Exige a apuração descrita no laudo.",
  },
};

export function responsabilidadeLabel(v: string): string {
  return RESPONSABILIDADE_INFO[v as Responsabilidade]?.label ?? v;
}

// ═══════════════════════════════════════════════════════════════════════════
// Status
// ═══════════════════════════════════════════════════════════════════════════
//
// FONTE ÚNICA. `vistoria.ts` tinha a própria cópia deste mapa, e as duas já
// divergiam antes de existirem lado a lado: "aberta" era `default` lá e
// `secondary` aqui — a mesma avaria com cor diferente na tela da vistoria e na
// lista de avarias. `vistoria.ts` agora reexporta daqui.
//
// O tipo continua morando em `vistoria.ts` porque é de lá que os consumidores
// antigos o importam, e movê-lo não acrescentaria nada.

import type { StatusAvaria } from "@/lib/vistoria";
export type { StatusAvaria };

export const STATUS_AVARIA_VALORES = ["aberta", "cobrada", "resolvida"] as const;

export const STATUS_AVARIA_INFO: Record<
  StatusAvaria,
  { label: string; variant: "default" | "secondary" | "outline"; ajuda: string }
> = {
  // `default` porque "aberta" é o estado ACIONÁVEL: é a avaria que alguém
  // ainda precisa apurar, e ela tem de saltar da lista.
  aberta: {
    label: "Aberta",
    variant: "default",
    ajuda: "Constatada, sem desfecho financeiro.",
  },
  cobrada: {
    label: "Cobrada",
    variant: "secondary",
    ajuda: "Virou lançamento financeiro.",
  },
  resolvida: {
    label: "Resolvida",
    variant: "outline",
    ajuda: "Encerrada — reparada, absorvida ou negociada.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * O laudo de uma avaria que já existe.
 *
 * Só os campos do laudo: descrição, custo e status seguem sendo editados na
 * vistoria, que é onde a avaria nasce. Separar evita que salvar o laudo
 * sobrescreva em silêncio um custo que outra pessoa acabou de corrigir.
 *
 * A validação de data é `ehDataISO` e não um regex escrito aqui: um
 * `/^\d{4}-\d{2}-\d{2}$/` digitado dentro de template literal já perdeu as
 * barras invertidas duas vezes neste projeto, e a segunda foi para produção.
 */
export const laudoAvariaSchema = z.object({
  id: z.string().uuid(),
  data: z.string().refine(ehDataISO, "Informe a data em que a avaria foi constatada."),
  responsabilidade: z.enum(RESPONSABILIDADES),
  unidade_id: uuidOpcional,
  laudo: textoOpcional(4000),
});

export type LaudoAvariaInput = z.input<typeof laudoAvariaSchema>;
export type LaudoAvariaDados = z.output<typeof laudoAvariaSchema>;
