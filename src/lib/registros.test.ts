import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  PREFIXO_REGISTRO,
  ROTULO_REGISTRO,
  partesDoNumero,
  formatarNumero,
  normalizarBuscaNumero,
  type TipoRegistro,
} from "./registros";

describe("PREFIXO_REGISTRO espelha o banco", () => {
  // Este é o teste que importa deste arquivo. O número é atribuído por trigger
  // no Postgres (migration 0048) e exibido aqui; se as duas tabelas de prefixo
  // divergirem, a tela chama de CTR o que o banco gravou como outra coisa — e
  // nada acusa, porque os dois lados continuam funcionando isoladamente.
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/0048_numeracao_registros.sql"),
    "utf8",
  );

  const doBanco = new Map<string, string>();
  for (const m of sql.matchAll(/when '([a-z_]+)'\s+then '([A-Z]{3})'/g)) {
    doBanco.set(m[1], m[2]);
  }

  it("a migration declara prefixos", () => {
    // Se o regex parar de casar (renomearam a função, mudaram o formato), este
    // arquivo viraria um teste vazio que passa sempre.
    expect(doBanco.size).toBeGreaterThan(5);
  });

  it("todo tipo do TypeScript existe no banco com o mesmo prefixo", () => {
    const divergentes: string[] = [];
    for (const [tipo, prefixo] of Object.entries(PREFIXO_REGISTRO)) {
      const noBanco = doBanco.get(tipo);
      if (noBanco !== prefixo) {
        divergentes.push(`${tipo}: TS=${prefixo} banco=${noBanco ?? "(ausente)"}`);
      }
    }
    expect(divergentes, divergentes.join("\n")).toEqual([]);
  });

  it("todo tipo do banco existe no TypeScript", () => {
    const faltando = [...doBanco.keys()].filter(
      (t) => !(t in PREFIXO_REGISTRO),
    );
    expect(faltando, `Tipos no banco e não em registros.ts: ${faltando.join(", ")}`).toEqual([]);
  });

  it("nenhum prefixo se repete — dois tipos com AVA tornam o número ambíguo", () => {
    const usados = Object.values(PREFIXO_REGISTRO);
    expect(new Set(usados).size).toBe(usados.length);
  });

  it("todo tipo tem rótulo de tela", () => {
    const semRotulo = Object.keys(PREFIXO_REGISTRO).filter(
      (t) => !ROTULO_REGISTRO[t as TipoRegistro],
    );
    expect(semRotulo).toEqual([]);
  });
});

describe("partesDoNumero", () => {
  it("decompõe o formato completo", () => {
    expect(partesDoNumero("CTR-2026-0007")).toEqual({
      prefixo: "CTR",
      ano: 2026,
      sequencial: 7,
    });
  });

  it("aceita sequencial acima de 9999 sem truncar", () => {
    // O `lpad(4)` do banco não corta: a partir de 10000 o número cresce.
    expect(partesDoNumero("REC-2026-12345")?.sequencial).toBe(12345);
  });

  it("devolve null para o que não é número de registro", () => {
    for (const ruim of ["", "  ", "CTR-2026", "2026-0007", "CT-2026-0007", null, undefined]) {
      expect(partesDoNumero(ruim)).toBeNull();
    }
  });
});

describe("formatarNumero", () => {
  it("mostra travessão para registro sem número", () => {
    // Célula vazia numa tabela parece falha de carregamento; o travessão diz
    // "não tem", que é o estado real de um rascunho.
    expect(formatarNumero(null)).toBe("—");
    expect(formatarNumero("")).toBe("—");
    expect(formatarNumero("   ")).toBe("—");
  });

  it("devolve o número quando existe", () => {
    expect(formatarNumero("AVA-2026-0009")).toBe("AVA-2026-0009");
  });
});

describe("normalizarBuscaNumero", () => {
  it("completa os zeros do sequencial no formato completo", () => {
    expect(normalizarBuscaNumero("ava-2026-9")).toBe("AVA-2026-0009");
  });

  it("só dígitos vira o sufixo com zeros — é como a pessoa digita", () => {
    // Ninguém procura por "AVA-2026-0009": digita "9".
    expect(normalizarBuscaNumero("9")).toBe("0009");
    expect(normalizarBuscaNumero("0009")).toBe("0009");
    expect(normalizarBuscaNumero("142")).toBe("0142");
  });

  it("deixa passar o que não reconhece", () => {
    expect(normalizarBuscaNumero("betoneira")).toBe("BETONEIRA");
  });
});
