import "server-only";

import { parseTitulos, type TituloMega } from "./contrato";

/**
 * O cliente HTTP do Mega (contas a pagar).
 *
 * `server-only`: leva `MEGA_PASSWORD` e `MEGA_TENANT`. O tenant é GUID e é
 * segredo tanto quanto a senha — um import descuidado a partir de componente
 * cliente publicaria os dois no bundle do navegador.
 *
 * A REGRA QUE MANDA NESTE ARQUIVO: uma autenticação por vez. Encadear
 * tentativas com credencial real já bloqueou a conta `120.apifin` no ERP, e a
 * conta é compartilhada com o projeto Financeiro — derrubá-la aqui para o
 * pagamento lá. Por isso o token é reaproveitado dentro da rodada e a falha de
 * autenticação NUNCA é repetida automaticamente.
 */

const BASE = "https://rest.megaerp.online";

/** O token do Mega vale 2 h. 100 min deixa margem para a rodada terminar. */
const VALIDADE_TOKEN_MS = 100 * 60 * 1000;

export type ConfigMega = { tenant: string; usuario: string; senha: string };

/**
 * O ambiente, ou `null` se não estiver configurado.
 *
 * FAIL-CLOSED, igual ao cliente do People: sem as três variáveis não se chama
 * nada — em vez de sair batendo na API com credencial pela metade, que é
 * exatamente o caminho para o bloqueio da conta.
 */
export function configMega(): ConfigMega | null {
  const tenant = process.env.MEGA_TENANT?.trim();
  const usuario = process.env.MEGA_USER?.trim();
  const senha = process.env.MEGA_PASSWORD?.trim();
  if (!tenant || !usuario || !senha) return null;
  return { tenant, usuario, senha };
}

export function megaConfigurado(): boolean {
  return configMega() !== null;
}

export class ErroMega extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroMega";
  }
}

/**
 * Lê o corpo como TEXTO e só então converte.
 *
 * DUAS ARMADILHAS MEDIDAS, e `res.json()` cai nas duas:
 *  - erro de autenticação do Mega volta com HTTP 200 e `text/plain`, então o
 *    status não denuncia nada e o parse estoura com uma mensagem que não ajuda;
 *  - a resposta pode vir com BOM, e `JSON.parse` recusa o `﻿` inicial.
 */
async function corpoJson(res: Response): Promise<unknown> {
  const texto = (await res.text()).replace(/^﻿/, "").trim();
  if (!texto.startsWith("{") && !texto.startsWith("[")) {
    // O corpo pode conter detalhe da credencial recusada; não vai para o log.
    throw new ErroMega(res.status, "O Mega respondeu algo que não é JSON.");
  }
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroMega(res.status, "O Mega respondeu um JSON inválido.");
  }
}

/** Sessão de UMA rodada. Não é cache global: o módulo morre com a invocação. */
export class SessaoMega {
  private token: string | null = null;
  private obtidoEm = 0;
  private autenticacaoFalhou = false;

  constructor(private readonly cfg: ConfigMega) {}

  private async autenticar(): Promise<string> {
    // TRAVA DE SEGURANÇA, não otimização. Se a credencial foi recusada uma vez,
    // repetir é o comportamento que bloqueia a conta. A rodada morre aqui.
    if (this.autenticacaoFalhou) {
      throw new ErroMega(401, "Autenticação no Mega já falhou nesta rodada.");
    }
    const res = await fetch(`${BASE}/api/Auth/SignIn`, {
      method: "POST",
      headers: {
        grantType: "Api",
        tenantId: this.cfg.tenant,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ userName: this.cfg.usuario, password: this.cfg.senha }),
      cache: "no-store",
    });

    let corpo: unknown;
    try {
      corpo = await corpoJson(res);
    } catch (e) {
      this.autenticacaoFalhou = true;
      throw e;
    }

    const token =
      corpo && typeof corpo === "object" && "accessToken" in corpo
        ? (corpo as { accessToken?: unknown }).accessToken
        : null;

    if (typeof token !== "string" || token.length === 0) {
      this.autenticacaoFalhou = true;
      throw new ErroMega(res.status, "O Mega não devolveu token de acesso.");
    }

    this.token = token;
    this.obtidoEm = Date.now();
    return token;
  }

  private async tokenValido(): Promise<string> {
    if (this.token && Date.now() - this.obtidoEm < VALIDADE_TOKEN_MS) {
      return this.token;
    }
    return this.autenticar();
  }

  /**
   * Os títulos a pagar de um fornecedor, por período.
   *
   * `codigo` vai CRU (`2630`). A documentação do ERP diz `1-2630` e a rota
   * recusa: `The value '1-2630' is not valid`. O formato com prefixo só vale em
   * `/api/globalagente/Agente/{id}`.
   */
  async titulosDoFornecedor(
    codigo: string,
    inicioISO: string,
    fimISO: string,
  ): Promise<{ titulos: TituloMega[]; recusados: number }> {
    const token = await this.tokenValido();
    const rota = `${BASE}/api/FinanceiroMovimentacao/FaturaPagar/Saldo/Agente/${encodeURIComponent(codigo)}/${inicioISO}/${fimISO}`;

    const res = await fetch(rota, {
      headers: {
        Authorization: `Bearer ${token}`,
        tenantId: this.cfg.tenant,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new ErroMega(res.status, `O Mega recusou a consulta do fornecedor ${codigo}.`);
    }
    return parseTitulos(await corpoJson(res));
  }
}
