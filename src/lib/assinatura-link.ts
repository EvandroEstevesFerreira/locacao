// Assinatura à distância — schemas e regras client-safe.
//
// O formulário público importa daqui, então nada de `server-only` e nada de
// `node:crypto`: a geração e o hash do token vivem em `assinatura-servidor.ts`.

import { z } from "zod";

/** Quanto tempo um link vive. Sete dias cobrem uma semana de campo. */
export const DIAS_DE_VALIDADE = 7;

/**
 * Só os algarismos de um CPF.
 *
 * O cadastro pode ter `123.456.789-00` e a pessoa digitar `12345678900`. São o
 * mesmo CPF, e recusar por pontuação seria recusar por nada — a comparação no
 * banco também é por algarismo.
 */
export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, "");
}

/**
 * Dígitos verificadores do CPF.
 *
 * Conferir aqui NÃO substitui a conferência do banco — ela é a que vale, e é a
 * única que sabe qual é o CPF certo. Esta serve para dizer "faltou um dígito"
 * antes de gastar uma ida ao servidor, e para recusar `111.111.111-11`, que
 * passa na conta mas não é CPF de ninguém.
 */
export function cpfValido(bruto: string): boolean {
  const cpf = apenasDigitos(bruto);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(cpf[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

export const assinaturaLinkSchema = z.object({
  cpf: z
    .string()
    .trim()
    .min(1, "Informe o seu CPF.")
    .refine(cpfValido, "CPF inválido. Confira os números."),
  /**
   * O traço da assinatura, em data URL. Opcional porque o aceite é o ato de
   * confirmar o CPF e enviar — o desenho é evidência a mais, não a única.
   */
  imagem: z.union([z.string(), z.null()]).optional(),
});

export type AssinaturaLinkInput = z.output<typeof assinaturaLinkSchema>;

/** Os estados que a página pública sabe mostrar. */
export type EstadoLink = "pronto" | "sem_cpf" | "indisponivel" | "invalido";

export const ESTADO_LINK_INFO: Record<
  Exclude<EstadoLink, "pronto">,
  { titulo: string; texto: string }
> = {
  sem_cpf: {
    titulo: "Ainda não é possível assinar por aqui",
    texto:
      "O seu CPF não está cadastrado, e é ele que confirma que é você quem está assinando. Procure o setor que enviou este link.",
  },
  indisponivel: {
    titulo: "Este termo não está mais aguardando assinatura",
    texto:
      "Ele já foi assinado ou cancelado. Se você não reconhece isso, procure o setor que enviou este link.",
  },
  invalido: {
    titulo: "Link inválido ou expirado",
    texto:
      "Links de assinatura valem por sete dias e servem uma vez só. Peça um novo ao setor que enviou este.",
  },
};
