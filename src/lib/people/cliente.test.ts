import { describe, it, expect } from "vitest";
import { buscarPessoas, ErroPeople, type ConfigPeople } from "./cliente";

const CFG: ConfigPeople = {
  url: "https://people.exemplo/api/integracoes/pessoas",
  token: "tok_secreto",
};

function umaPessoa(id: string, atualizado = "2026-09-06T14:22:31.412Z") {
  return {
    id,
    nome: "Fulano de Tal Silva",
    cpf: "12345678901",
    matricula: "4066",
    cargo: "Eletricista",
    email: "fulano@sistenge.com",
    telefone: "11987654321",
    vinculo: "clt",
    situacao: "ativo",
    admissao: "2025-03-10",
    desligamento: null,
    centro_custo: { codigo: "605", nome: "Unimed Maceió" },
    atualizado_em: atualizado,
  };
}

const UUID = (n: number) =>
  `${String(n).padStart(8, "0")}-1111-4222-8333-444444444444`;

/** `fetch` falso: guarda as chamadas e devolve as páginas na ordem. */
function buscadorDe(paginas: { corpo: unknown; status?: number }[]) {
  const chamadas: { url: string; headers: Record<string, string> }[] = [];
  let i = 0;
  const buscador = (async (entrada: string | URL, init?: RequestInit) => {
    chamadas.push({
      url: entrada.toString(),
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    const p = paginas[Math.min(i++, paginas.length - 1)];
    return {
      ok: (p.status ?? 200) < 400,
      status: p.status ?? 200,
      json: async () => p.corpo,
    } as Response;
  }) as unknown as typeof fetch;
  return { buscador, chamadas };
}

describe("buscarPessoas", () => {
  it("segue o cursor até `proxima_pagina` vir nula", () => {
    return (async () => {
      const { buscador, chamadas } = buscadorDe([
        { corpo: { pessoas: [umaPessoa(UUID(1))], proxima_pagina: "cur_2" } },
        { corpo: { pessoas: [umaPessoa(UUID(2))], proxima_pagina: "cur_3" } },
        { corpo: { pessoas: [umaPessoa(UUID(3))], proxima_pagina: null } },
      ]);
      const r = await buscarPessoas(CFG, null, buscador);
      expect(r.pessoas).toHaveLength(3);
      expect(r.paginas).toBe(3);
      expect(chamadas[1].url).toContain("cursor=cur_2");
      expect(chamadas[2].url).toContain("cursor=cur_3");
    })();
  });

  it("manda o token no cabeçalho, NUNCA na query string", async () => {
    // O contrato pede, e endereço com token dentro vaza em log de proxy,
    // histórico de navegador e print de tela.
    const { buscador, chamadas } = buscadorDe([
      { corpo: { pessoas: [], proxima_pagina: null } },
    ]);
    await buscarPessoas(CFG, null, buscador);
    expect(chamadas[0].headers.Authorization).toBe("Bearer tok_secreto");
    expect(chamadas[0].url).not.toContain("tok_secreto");
  });

  it("manda `desde` na primeira página e some com ele depois do cursor", async () => {
    // O cursor é keyset e já carrega de onde parou. Mandar os dois seria pedir
    // ao People que respeitasse duas origens diferentes.
    const { buscador, chamadas } = buscadorDe([
      { corpo: { pessoas: [umaPessoa(UUID(1))], proxima_pagina: "cur_2" } },
      { corpo: { pessoas: [], proxima_pagina: null } },
    ]);
    await buscarPessoas(CFG, "2026-09-01T00:00:00.000Z", buscador);
    expect(chamadas[0].url).toContain("desde=2026-09-01");
    expect(chamadas[1].url).toContain("cursor=cur_2");
    expect(chamadas[1].url).not.toContain("desde=");
  });

  it("primeira carga não manda `desde`", async () => {
    const { buscador, chamadas } = buscadorDe([
      { corpo: { pessoas: [], proxima_pagina: null } },
    ]);
    await buscarPessoas(CFG, null, buscador);
    expect(chamadas[0].url).not.toContain("desde=");
  });

  it("401 vira ErroPeople com o código do contrato", async () => {
    const { buscador } = buscadorDe([
      {
        status: 401,
        corpo: { erro: "token_invalido", mensagem: "Token ausente ou inválido." },
      },
    ]);
    await expect(buscarPessoas(CFG, null, buscador)).rejects.toMatchObject({
      name: "ErroPeople",
      status: 401,
      codigo: "token_invalido",
    });
  });

  it("429 preserva o código, para quem chama poder decidir esperar", async () => {
    const { buscador } = buscadorDe([
      { status: 429, corpo: { erro: "limite_excedido" } },
    ]);
    await expect(buscarPessoas(CFG, null, buscador)).rejects.toMatchObject({
      status: 429,
      codigo: "limite_excedido",
    });
  });

  it("PAYLOAD FORA DO CONTRATO derruba a rodada em vez de gravar meia verdade", async () => {
    // O caso que a validação existe para pegar: um deploy do People com campo
    // renomeado. Sem isto, 483 linhas de `funcionario` receberiam `undefined`
    // e o estrago apareceria com o nome de quem recebe o termo em branco.
    const { buscador } = buscadorDe([
      {
        corpo: {
          pessoas: [{ ...umaPessoa(UUID(1)), nome_completo: "x", nome: undefined }],
          proxima_pagina: null,
        },
      },
    ]);
    await expect(buscarPessoas(CFG, null, buscador)).rejects.toMatchObject({
      codigo: "payload_fora_do_contrato",
    });
  });

  it("envelope sem `pessoas` também é fora do contrato", async () => {
    const { buscador } = buscadorDe([{ corpo: { proxima_pagina: null } }]);
    await expect(buscarPessoas(CFG, null, buscador)).rejects.toBeInstanceOf(
      ErroPeople,
    );
  });

  it("cursor que nunca termina para no teto, e não no timeout da função", async () => {
    // Não é desconfiança do People: é o que impede um bug de cursor que sempre
    // devolve a mesma página de rodar até a função morrer sozinha.
    const { buscador } = buscadorDe([
      { corpo: { pessoas: [umaPessoa(UUID(1))], proxima_pagina: "sempre_a_mesma" } },
    ]);
    await expect(buscarPessoas(CFG, null, buscador)).rejects.toMatchObject({
      codigo: "paginacao_sem_fim",
    });
  });

  it("recorte vazio devolve lista vazia, e não erro", async () => {
    // O caso normal do delta: rodada sem novidade.
    const { buscador } = buscadorDe([
      { corpo: { pessoas: [], proxima_pagina: null } },
    ]);
    const r = await buscarPessoas(CFG, "2026-09-06T14:22:31.412Z", buscador);
    expect(r.pessoas).toEqual([]);
    expect(r.paginas).toBe(1);
  });
});
