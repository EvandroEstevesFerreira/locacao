import { describe, it, expect } from "vitest";
import { PAGE_SIZE, contagem, parseListParams, termoOr } from "./lista";

// `parseListParams` e `termoOr` são controles de segurança, não conveniências:
// a coluna de ordenação vai direto para o `.order()` do PostgREST e o termo de
// busca vai para dentro de um `.or(ilike...)`. Estavam sem nenhum teste.

describe("parseListParams — allowlist de ordenação", () => {
  const opts = { sortCols: ["numero", "data_inicio", "status"], defaultSort: "data_inicio" };

  it("aceita uma coluna da allowlist", () => {
    expect(parseListParams({ sort: "numero" }, opts).sort).toBe("numero");
  });

  it("recusa coluna fora da allowlist e cai no default", () => {
    expect(parseListParams({ sort: "senha" }, opts).sort).toBe("data_inicio");
  });

  it("recusa tentativa de injeção no order()", () => {
    const p = parseListParams({ sort: "numero,perfil.senha" }, opts);
    expect(p.sort).toBe("data_inicio");
  });

  it("recusa string vazia e ausência", () => {
    expect(parseListParams({ sort: "" }, opts).sort).toBe("data_inicio");
    expect(parseListParams({}, opts).sort).toBe("data_inicio");
  });
});

describe("parseListParams — direção", () => {
  const opts = { sortCols: ["a"], defaultSort: "a" };

  it("aceita asc e desc", () => {
    expect(parseListParams({ dir: "asc" }, opts).ascending).toBe(true);
    expect(parseListParams({ dir: "desc" }, opts).ascending).toBe(false);
  });

  it("valor inválido cai no default", () => {
    expect(parseListParams({ dir: "'; drop table" }, opts).dir).toBe("asc");
  });

  it("respeita defaultDir quando informado", () => {
    expect(parseListParams({}, { ...opts, defaultDir: "desc" }).dir).toBe("desc");
  });
});

describe("parseListParams — paginação", () => {
  const opts = { sortCols: ["a"], defaultSort: "a" };

  it("primeira página cobre o primeiro intervalo", () => {
    const p = parseListParams({}, opts);
    expect(p.page).toBe(1);
    expect(p.from).toBe(0);
    expect(p.to).toBe(PAGE_SIZE - 1);
  });

  it("página N desloca em PAGE_SIZE", () => {
    const p = parseListParams({ page: "3" }, opts);
    expect(p.from).toBe(2 * PAGE_SIZE);
    expect(p.to).toBe(3 * PAGE_SIZE - 1);
  });

  it("página zero, negativa ou não numérica vira 1", () => {
    for (const page of ["0", "-5", "abc", ""]) {
      expect(parseListParams({ page }, opts).page).toBe(1);
    }
  });
});

describe("termoOr — sanitização do ilike", () => {
  it("monta uma cláusula por campo", () => {
    expect(termoOr(["numero", "obra"], "aurora")).toBe(
      "numero.ilike.%aurora%,obra.ilike.%aurora%",
    );
  });

  it("remove os caracteres que quebrariam a sintaxe do .or()", () => {
    // vírgula e parênteses são separadores no PostgREST; % e * são curingas do
    // ilike; a barra invertida é escape. Todos viram espaço.
    const r = termoOr(["nome"], 'a,b(c)d%e*f\\g');
    expect(r).toBe("nome.ilike.%a b c d e f g%");
  });

  it("apara espaços das pontas", () => {
    expect(termoOr(["nome"], "  aurora  ")).toBe("nome.ilike.%aurora%");
  });
});

describe("contagem", () => {
  it("usa o singular só para 1", () => {
    expect(contagem(1, "contrato", "contratos")).toBe("1 contrato");
    expect(contagem(2, "contrato", "contratos")).toBe("2 contratos");
    expect(contagem(0, "contrato", "contratos")).toBe("0 contratos");
  });

  it("aceita plural irregular", () => {
    expect(contagem(3, "fornecedor", "fornecedores")).toBe("3 fornecedores");
    expect(contagem(1, "fornecedor", "fornecedores")).toBe("1 fornecedor");
  });
});
