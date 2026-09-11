import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { SessaoMega, ErroMega } from "./cliente";

/**
 * O cliente do Mega, na parte que não dá para conferir olhando a tela.
 *
 * TRÊS COISAS SE COBRAM AQUI, e as três vêm de incidente real:
 *  - a credencial NUNCA aparece numa mensagem de erro (asserção negativa,
 *    passando a senha de propósito num corpo de erro);
 *  - a expiração do token sai da resposta do ERP, não de constante nossa;
 *  - o 401 rende UMA renovação. Encadear login já bloqueou a conta
 *    `120.apifin`, que é compartilhada com o projeto Financeiro.
 */

const SENHA = "s3nh4-secretissima";
const TENANT = "11111111-2222-3333-4444-555555555555";
const CFG = { tenant: TENANT, usuario: "120.apifin", senha: SENHA };

/** Um corpo de erro que ECOA o que foi enviado — o pior caso realista. */
const ERRO_QUE_ECOA = `Credencial recusada para 120.apifin / ${SENHA} no tenant ${TENANT}`;

const respostaTexto = (corpo: string, status = 200) =>
  new Response(corpo, { status, headers: { "content-type": "text/plain" } });

const respostaJson = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });

const signInOk = (expiraEm: string) =>
  respostaJson({
    accessToken: "tok-abc",
    expirationToken: expiraEm,
    refreshToken: "ref-abc",
    expirationRefreshToken: expiraEm,
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("a credencial nunca vaza", () => {
  // ESTA É A ASSERÇÃO NEGATIVA. O Mega responde erro de login com HTTP 200 e
  // `text/plain`, e o corpo pode ecoar o que foi enviado. Repassar esse corpo
  // adiante publicaria a senha no log da Vercel.
  it("não repete o corpo do SignIn na mensagem de erro", async () => {
    fetchMock.mockResolvedValueOnce(respostaTexto(ERRO_QUE_ECOA));
    const sessao = new SessaoMega(CFG);

    const erro = await sessao.agentePorCodigo("2630").catch((e) => e);

    expect(erro).toBeInstanceOf(ErroMega);
    expect(erro.message).not.toContain(SENHA);
    expect(erro.message).not.toContain(TENANT);
    expect(String(erro.stack)).not.toContain(SENHA);
  });

  // Só o SignIn é mudo. Na consulta, a mensagem do ERP VAI JUNTO de propósito:
  // sem ela, a primeira rodada em produção rendeu 37 linhas de "o Mega recusou"
  // e nenhuma pista do motivo real (o limite de 2 anos entre as datas).
  it("mas repassa o motivo quando o erro é da consulta", async () => {
    fetchMock
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockResolvedValueOnce(
        respostaTexto("O intervalo máximo permitido entre as datas é 2 ano.", 400),
      );
    const sessao = new SessaoMega(CFG);

    const erro = await sessao
      .titulosDoPeriodo("2025-01-01", "2027-12-31")
      .catch((e) => e);

    expect(erro.message).toContain("2 ano");
    expect(erro.message).not.toContain(SENHA);
  });
});

describe("a expiração do token vem da resposta", () => {
  it("reaproveita o token enquanto o Mega disser que ele vale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));
    fetchMock
      .mockResolvedValueOnce(signInOk("2026-09-11T12:00:00Z"))
      .mockImplementation(async () => respostaJson([]));
    const sessao = new SessaoMega(CFG);

    await sessao.titulosDoPeriodo("2026-09-01", "2026-09-30");
    vi.setSystemTime(new Date("2026-09-11T11:00:00Z"));
    await sessao.titulosDoPeriodo("2026-10-01", "2026-10-30");

    const logins = fetchMock.mock.calls.filter((c) => String(c[0]).includes("SignIn"));
    expect(logins).toHaveLength(1);
  });

  // O DEFEITO QUE ISTO EVITA: assumir 2 h quando o ERP anuncia menos rende 401
  // intermitente no fim da rodada, e ninguém liga o sintoma à causa.
  it("reautentica quando a hora anunciada passa, mesmo antes das 2 h", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-11T10:00:00Z"));
    fetchMock
      .mockResolvedValueOnce(signInOk("2026-09-11T10:20:00Z"))
      .mockResolvedValueOnce(respostaJson([]))
      .mockResolvedValueOnce(signInOk("2026-09-11T12:00:00Z"))
      .mockImplementation(async () => respostaJson([]));
    const sessao = new SessaoMega(CFG);

    await sessao.titulosDoPeriodo("2026-09-01", "2026-09-30");
    vi.setSystemTime(new Date("2026-09-11T10:25:00Z"));
    await sessao.titulosDoPeriodo("2026-10-01", "2026-10-30");

    const logins = fetchMock.mock.calls.filter((c) => String(c[0]).includes("SignIn"));
    expect(logins).toHaveLength(2);
  });
});

describe("a renovação por 401 é única", () => {
  it("renova uma vez e repete a consulta", async () => {
    fetchMock
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockResolvedValueOnce(respostaTexto("expirado", 401))
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockResolvedValueOnce(respostaJson([]));
    const sessao = new SessaoMega(CFG);

    await sessao.titulosDoPeriodo("2026-09-01", "2026-09-30");

    const logins = fetchMock.mock.calls.filter((c) => String(c[0]).includes("SignIn"));
    expect(logins).toHaveLength(2);
  });

  // A REGRA QUE PROTEGE A CONTA COMPARTILHADA. Segundo 401 propaga; não há
  // terceiro login. Foi encadear tentativas que bloqueou a `120.apifin`.
  it("não tenta um terceiro login quando o 401 insiste", async () => {
    fetchMock
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockResolvedValueOnce(respostaTexto("expirado", 401))
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockImplementation(async () => respostaTexto("expirado", 401));
    const sessao = new SessaoMega(CFG);

    await sessao.titulosDoPeriodo("2026-09-01", "2026-09-30").catch(() => null);

    const logins = fetchMock.mock.calls.filter((c) => String(c[0]).includes("SignIn"));
    expect(logins).toHaveLength(2);
  });

  it("não repete o SignIn depois que a autenticação falhou na rodada", async () => {
    fetchMock.mockImplementation(async () => respostaTexto("credencial recusada"));
    const sessao = new SessaoMega(CFG);

    await sessao.agentePorCodigo("2630").catch(() => null);
    await sessao.agentePorCodigo("3086").catch(() => null);
    await sessao.agentePorCodigo("3135").catch(() => null);

    const logins = fetchMock.mock.calls.filter((c) => String(c[0]).includes("SignIn"));
    expect(logins).toHaveLength(1);
  });
});

describe("toda chamada tem teto de tempo", () => {
  // Sem `signal`, uma rota lenta pendura a invocação até o limite da
  // plataforma — e o cron tem `maxDuration = 300`.
  it("manda um AbortSignal no SignIn e na consulta", async () => {
    fetchMock
      .mockResolvedValueOnce(signInOk("2099-01-01T00:00:00"))
      .mockResolvedValueOnce(respostaJson([]));
    const sessao = new SessaoMega(CFG);

    await sessao.titulosDoPeriodo("2026-09-01", "2026-09-30");

    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal);
    }
  });
});
