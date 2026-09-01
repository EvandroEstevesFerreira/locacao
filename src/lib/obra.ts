// Domínio Obra: rótulos, schema e helpers puros.
//
// Sem dependências de servidor — o schema é importado tanto pela action
// (validação de verdade) quanto pelo formulário (validação por campo via
// zodResolver). Ficava dentro de `obras/actions.ts`, e um arquivo "use server"
// não pode ser importado por componente cliente.

import { z } from "zod";
import { idOpcional, textoOpcional as textoOpcionalCampo } from "@/lib/campos";

export const STATUS_OBRA = ["ativa", "pausada", "encerrada"] as const;
export type StatusObra = (typeof STATUS_OBRA)[number];

export const STATUS_OBRA_INFO: Record<
  StatusObra,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  ativa: { label: "Ativa", variant: "default" },
  pausada: { label: "Pausada", variant: "secondary" },
  encerrada: { label: "Encerrada", variant: "outline" },
};

/**
 * Campos de texto opcionais chegam como "" do formulário e precisam virar NULL
 * no banco — senão um "sem responsável" fica gravado como string vazia e
 * qualquer `is null` deixa de encontrá-lo.
 *
 * IDEMPOTÊNCIA — o `z.union([z.string(), z.null()])` não é decoração. A action
 * re-valida o que recebe, e o que ela recebe é o OUTPUT deste mesmo schema,
 * porque o zodResolver já transformou no cliente. Com `z.string().optional()`
 * puro, o `null` produzido aqui era recusado na segunda passagem: salvar uma
 * obra sem endereço, sem responsável ou sem centro de custo falhava com "Dados
 * inválidos" e nada dizia qual campo.
 *
 * Mesmo defeito que `src/lib/imoveis.ts` teve — lá foi corrigido na 0.31.x e
 * aqui passou batido, porque nenhum teste exercitava a segunda passagem.
 */
// Vem de `campos.ts`: uma implementação para todo o sistema, e não uma cópia
// por arquivo — foi a cópia que fez o mesmo defeito voltar três vezes.
const textoOpcional = textoOpcionalCampo;

/**
 * E-mails extras de aviso da obra — SÓ para quem não tem login no Loca.
 *
 * Quem tem usuário vinculado à obra já recebe pelo vínculo (`obra_usuario`, a
 * mesma fonte que a RLS usa para o acesso). Repetir essas pessoas aqui criaria
 * uma segunda lista: tirar alguém da obra não tiraria os alertas dela.
 *
 * Aceita textarea (uma linha por endereço) e array — o formulário manda string,
 * a re-validação da action recebe o array que este transform produziu.
 */
const emailsOpcionais = z
  .union([z.string(), z.array(z.string()), z.null()])
  .optional()
  .transform((v) => {
    const bruto = Array.isArray(v) ? v : String(v ?? "").split(/[\n,;]+/);
    return [...new Set(bruto.map((s) => s.trim().toLowerCase()).filter(Boolean))];
  })
  .refine((v) => v.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)), {
    message: "Há um endereço de e-mail inválido na lista.",
  })
  .refine((v) => v.length <= 20, {
    message: "Use no máximo 20 endereços. Para mais que isso, vincule usuários à obra.",
  });

export const obraSchema = z.object({
  // `id` presente = edição; em branco = criação (o <input hidden> do form
  // manda `""`, e é por isso que o campo é `idOpcional`).
  id: idOpcional,
  codigo: z.string().trim().min(1, "Informe o código da obra.").max(50),
  nome: z.string().trim().min(1, "Informe o nome da obra.").max(200),
  endereco: textoOpcional(300),
  responsavel: textoOpcional(200),
  centro_custo: textoOpcional(100),
  status: z.enum(STATUS_OBRA),
  destinatarios_alerta: emailsOpcionais,
});

export type ObraInput = z.input<typeof obraSchema>;
export type ObraDados = z.output<typeof obraSchema>;
