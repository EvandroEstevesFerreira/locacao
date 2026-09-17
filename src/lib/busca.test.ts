import { describe, it, expect } from "vitest";
import {
  normalizarBusca,
  termoValido,
  classificarAcerto,
  ordenarResultados,
  ENTIDADES,
  MODULO_POR_ENTIDADE,
  type ResultadoBusca,
} from "./busca";
import { MODULO_CHAVES } from "./modulos";

describe("normalizarBusca", () => {
  it("tira acento e caixa, para que 'andre' ache 'André'", () => {
    // É POR ISTO QUE O FILTRO NÃO RODA NO BANCO. O PostgREST não expressa
    // `unaccent(coluna)` num `.or()`, e sem acento resolvido "joao" não acha
    // "João" — entre 510 funcionários brasileiros, a busca pareceria quebrada.
    expect(normalizarBusca("André")).toBe("andre");
    expect(normalizarBusca("JOÃO")).toBe("joao");
    expect(normalizarBusca("  Imóveis  ")).toBe("imoveis");
  });
});

describe("termoValido", () => {
  it("uma letra não vale: casaria com quase tudo", () => {
    expect(termoValido("a")).toBe(false);
    expect(termoValido(" a ")).toBe(false);
    expect(termoValido("")).toBe(false);
  });

  it("duas letras valem", () => {
    expect(termoValido("an")).toBe(true);
  });
});

describe("classificarAcerto", () => {
  it("prefixo no nome vence 'contém' no nome", () => {
    expect(classificarAcerto({ termo: "ande", nome: "Anderson", codigos: [] })).toBe("nome-prefixo");
    // Fernandes contains "ande" (f-e-r-n-a-n-d-e-s) while Anderson starts with "ande"
    expect(
      classificarAcerto({ termo: "ande", nome: "Fernandes", codigos: [] }),
    ).toBe("nome-contem");
  });

  it("acerto em código vence acerto em nome", () => {
    // Quem digita 14L4594 sabe exatamente o que quer.
    expect(
      classificarAcerto({ termo: "14l4594", nome: "Notebook", codigos: ["14L4594"] }),
    ).toBe("codigo-prefixo");
  });

  it("ignora acento também nos campos, não só no termo", () => {
    expect(classificarAcerto({ termo: "joao", nome: "João da Silva", codigos: [] })).toBe(
      "nome-prefixo",
    );
  });

  it("ignora código nulo sem quebrar", () => {
    // `cnpj`, `codigo` e `service_tag` são todos anuláveis no banco.
    expect(classificarAcerto({ termo: "silva", nome: "Silva", codigos: [null, null] })).toBe(
      "nome-prefixo",
    );
  });

  it("devolve null quando não bate em nada", () => {
    expect(classificarAcerto({ termo: "zzz", nome: "Anderson", codigos: ["A1"] })).toBeNull();
  });
});

describe("ordenarResultados", () => {
  const r = (over: Partial<ResultadoBusca>): ResultadoBusca => ({
    entidade: "obra",
    id: "1",
    titulo: "X",
    detalhe: null,
    href: "/x",
    acerto: "nome-contem",
    ...over,
  });

  it("código antes de nome, prefixo antes de contém", () => {
    const ordenado = ordenarResultados([
      r({ id: "d", acerto: "nome-contem" }),
      r({ id: "b", acerto: "codigo-contem" }),
      r({ id: "a", acerto: "codigo-prefixo" }),
      r({ id: "c", acerto: "nome-prefixo" }),
    ]);
    expect(ordenado.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("empate desempata pela ordem fixa das entidades", () => {
    // ORDEM ESTÁVEL VALE MAIS QUE ORDEM ESPERTA: o usuário aprende onde as
    // coisas caem, e a lista não dança entre uma busca e outra.
    const ordenado = ordenarResultados([
      r({ id: "imovel", entidade: "imovel", acerto: "nome-prefixo" }),
      r({ id: "obra", entidade: "obra", acerto: "nome-prefixo" }),
      r({ id: "funcionario", entidade: "funcionario", acerto: "nome-prefixo" }),
    ]);
    expect(ordenado.map((x) => x.entidade)).toEqual(["obra", "funcionario", "imovel"]);
  });

  it("não perde nem duplica resultado", () => {
    const entrada = ENTIDADES.map((e, i) => r({ id: String(i), entidade: e }));
    expect(ordenarResultados(entrada)).toHaveLength(ENTIDADES.length);
  });
});

describe("MODULO_POR_ENTIDADE", () => {
  it("cobre as seis entidades com chaves de módulo que existem", () => {
    // ESTE MAPA É A SEGUNDA BARREIRA DA BUSCA. A RLS recorta organização e
    // obra; `perfil.modulos` recorta módulo e não tem policy nenhuma — quem
    // o aplica é a ponte, com este mapa. Uma entidade sem entrada, ou com
    // chave que não existe mais em MODULOS, deixaria de ser filtrada e o nome
    // do registro apareceria na tela de quem não pode vê-lo.
    for (const e of ENTIDADES) {
      expect(MODULO_CHAVES).toContain(MODULO_POR_ENTIDADE[e]);
    }
    expect(Object.keys(MODULO_POR_ENTIDADE)).toHaveLength(ENTIDADES.length);
  });
});
