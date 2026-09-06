import { describe, it, expect } from "vitest";
import {
  chaveDeRotulo,
  validarFicha,
  campoFichaSchema,
  camposFichaSchema,
  type CampoFicha,
} from "./catalogo";

function campo(over: Partial<CampoFicha> = {}): CampoFicha {
  return {
    chave: "memoria",
    rotulo: "Memória",
    tipo: "numero",
    unidade: "GB",
    opcoes: [],
    obrigatorio: false,
    ...over,
  };
}

describe("chaveDeRotulo", () => {
  it("tira acento, espaço e caixa", () => {
    // A chave é o NOME DA COLUNA no jsonb. Com acento e espaço, toda consulta
    // teria de escrever `ficha->>'Memória RAM'` — que se digita errado uma vez
    // e o filtro devolve vazio para sempre, sem erro nenhum.
    expect(chaveDeRotulo("Memória RAM")).toBe("memoria_ram");
    expect(chaveDeRotulo("Altura máxima (m)")).toBe("altura_maxima_m");
    expect(chaveDeRotulo("Nº de série")).toBe("n_de_serie");
  });

  it("não deixa sobrar underscore nas pontas", () => {
    expect(chaveDeRotulo("  ...disco...  ")).toBe("disco");
    expect(chaveDeRotulo("(carga)")).toBe("carga");
  });

  it("a chave gerada é aceita pelo schema", () => {
    // As duas regras existem separadas — a normalização e o regex de validação
    // — e nada garantia que concordassem. Se `chaveDeRotulo` produzisse algo
    // que `campoFichaSchema` recusa, o campo seria impossível de criar pela
    // tela e o erro apareceria como "chave inválida" sobre um texto que o
    // próprio sistema gerou.
    for (const rotulo of [
      "Memória RAM",
      "Altura máxima (m)",
      "Tipo de disco",
      "Sob garantia?",
      "Ano de fabricação",
    ]) {
      const r = campoFichaSchema.safeParse({
        chave: chaveDeRotulo(rotulo),
        rotulo,
        tipo: "texto",
      });
      expect(r.success, `${rotulo} → ${chaveDeRotulo(rotulo)}`).toBe(true);
    }
  });
});

describe("camposFichaSchema", () => {
  it("recusa duas chaves iguais", () => {
    // `campos_ficha` é jsonb: duas chaves iguais fariam a segunda sobrescrever
    // a primeira ao gravar a ficha da peça — o valor do primeiro campo sumiria
    // sem erro.
    const r = camposFichaSchema.safeParse([
      campo({ chave: "disco", rotulo: "Disco" }),
      campo({ chave: "disco", rotulo: "Disco secundário" }),
    ]);
    expect(r.success).toBe(false);
  });

  it("recusa lista sem opção", () => {
    // Seletor vazio: o campo aparece na ficha e não deixa escolher nada.
    const r = campoFichaSchema.safeParse({
      chave: "disco_tipo",
      rotulo: "Tipo de disco",
      tipo: "lista",
      opcoes: [],
    });
    expect(r.success).toBe(false);
  });

  it("aceita lista com opções", () => {
    const r = campoFichaSchema.safeParse({
      chave: "disco_tipo",
      rotulo: "Tipo de disco",
      tipo: "lista",
      opcoes: ["SSD", "HDD"],
    });
    expect(r.success).toBe(true);
  });
});

describe("validarFicha", () => {
  it("converte número e ignora vazio não obrigatório", () => {
    const r = validarFicha([campo(), campo({ chave: "disco", rotulo: "Disco" })], {
      memoria: "8",
      disco: "",
    });
    expect(r.ok).toBe(true);
    // `disco` NÃO entra no objeto. Gravar "" e null misturados faria
    // `ficha->>'x' is null` ser verdadeiro para uns e falso para outros, com o
    // mesmo significado na tela.
    if (r.ok) expect(r.ficha).toEqual({ memoria: 8 });
  });

  it("aceita vírgula decimal", () => {
    // O usuário digita "1,5" — é o teclado brasileiro.
    const r = validarFicha([campo({ chave: "altura", rotulo: "Altura" })], {
      altura: "1,5",
    });
    expect(r.ok && r.ficha.altura).toBe(1.5);
  });

  it("recusa número que não é número", () => {
    const r = validarFicha([campo()], { memoria: "oito" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Memória");
  });

  it("exige o campo obrigatório em branco", () => {
    const r = validarFicha([campo({ obrigatorio: true })], { memoria: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("Memória");
  });

  it("recusa opção fora da lista", () => {
    const r = validarFicha(
      [campo({ chave: "disco_tipo", rotulo: "Tipo de disco", tipo: "lista", opcoes: ["SSD", "HDD"] })],
      { disco_tipo: "NVME" },
    );
    expect(r.ok).toBe(false);
  });

  it("DESCARTA chave que o tipo não conhece", () => {
    // O CASO QUE MAIS IMPORTA NESTE ARQUIVO.
    //
    // A ficha é montada a partir dos campos DO TIPO, não do que veio no
    // payload. Sem isso, uma requisição forjada gravaria qualquer chave no
    // jsonb — e ela viraria uma coluna fantasma que nenhuma tela mostra,
    // nenhum campo edita e nenhuma consulta espera.
    const r = validarFicha([campo()], { memoria: "8", coisa_estranha: "x" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ficha).toEqual({ memoria: 8 });
      expect(Object.keys(r.ficha)).not.toContain("coisa_estranha");
    }
  });

  it("campo removido do tipo deixa de ser gravado", () => {
    // Consequência do mesmo mecanismo, e desejada: tirar um campo do tipo faz
    // ele parar de ser escrito nas peças dali em diante.
    const r = validarFicha([], { memoria: "8" });
    expect(r.ok && r.ficha).toEqual({});
  });

  it("sim/não vira booleano de verdade", () => {
    // String "false" é truthy em JavaScript. Guardá-la como texto faria toda
    // consulta que testasse o campo dar verdadeiro para os dois valores.
    const c = campo({ chave: "garantia", rotulo: "Sob garantia", tipo: "sim_nao" });
    expect(validarFicha([c], { garantia: "on" })).toEqual({
      ok: true,
      ficha: { garantia: true },
    });
    expect(validarFicha([c], { garantia: "false" })).toEqual({
      ok: true,
      ficha: { garantia: false },
    });
  });

  it("recusa data inválida", () => {
    const c = campo({ chave: "aferido_em", rotulo: "Aferido em", tipo: "data" });
    expect(validarFicha([c], { aferido_em: "31/12/2026" }).ok).toBe(false);
    expect(validarFicha([c], { aferido_em: "2026-12-31" }).ok).toBe(true);
  });

  it("recusa texto exagerado", () => {
    const r = validarFicha([campo({ chave: "obs", rotulo: "Observação", tipo: "texto" })], {
      obs: "x".repeat(201),
    });
    expect(r.ok).toBe(false);
  });
});
