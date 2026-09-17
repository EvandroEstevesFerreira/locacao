import { describe, it, expect } from "vitest";
import {
  TIPO_CENTRO_CUSTO,
  TIPO_CENTRO_CUSTO_INFO,
  paiPermitido,
  ordenarComHierarquia,
  aceitaControleDeObra,
  type CentroCustoNo,
} from "./centro-custo";

// As mesmas regras vivem na migration 0114 (trigger `obra_centro_custo_valido`).
// Aqui elas existem para dar MENSAGEM de campo no formulário — o banco recusa
// com erro cru, sem nome de campo, e o formulário não teria onde pendurá-lo.
// Se as duas divergirem, quem manda é o banco; este teste é o lembrete.

function no(p: Partial<CentroCustoNo> & { id: string }): CentroCustoNo {
  return {
    codigo: p.id,
    nome: p.nome ?? p.id,
    tipo: p.tipo ?? "departamento",
    pai_id: p.pai_id ?? null,
    ...p,
  };
}

describe("TIPO_CENTRO_CUSTO", () => {
  it("tem os dois tipos, e rótulo acentuado para cada um", () => {
    expect(TIPO_CENTRO_CUSTO).toEqual(["obra", "departamento"]);
    expect(TIPO_CENTRO_CUSTO_INFO.obra.label).toBe("Obra");
    expect(TIPO_CENTRO_CUSTO_INFO.departamento.label).toBe("Departamento");
  });
});

describe("paiPermitido", () => {
  const admin = no({ id: "admin", nome: "Administrativo" });
  const rh = no({ id: "rh", nome: "RH", pai_id: "admin" });
  const obra = no({ id: "obra1", nome: "Unimed Maceió", tipo: "obra" });

  it("aceita departamento de raiz como pai de um departamento", () => {
    expect(paiPermitido(no({ id: "fin", nome: "Financeiro" }), admin).ok).toBe(true);
  });

  it("aceita pai nulo", () => {
    expect(paiPermitido(no({ id: "fin" }), null).ok).toBe(true);
  });

  it("recusa pai para obra — a hierarquia é administrativa", () => {
    const r = paiPermitido(obra, admin);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/obra/i);
  });

  it("recusa obra como pai", () => {
    const r = paiPermitido(no({ id: "fin" }), obra);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/departamento/i);
  });

  it("recusa neto: a hierarquia tem dois níveis", () => {
    const r = paiPermitido(no({ id: "folha", nome: "Folha" }), rh);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/dois níveis/i);
  });

  it("recusa ser pai de si mesmo", () => {
    const r = paiPermitido(rh, rh);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/si mesmo/i);
  });
});

describe("ordenarComHierarquia", () => {
  // A indentação da lista é regra, não CSS. Regra dentro de componente é regra
  // sem teste — por isso ela é função pura.
  const itens = [
    no({ id: "b", codigo: "800", nome: "Administrativo" }),
    no({ id: "a", codigo: "605", nome: "Unimed Maceió", tipo: "obra" }),
    no({ id: "d", codigo: "820", nome: "Financeiro", pai_id: "b" }),
    no({ id: "c", codigo: "810", nome: "RH", pai_id: "b" }),
  ];

  it("põe cada filho logo abaixo do seu pai, ordenado por código", () => {
    expect(ordenarComHierarquia(itens).map((i) => i.codigo)).toEqual([
      "605",
      "800",
      "810",
      "820",
    ]);
  });

  it("marca o nível: raiz 0, filho 1", () => {
    const porCodigo = new Map(ordenarComHierarquia(itens).map((i) => [i.codigo, i.nivel]));
    expect(porCodigo.get("800")).toBe(0);
    expect(porCodigo.get("810")).toBe(1);
    expect(porCodigo.get("605")).toBe(0);
  });

  it("não engole o filho cujo pai a RLS escondeu", () => {
    // `pai_id` aponta para uma linha que o usuário pode não enxergar. Sumir com
    // o setor seria pior que mostrá-lo na raiz: quem tem acesso ao RH tem de
    // ver o RH, com ou sem o pai na lista.
    const orfao = [no({ id: "c", codigo: "810", nome: "RH", pai_id: "oculto" })];
    const r = ordenarComHierarquia(orfao);
    expect(r).toHaveLength(1);
    expect(r[0].nivel).toBe(0);
  });

  it("não entra em laço se os dados vierem com um ciclo", () => {
    // O banco impede o ciclo (trigger da 0114). Esta função não pode depender
    // disso: ela também roda sobre dados de teste e de importação.
    const ciclo = [
      no({ id: "x", codigo: "1", pai_id: "y" }),
      no({ id: "y", codigo: "2", pai_id: "x" }),
    ];
    expect(ordenarComHierarquia(ciclo)).toHaveLength(2);
  });

  it("devolve lista vazia para entrada vazia", () => {
    expect(ordenarComHierarquia([])).toEqual([]);
  });
});

describe("aceitaControleDeObra", () => {
  it("só obra recebe frente, avanço, orçamento e fechamento", () => {
    expect(aceitaControleDeObra("obra")).toBe(true);
    expect(aceitaControleDeObra("departamento")).toBe(false);
  });
});
