import "server-only";

import { parseContratos, type ContratoMega } from "./contratos";
import {
  parseTitulos,
  agenteMegaSchema,
  type TituloMega,
  type AgenteMega,
} from "./contrato";

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

/**
 * A validade do token quando o Mega NÃO disser qual é.
 *
 * O certo é ler `expirationToken` da resposta, e é o que `autenticar` faz.
 * Isto é o fallback: assumir a duração é o defeito que expira em produção no
 * dia em que o fornecedor mudar a política, e o sintoma é um 401 intermitente
 * que ninguém liga à causa.
 */
const VALIDADE_TOKEN_PADRAO_MS = 100 * 60 * 1000;

/** Margem para o token não vencer no meio de uma sequência de chamadas. */
const MARGEM_TOKEN_MS = 5 * 60 * 1000;

/**
 * Teto de tempo por chamada.
 *
 * Sem ele, uma rota lenta pendura a invocação até o limite da plataforma — o
 * cron tem `maxDuration = 300`, então uma única rota travada consome a rodada
 * inteira e as outras consultas nem chegam a sair.
 */
const TIMEOUT_MS = 30_000;

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
  /** Epoch ms em que o token deixa de valer, já com margem. */
  private expiraEm = 0;
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
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
    // A EXPIRAÇÃO SAI DA RESPOSTA, NÃO DE UMA CONSTANTE NOSSA. O SignIn devolve
    // quatro campos (`accessToken`, `expirationToken`, `refreshToken`,
    // `expirationRefreshToken`); os dois de expiração não constavam na
    // documentação que recebemos, e é `expirationToken` que manda.
    const bruto =
      corpo && typeof corpo === "object" && "expirationToken" in corpo
        ? (corpo as { expirationToken?: unknown }).expirationToken
        : null;
    const anunciado = typeof bruto === "string" ? Date.parse(bruto) : NaN;
    this.expiraEm = Number.isNaN(anunciado)
      ? Date.now() + VALIDADE_TOKEN_PADRAO_MS
      : anunciado - MARGEM_TOKEN_MS;
    return token;
  }

  private async tokenValido(): Promise<string> {
    if (this.token && Date.now() < this.expiraEm) return this.token;
    return this.autenticar();
  }

  /**
   * Um GET autenticado, com teto de tempo e UMA renovação por 401.
   *
   * A RENOVAÇÃO É ÚNICA, E ISSO NÃO É ECONOMIA. Encadear tentativas de login
   * com credencial real já bloqueou a conta `120.apifin`, que é compartilhada
   * com o projeto Financeiro. Se o segundo 401 vier, ele propaga — nunca há um
   * terceiro. A trava de `autenticacaoFalhou` fecha o resto.
   */
  private async buscar(rota: string): Promise<Response> {
    const chamar = async (token: string) =>
      fetch(rota, {
        headers: {
          Authorization: `Bearer ${token}`,
          tenantId: this.cfg.tenant,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

    let res = await chamar(await this.tokenValido());
    if (res.status === 401) {
      // O token morreu antes da hora anunciada. UMA renovação, e só.
      this.token = null;
      res = await chamar(await this.tokenValido());
    }
    return res;
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
    const rota = `${BASE}/api/FinanceiroMovimentacao/FaturaPagar/Saldo/Agente/${encodeURIComponent(codigo)}/${inicioISO}/${fimISO}`;

    const res = await this.buscar(rota);

    if (!res.ok) {
      // A MENSAGEM DO ERP VAI JUNTO, e isso não é detalhe. Sem ela, a primeira
      // rodada em produção rendeu 37 linhas de "o Mega recusou a consulta" e
      // nenhuma pista; o motivo real ("o intervalo máximo permitido entre as
      // datas é 2 ano") só apareceu ao repetir a chamada à mão.
      //
      // Só nesta rota. O corpo do SignIn continua fora do log: lá o que volta
      // pode falar da credencial.
      const detalhe = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      throw new ErroMega(
        res.status,
        `O Mega recusou a consulta do fornecedor ${codigo} (HTTP ${res.status}): ${detalhe}`,
      );
    }
    return parseTitulos(await corpoJson(res));
  }

  /**
   * TODAS as parcelas do período, sem filtrar agente.
   *
   * UMA CHAMADA NO LUGAR DE 37. Medido em 10/09/2026: `Saldo/2026-09-01/
   * 2026-09-30` devolveu 458 parcelas de 224 agentes. Consultar fornecedor a
   * fornecedor multiplicava por 37 a carga sobre uma conta de API que já foi
   * bloqueada uma vez.
   *
   * O PREÇO: `Agente.Nome` e `Agente.Cnpj` vêm NULOS aqui — só o código vem.
   * O nome sai de `agentePorCodigo`, uma vez por agente, e fica em cache.
   */
  async titulosDoPeriodo(
    inicioISO: string,
    fimISO: string,
  ): Promise<{ titulos: TituloMega[]; recusados: number }> {
    const rota = `${BASE}/api/FinanceiroMovimentacao/FaturaPagar/Saldo/${inicioISO}/${fimISO}`;

    const res = await this.buscar(rota);

    if (!res.ok) {
      const detalhe = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      throw new ErroMega(
        res.status,
        `O Mega recusou a consulta de ${inicioISO} a ${fimISO} (HTTP ${res.status}): ${detalhe}`,
      );
    }
    return parseTitulos(await corpoJson(res));
  }

  /**
   * O nome e o documento de um agente.
   *
   * AQUI O CÓDIGO VAI COM PREFIXO (`1-2630`), ao contrário da rota de contas a
   * pagar, que quer ele cru. As duas rotas do mesmo ERP, com regras opostas —
   * medido, não documentado.
   */
  async agentePorCodigo(codigo: string, padrao = 1): Promise<AgenteMega | null> {
    const res = await this.buscar(
      `${BASE}/api/globalagente/Agente/${padrao}-${encodeURIComponent(codigo)}`,
    );

    // AGENTE QUE NÃO RESOLVE NÃO DERRUBA A RODADA. São centenas, e um código
    // que o ERP não reconhece é dado, não falha: vira "não sei o nome".
    if (!res.ok) return null;
    const r = agenteMegaSchema.safeParse(await corpoJson(res));
    return r.success ? r.data : null;
  }

  /**
   * O agente que tem este CPF/CNPJ, se houver.
   *
   * É O CAMINHO SEM ADIVINHAÇÃO. Casar locador por nome erra — "Rogerio Soares
   * de Lima" e "Rogerio Soares Lima" são a mesma pessoa em dois cadastros, e
   * dois locadores diferentes podem ter o mesmo aluguel de R$ 2.000. Documento
   * não tem esse problema.
   */
  async agentePorDocumento(documento: string): Promise<AgenteMega | null> {
    const limpo = documento.replace(/[^0-9A-Z]/gi, "");
    const res = await this.buscar(
      `${BASE}/api/globalagente/Agente/GetAgenteCnpj/${encodeURIComponent(limpo)}`,
    );

    // NÃO ENCONTRADO NÃO É ERRO. O locador pode simplesmente não estar
    // cadastrado no ERP ainda, e isso é resposta, não falha.
    if (!res.ok) return null;

    let corpo: unknown;
    try {
      corpo = await corpoJson(res);
    } catch {
      return null;
    }
    // A rota pode devolver um objeto ou uma lista de um.
    const alvo = Array.isArray(corpo) ? corpo[0] : corpo;
    const r = agenteMegaSchema.safeParse(alvo);
    return r.success ? r.data : null;
  }

  /**
   * TODOS os contratos do módulo de acompanhamento, numa chamada.
   *
   * Medido em 11/09/2026: 958 contratos de 247 fornecedores, com projeto,
   * medição e saldo. Consultar fornecedor a fornecedor seriam 37 chamadas
   * diárias para o mesmo dado.
   *
   * A DATA AQUI É `dd/MM/yyyy`, ao contrário da rota de contas a pagar, que
   * exige ISO e recusa o formato brasileiro. Mesmo ERP, duas convenções — e
   * mandar ISO aqui devolve HTTP 500, sem dizer por quê.
   */
  async contratos(inicioISO: string, fimISO: string): Promise<{
    contratos: ContratoMega[];
    recusados: number;
  }> {
    const br = (iso: string) => iso.split("-").reverse().join("/");
    const rota =
      `${BASE}/api/AcompanhamentoContratoEngenhariaX/Visoes/GetVisoesFornecedor` +
      `?data_inicio=${br(inicioISO)}&data_fim=${br(fimISO)}`;

    const res = await this.buscar(rota);

    if (!res.ok) {
      const detalhe = (await res.text()).replace(/\s+/g, " ").trim().slice(0, 300);
      throw new ErroMega(
        res.status,
        `O Mega recusou a consulta de contratos (HTTP ${res.status}): ${detalhe}`,
      );
    }
    return parseContratos(await corpoJson(res));
  }
}
