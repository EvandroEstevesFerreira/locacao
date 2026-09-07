import "server-only";

import {
  paginaPeopleSchema,
  erroPeopleSchema,
  type PessoaPeople,
} from "./contrato";

/**
 * O cliente HTTP da API de pessoas do People.
 *
 * Spec: docs/superpowers/specs/2026-09-07-integracao-people-design.md
 *
 * `server-only`: leva o `PEOPLE_API_TOKEN`, e um import descuidado a partir de
 * componente cliente publicaria o token no bundle do navegador.
 */

/** Teto de páginas numa rodada. 483 pessoas em páginas de 100 são 5. */
const MAX_PAGINAS = 50;

export type ConfigPeople = { url: string; token: string };

/**
 * O ambiente, ou `null` se não estiver configurado.
 *
 * FAIL-CLOSED, igual ao lado do People. Sem URL ou sem token, a sincronização
 * não roda — em vez de sair chamando um endereço vazio e gravar o que voltar.
 */
export function configPeople(): ConfigPeople | null {
  const url = process.env.PEOPLE_API_URL?.trim();
  const token = process.env.PEOPLE_API_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token };
}

export function peopleConfigurado(): boolean {
  return configPeople() !== null;
}

/** Erro com o código do contrato preservado, para quem chama decidir. */
export class ErroPeople extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroPeople";
  }
}

type Buscador = typeof fetch;

/**
 * Uma página. `cursor` nulo é a primeira.
 *
 * `desde` e `cursor` são MUTUAMENTE EXCLUSIVOS na prática: o cursor é keyset
 * sobre `(atualizado_em, id)` e já carrega o recorte de onde parou. Mandar os
 * dois seria pedir ao People que respeitasse duas origens diferentes.
 */
async function buscarPagina(
  cfg: ConfigPeople,
  params: { desde?: string | null; cursor?: string | null; limite?: number },
  buscador: Buscador,
) {
  const url = new URL(cfg.url);
  if (params.cursor) url.searchParams.set("cursor", params.cursor);
  else if (params.desde) url.searchParams.set("desde", params.desde);
  url.searchParams.set("limite", String(params.limite ?? 100));

  const resposta = await buscador(url.toString(), {
    headers: {
      // NUNCA em query string: o contrato pede, e endereço com token dentro
      // vaza em log de proxy, histórico de navegador e print de tela.
      Authorization: `Bearer ${cfg.token}`,
      Accept: "application/json",
    },
    // Dado de pessoa muda; resposta cacheada devolveria um cursor velho e a
    // rodada andaria em círculo.
    cache: "no-store",
  });

  if (!resposta.ok) {
    const corpo = await resposta.json().catch(() => null);
    const erro = erroPeopleSchema.safeParse(corpo);
    throw new ErroPeople(
      resposta.status,
      erro.success ? erro.data.erro : "resposta_inesperada",
      erro.success && erro.data.mensagem
        ? erro.data.mensagem
        : `O People respondeu ${resposta.status}.`,
    );
  }

  const corpo = await resposta.json();
  const pagina = paginaPeopleSchema.safeParse(corpo);
  if (!pagina.success) {
    // O CONTRATO ESTÁ FECHADO, MAS O QUE CHEGA PELA REDE É `unknown`. Um campo
    // renomeado num deploy do People escreveria `undefined` em 483 linhas, e o
    // estrago só apareceria com o nome de quem recebe o termo em branco.
    throw new ErroPeople(
      200,
      "payload_fora_do_contrato",
      `A resposta do People não bate com o contrato: ${pagina.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
  }
  return pagina.data;
}

/**
 * Todas as pessoas desde `desde`, seguindo o cursor até o fim.
 *
 * O cursor é OPACO — vem de `proxima_pagina` e volta como veio. O contrato pede
 * explicitamente para não construí-lo à mão: o formato é detalhe interno do
 * People e pode mudar sem aviso.
 *
 * O teto de páginas não é desconfiança do People: é o que impede um bug de
 * cursor que sempre devolve a mesma página de rodar até o timeout da função.
 */
export async function buscarPessoas(
  cfg: ConfigPeople,
  desde: string | null,
  buscador: Buscador = fetch,
): Promise<{ pessoas: PessoaPeople[]; paginas: number }> {
  const pessoas: PessoaPeople[] = [];
  let cursor: string | null = null;
  let paginas = 0;

  do {
    const pagina = await buscarPagina(cfg, { desde, cursor }, buscador);
    pessoas.push(...pagina.pessoas);
    cursor = pagina.proxima_pagina;
    paginas++;

    if (paginas >= MAX_PAGINAS && cursor) {
      throw new ErroPeople(
        200,
        "paginacao_sem_fim",
        `A paginação passou de ${MAX_PAGINAS} páginas sem terminar.`,
      );
    }
  } while (cursor);

  return { pessoas, paginas };
}
