import { describe, expect, it } from "vitest";
import { detentorNoTexto, casarFuncionario } from "./custodia-mutirao";

describe("detentorNoTexto", () => {
  it("lê o nome que vem depois de “Com:”", () => {
    expect(
      detentorNoTexto(
        "Com: Roberto Lui (conforme planilha) · Departamento: DIRETORIA · Garantia: Expira em 05 JUL 2028",
      ),
    ).toBe("Roberto Lui");
  });

  it("NÃO confunde com o detentor anterior, que também está no texto", () => {
    // A armadilha real do inventário: metade das observações traz "usuário
    // anterior <nome>". Uma busca por nome no texto inteiro casaria com a
    // pessoa ERRADA — e o notebook ficaria registrado com quem já o devolveu.
    expect(
      detentorNoTexto(
        "Com: Marco Monteiro (conforme planilha) · Departamento: Obra - 680 · usuário anterior Erasmo Carvalho · Garantia: Expirada",
      ),
    ).toBe("Marco Monteiro");
  });

  it("funciona quando “Com:” não é o primeiro campo", () => {
    expect(
      detentorNoTexto(
        "ALUGADA — ainda sem contrato de locação no Loca. · Com: Juliana Bastos (conforme planilha) · Departamento: FINANCEIRO",
      ),
    ).toBe("Juliana Bastos");
  });

  it("sem “Com:”, não inventa nome", () => {
    expect(detentorNoTexto("Departamento: TI · Garantia: Expirada")).toBe(null);
    expect(detentorNoTexto(null)).toBe(null);
    expect(detentorNoTexto("")).toBe(null);
  });

  it("nome vazio depois de “Com:” é ausência, não string vazia", () => {
    expect(detentorNoTexto("Com: (conforme planilha) · Departamento: TI")).toBe(null);
  });
});

const F = (id: string, nome: string) => ({ id, nome });
const CADASTRO = [
  F("f1", "Roberto Luis Andrade"),
  F("f2", "Marco Antonio Monteiro"),
  F("f3", "Juliana Bastos Silva"),
  F("f4", "Thacio Pires de Menezes"),
  F("f5", "Ana Paula Souza"),
  F("f6", "Ana Claudia Souza"),
  F("f7", "Marcio Henrique de Oliveira"),
];

describe("casarFuncionario", () => {
  it("nome idêntico casa exato", () => {
    const r = casarFuncionario("Ana Paula Souza", CADASTRO);
    expect(r.tipo).toBe("exato");
    if (r.tipo === "exato") expect(r.funcionario.id).toBe("f5");
  });

  it("acento e caixa não impedem o casamento exato", () => {
    const r = casarFuncionario("THACIO PIRES DE MENEZES", CADASTRO);
    expect(r.tipo).toBe("exato");
    if (r.tipo === "exato") expect(r.funcionario.id).toBe("f4");
  });

  it("acento no CADASTRO também não impede — “Jose” casa com “José”", () => {
    // O caso acima usa um nome sem acento, então não exercitava a remoção. Este
    // exercita: a planilha foi digitada sem acento e o cadastro tem "José
    // Antônio". Sem normalizar os dois lados, metade da diretoria não casaria.
    const r = casarFuncionario("Jose Antonio", [
      { id: "x", nome: "José Antônio Ferreira" },
    ]);
    expect(r.tipo).toBe("unico");
  });

  it("nome curto que é subsequência casa como único", () => {
    // "Marco Monteiro" → "Marco Antonio Monteiro". É o caso da maioria do
    // inventário: a planilha guardou primeiro + último.
    const r = casarFuncionario("Marco Monteiro", CADASTRO);
    expect(r.tipo).toBe("unico");
    if (r.tipo === "unico") expect(r.funcionario.id).toBe("f2");
  });

  it("conectivos não contam — “de”, “da”, “dos” são ruído", () => {
    const r = casarFuncionario("Marcio Oliveira", CADASTRO);
    expect(r.tipo).toBe("unico");
    if (r.tipo === "unico") expect(r.funcionario.id).toBe("f7");
  });

  it("TRUNCAMENTO NÃO CASA — “Lui” não é “Luis”", () => {
    // O caso que obriga o casamento a ser por token INTEIRO. Se "Lui" casasse
    // com "Luis" por prefixo, "Ana" casaria com meia empresa, e o mutirão
    // gravaria custódia errada em silêncio — num dado que sustenta cobrança de
    // equipamento.
    expect(casarFuncionario("Roberto Lui", CADASTRO).tipo).toBe("nenhum");
  });

  it("dois candidatos dão AMBÍGUO, com os dois nomes", () => {
    const r = casarFuncionario("Ana Souza", CADASTRO);
    expect(r.tipo).toBe("ambiguo");
    if (r.tipo === "ambiguo") {
      expect(r.candidatos.map((c) => c.id).sort()).toEqual(["f5", "f6"]);
    }
  });

  it("um só token nunca casa sozinho, mesmo achando um único candidato", () => {
    // "Juliana" acha só a f3 neste cadastro — e ainda assim é recusado. Num
    // cadastro de 509 pessoas, primeiro nome sozinho é identificação fraca, e
    // o custo do erro é atribuir equipamento a quem não o tem.
    expect(casarFuncionario("Juliana", CADASTRO).tipo).toBe("nenhum");
  });

  it("quem não está no cadastro não casa", () => {
    expect(casarFuncionario("Fulano Inexistente", CADASTRO).tipo).toBe("nenhum");
  });
});
