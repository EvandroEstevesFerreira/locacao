import { describe, it, expect } from "vitest";
import type { PessoaPeople } from "./contrato";
import {
  normalizar,
  partes,
  cabeDentro,
  conciliar,
  inequivocas,
  resumo,
} from "./conciliacao";

let seq = 0;
function noPeople(nome: string, over: Partial<PessoaPeople> = {}): PessoaPeople {
  seq++;
  return {
    id: `${String(seq).padStart(8, "0")}-1111-4222-8333-444444444444`,
    nome,
    cpf: null,
    matricula: null,
    cargo: null,
    email: null,
    telefone: null,
    vinculo: "clt",
    situacao: "ativo",
    admissao: null,
    desligamento: null,
    centro_custo: null,
    atualizado_em: "2026-09-06T14:22:31.412Z",
    ...over,
  };
}

describe("normalizar", () => {
  it("tira acento e baixa a caixa", () => {
    expect(normalizar("Letícia Aparecida")).toBe("leticia aparecida");
    expect(normalizar("JOÃO")).toBe("joao");
  });

  it("reduz espaço repetido", () => {
    expect(normalizar("  Ana   Paula  ")).toBe("ana paula");
  });
});

describe("partes", () => {
  it("descarta as partículas que não identificam ninguém", () => {
    // "João DA Silva" e "João Silva" são a mesma pessoa, e manter o "da"
    // faria a comparação por ordem falhar entre as duas grafias.
    expect(partes("João da Silva")).toEqual(["joao", "silva"]);
    expect(partes("Maria dos Santos e Souza")).toEqual([
      "maria",
      "santos",
      "souza",
    ]);
  });
});

describe("cabeDentro", () => {
  it("nome abreviado cabe no nome completo", () => {
    expect(cabeDentro(partes("Evandro Ferreira"), partes("Evandro Esteves Ferreira")))
      .toBe(true);
  });

  it("O CASO QUE PRIMEIRO+ÚLTIMO ERRAVA: nome do meio", () => {
    // O documento do People mediu com primeiro+último, e ali "Andre Piva"
    // virava a chave "andre piva" contra "andre correa" — não casava. Por
    // subsequência, casa.
    expect(cabeDentro(partes("Andre Piva"), partes("Andre Piva Correa"))).toBe(true);
  });

  it("ordem importa: nome invertido não casa", () => {
    // Nome invertido é outro registro, não um apelido.
    expect(cabeDentro(partes("Silva Joao"), partes("Joao Silva"))).toBe(false);
  });

  it("sobrenome que não existe no completo não casa", () => {
    expect(cabeDentro(partes("Joao Pereira"), partes("Joao Silva Santos"))).toBe(false);
  });

  it("nome vazio nunca casa com ninguém", () => {
    // Senão uma linha com nome em branco casaria com as 483 de uma vez.
    expect(cabeDentro([], partes("Joao Silva"))).toBe(false);
  });
});

describe("conciliar", () => {
  it("um candidato só é `unico`", () => {
    const s = conciliar(
      [{ id: "f1", nome: "Evandro Ferreira" }],
      [noPeople("Evandro Esteves Ferreira"), noPeople("Maria Souza")],
    );
    expect(s[0].classificacao).toBe("unico");
    expect(s[0].candidatos).toHaveLength(1);
  });

  it("dois ou três candidatos é `ambiguo`, e NÃO escolhe nenhum", () => {
    // O documento do People nomeia esses: "Tiago Silva" casa com 3 pessoas.
    // Escolher entre elas é decisão de quem conhece as pessoas.
    const s = conciliar(
      [{ id: "f1", nome: "Tiago Silva" }],
      [
        noPeople("Tiago Silva Moraes"),
        noPeople("Tiago Silva Lima"),
        noPeople("Tiago Silva"),
      ],
    );
    expect(s[0].classificacao).toBe("ambiguo");
    expect(s[0].candidatos).toHaveLength(3);
  });

  it("nenhum candidato é `sem_candidato`", () => {
    const s = conciliar(
      [{ id: "f1", nome: "Adm Obra" }],
      [noPeople("Evandro Esteves Ferreira")],
    );
    expect(s[0].classificacao).toBe("sem_candidato");
    expect(s[0].candidatos).toEqual([]);
  });

  it("nome de uma palavra é marcado como fraco", () => {
    // Um primeiro nome sozinho não identifica ninguém numa base de 483, mesmo
    // quando casa com um único cadastro.
    const s = conciliar([{ id: "f1", nome: "Lourival" }], [noPeople("Lourival Gomes")]);
    expect(s[0].classificacao).toBe("unico");
    expect(s[0].nomeFraco).toBe(true);
  });

  it("traz situação e cargo junto, que é o que desempata na tela", () => {
    const s = conciliar(
      [{ id: "f1", nome: "Marcelo Santos" }],
      [
        noPeople("Marcelo Santos Lima", { situacao: "ativo", cargo: "Pedreiro" }),
        noPeople("Marcelo Santos Cruz", { situacao: "desligado", cargo: "Servente" }),
      ],
    );
    expect(s[0].candidatos.map((c) => c.situacao)).toEqual(["ativo", "desligado"]);
    expect(s[0].candidatos[0].cargo).toBe("Pedreiro");
  });
});

describe("inequivocas", () => {
  it("leva só candidato único com nome de duas partes ou mais", () => {
    const s = conciliar(
      [
        { id: "f1", nome: "Evandro Ferreira" },
        { id: "f2", nome: "Lourival" },
        { id: "f3", nome: "Tiago Silva" },
      ],
      [
        noPeople("Evandro Esteves Ferreira"),
        noPeople("Lourival Gomes"),
        noPeople("Tiago Silva Lima"),
        noPeople("Tiago Silva Moraes"),
      ],
    );
    const auto = inequivocas(s);
    expect(auto.map((x) => x.funcionarioId)).toEqual(["f1"]);
  });

  it("DUAS LINHAS DO LOCA APONTANDO PARA A MESMA PESSOA saem as duas do lote", () => {
    // O documento avisa de três pares duplicados no Loca — "Alex Felipe" e
    // "Alex Vidal Felipe" são a mesma pessoa cadastrada duas vezes. Vincular
    // as duas ao mesmo cadastro criaria dois vínculos para uma pessoa só, e
    // uma das linhas precisa ser resolvida como duplicata ANTES, não junto.
    const pessoa = noPeople("Alex Vidal Felipe");
    const s = conciliar(
      [
        { id: "f1", nome: "Alex Felipe" },
        { id: "f2", nome: "Alex Vidal Felipe" },
      ],
      [pessoa],
    );
    expect(s[0].classificacao).toBe("unico");
    expect(s[1].classificacao).toBe("unico");
    expect(inequivocas(s)).toEqual([]);
  });
});

describe("resumo", () => {
  it("conta o tamanho do trabalho manual", () => {
    const s = conciliar(
      [
        { id: "f1", nome: "Evandro Ferreira" },
        { id: "f2", nome: "Tiago Silva" },
        { id: "f3", nome: "Adm Obra" },
        { id: "f4", nome: "Lourival" },
      ],
      [
        noPeople("Evandro Esteves Ferreira"),
        noPeople("Tiago Silva Lima"),
        noPeople("Tiago Silva Moraes"),
        noPeople("Lourival Gomes"),
      ],
    );
    expect(resumo(s)).toEqual({
      total: 4,
      automaticas: 1,
      manuais: 3,
      ambiguas: 1,
      semCandidato: 1,
    });
  });
});
