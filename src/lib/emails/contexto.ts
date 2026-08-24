// Monta o `Contexto` dos e-mails a partir da linha de `organizacao`.
//
// Não faz consulta: recebe a linha já lida. É o que permite usá-lo tanto no cron
// (que roda com `createAdminClient`, sem sessão, e por isso não pode passar por
// `src/lib/data/`) quanto numa server action com o client normal — e, de quebra,
// deixa a montagem testável sem banco.

import { formatarCnpj, normalizarCnpj } from "@/lib/cnpj";
import type { Contexto, Remetente } from "./base";

/**
 * O `select` da organização para e-mail, escrito uma vez.
 *
 * Duas rotas de cron e uma server action precisam das mesmas três colunas. Com a
 * string repetida, acrescentar uma coluna ao rodapé exigiria achar os três — e o
 * que ficasse para trás produziria um rodapé silenciosamente incompleto.
 */
export const SELECT_ORGANIZACAO_EMAIL = "nome, razao_social, cnpj";

/** A linha de `organizacao` que `SELECT_ORGANIZACAO_EMAIL` devolve. */
export type LinhaOrganizacaoEmail = {
  nome: string | null;
  razao_social: string | null;
  cnpj: string | null;
};

/** Usado quando `NEXT_PUBLIC_APP_URL` não serve para e-mail. */
const URL_PADRAO = "https://loca-sistenge.vercel.app";

/**
 * Endereço público do app. Base dos links do corpo e do `src` do logotipo.
 *
 * Exige `https://`: em desenvolvimento a variável vale `http://localhost:3000`,
 * e nenhuma caixa de entrada no mundo resolve `localhost` — o logotipo chegaria
 * quebrado em todo e-mail e os links não levariam a lugar nenhum. Aqui, um valor
 * que não serve para e-mail é o mesmo que valor ausente.
 */
export function appUrl(): string {
  const v = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return v?.startsWith("https://") ? v.replace(/\/+$/, "") : URL_PADRAO;
}

export function montarRemetente(org: LinhaOrganizacaoEmail | null): Remetente {
  const cru = org?.cnpj ? normalizarCnpj(org.cnpj) : "";
  return {
    nome: org?.nome?.trim() || "Organização",
    razaoSocial: org?.razao_social?.trim() || null,
    // Formatado aqui, e não no template: o banco guarda sem máscara, e o
    // template não deveria conhecer o formato de CNPJ.
    cnpj: cru ? formatarCnpj(cru) : null,
  };
}

export function montarContexto(org: LinhaOrganizacaoEmail | null): Contexto {
  return { remetente: montarRemetente(org), appUrl: appUrl() };
}
