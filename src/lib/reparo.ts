// Domínio Ordem de reparo de equipamento — schemas e rótulos, client-safe.
//
// Os helpers de campo opcional vêm de `campos.ts` — fonte única. Escrever a
// própria cópia de três linhas foi o que fez o mesmo defeito voltar à produção
// seis vezes (ver o cabeçalho de `campos.ts`).

import { z } from "zod";
import {
  textoOpcional,
  uuidOpcional,
  dataOpcional,
  numeroOpcional,
} from "@/lib/campos";
import { ehDataISO } from "@/lib/locacao";
// A responsabilidade é a MESMA da avaria, importada e não recriada: quando o
// reparo vem de um dano, a pergunta "quem paga" é uma só, e dois vocabulários
// para ela produziriam relatórios que não batem.
export {
  RESPONSABILIDADES,
  RESPONSABILIDADE_INFO,
  responsabilidadeLabel,
} from "@/lib/avaria";
export type { Responsabilidade } from "@/lib/avaria";
import { RESPONSABILIDADES } from "@/lib/avaria";

// ═══════════════════════════════════════════════════════════════════════════
// Estados
// ═══════════════════════════════════════════════════════════════════════════

export const STATUS_REPARO = [
  "aberto",
  "em_execucao",
  "concluido",
  "cancelado",
] as const;
export type StatusReparo = (typeof STATUS_REPARO)[number];

/**
 * `aberto` e `em_execucao` são separados porque é ENTRE os dois que a peça
 * deixa a obra. A ordem pode ser emitida hoje e a máquina sair na quinta; até
 * lá ela continua disponível, e marcá-la como em manutenção antes da hora
 * esconderia da obra um equipamento que ainda está lá.
 */
export const STATUS_REPARO_INFO: Record<
  StatusReparo,
  { label: string; variant: "secondary" | "default" | "outline" | "destructive"; ajuda: string }
> = {
  aberto: {
    label: "Aberta",
    variant: "secondary",
    ajuda: "Ordem emitida. A peça ainda está na obra.",
  },
  em_execucao: {
    label: "Em execução",
    variant: "default",
    ajuda: "A peça saiu para a oficina e consta como em manutenção.",
  },
  concluido: {
    label: "Concluída",
    variant: "outline",
    ajuda: "Serviço feito, peça de volta e disponível.",
  },
  cancelado: {
    label: "Cancelada",
    variant: "destructive",
    ajuda: "Desfeita antes de concluir. A peça volta a ficar disponível.",
  },
};

export function statusReparoLabel(v: string): string {
  return STATUS_REPARO_INFO[v as StatusReparo]?.label ?? v;
}

// ═══════════════════════════════════════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A ordem de reparo. `id` presente = edição.
 *
 * A ordem NÃO tem rascunho: ela nasce como documento numerado, porque é ela que
 * autoriza a peça a sair da obra. Por isso o status vive aqui, e não numa ação
 * de fechamento à parte.
 */
export const reparoSchema = z
  .object({
    id: uuidOpcional,
    unidade_id: z.string().uuid("Selecione a peça."),
    avaria_id: uuidOpcional,
    status: z.enum(STATUS_REPARO),
    descricao: z
      .string()
      .trim()
      .min(3, "Descreva o serviço a ser feito.")
      .max(2000),
    executor: textoOpcional(200),
    aberto_em: z.string().refine(ehDataISO, "Informe a data de abertura."),
    enviado_em: dataOpcional,
    previsto_para: dataOpcional,
    concluido_em: dataOpcional,
    valor: z.coerce.number().min(0, "O valor não pode ser negativo.").default(0),
    responsabilidade: z.enum(RESPONSABILIDADES),
    garantia_dias: numeroOpcional,
    observacoes: textoOpcional(2000),
  })
  // O banco tem a mesma trava (`reparo_concluido_tem_data`). Aqui ela existe
  // para a mensagem: a do Postgres chegaria como erro genérico de constraint.
  .refine((v) => v.status !== "concluido" || v.concluido_em !== null, {
    message: "Informe a data em que o reparo foi concluído.",
    path: ["concluido_em"],
  })
  // Peça na oficina sem data de saída deixa a contagem de indisponibilidade sem
  // início — e é ela que responde "há quanto tempo esta máquina está fora".
  .refine((v) => v.status !== "em_execucao" || v.enviado_em !== null, {
    message: "Informe a data em que a peça saiu para a oficina.",
    path: ["enviado_em"],
  })
  // Voltar antes de sair é erro de digitação, e o banco aceitaria em silêncio.
  .refine(
    (v) => !v.enviado_em || !v.concluido_em || v.concluido_em >= v.enviado_em,
    {
      message: "A conclusão não pode ser anterior à saída da peça.",
      path: ["concluido_em"],
    },
  );

export type ReparoInput = z.input<typeof reparoSchema>;
export type ReparoDados = z.output<typeof reparoSchema>;
