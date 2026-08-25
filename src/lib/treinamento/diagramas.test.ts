import { describe, expect, it } from "vitest";
import { DIAGRAMAS } from "./diagramas";
import { CORES_PERMITIDAS } from "./layout";
import { STATUS_IMOVEL_INFO, STATUS_CAUCAO_INFO } from "@/lib/imoveis";
import { PAPEL_INFO } from "@/lib/permissoes";
import type { DiagramaKey } from "./tipos";

const CHAVES: DiagramaKey[] = [
  "cadeia-custodia",
  "tela-lista",
  "ciclo-contrato-imovel",
  "matriz-perfis",
];

describe("DIAGRAMAS", () => {
  it("tem os quatro previstos na spec", () => {
    expect(Object.keys(DIAGRAMAS).sort()).toEqual([...CHAVES].sort());
  });

  it.each(CHAVES)("%s — acessível e sem cor fora da paleta", (chave) => {
    const d = DIAGRAMAS[chave];

    // Quem usa leitor de tela recebe o título; sem isto o diagrama é um buraco.
    expect(d.svg).toContain('role="img"');
    expect(d.svg).toContain(`<title>${d.titulo}</title>`);

    // Sem largura fixa em px NA TAG <svg>: o diagrama tem de encolher no
    // celular. Largura em `rect` é outra coisa — é geometria interna, escalada
    // pelo viewBox. O primeiro regex pegava as duas e reprovava desenho certo.
    const tagAbertura = d.svg.slice(0, d.svg.indexOf(">") + 1);
    expect(tagAbertura).toContain("viewBox=");
    expect(tagAbertura).not.toMatch(/\swidth="\d+"/);

    const permitidas = CORES_PERMITIDAS.map((c) => c.toUpperCase());
    const usadas = [...d.svg.matchAll(/#[0-9a-fA-F]{6}/g)].map((x) => x[0].toUpperCase());
    expect([...new Set(usadas)].filter((c) => !permitidas.includes(c))).toEqual([]);
  });

  it.each(CHAVES)("%s — tem legenda que afirma algo", (chave) => {
    // A legenda vira <figcaption>. Sem ela a figura fica sem a afirmação que
    // ela sustenta, e o leitor tem de adivinhar por que o desenho está ali.
    expect(DIAGRAMAS[chave].legenda.length).toBeGreaterThan(40);
  });

  it("usa currentColor — o desenho tem de servir nos dois temas", () => {
    for (const chave of CHAVES) {
      expect(DIAGRAMAS[chave].svg).toContain("currentColor");
    }
  });

  it("nenhum diagrama tem buraco de dado", () => {
    for (const chave of CHAVES) {
      expect(DIAGRAMAS[chave].svg).not.toMatch(/undefined|NaN|\[object Object\]/);
    }
  });
});

describe("cadeia-custodia", () => {
  it("marca o elo que o sistema ainda não tem", () => {
    // O elo Sistenge -> funcionário é o recibo de ferramenta, fora de escopo.
    // Sem a marcação, o diagrama promete o que o Loca não faz.
    expect(DIAGRAMAS["cadeia-custodia"].svg).toMatch(/em construção|ainda não/i);
  });

  it("usa tracejado no elo inexistente, e não só cor", () => {
    // Distinguir apenas por cor deixaria de fora quem não a enxerga.
    expect(DIAGRAMAS["cadeia-custodia"].svg).toContain("stroke-dasharray");
  });
});

describe("ciclo-contrato-imovel", () => {
  it("traz os três estados reais do imóvel", () => {
    // Lidos de STATUS_IMOVEL_INFO: se o sistema ganhar um estado, o teste cai.
    const svg = DIAGRAMAS["ciclo-contrato-imovel"].svg;
    for (const s of Object.values(STATUS_IMOVEL_INFO)) {
      expect(svg, `falta o estado "${s.label}"`).toContain(s.label);
    }
  });

  it("traz os três estados da caução", () => {
    const svg = DIAGRAMAS["ciclo-contrato-imovel"].svg;
    for (const label of Object.values(STATUS_CAUCAO_INFO)) {
      expect(svg, `falta a caução "${label}"`).toContain(label);
    }
  });
});

describe("matriz-perfis", () => {
  it("traz os quatro perfis, com o rótulo do sistema", () => {
    const svg = DIAGRAMAS["matriz-perfis"].svg;
    for (const info of Object.values(PAPEL_INFO)) {
      expect(svg, `falta o perfil "${info.label}"`).toContain(info.label);
    }
  });

  it("marca com símbolo, não com cor", () => {
    // ✓ e — funcionam em impressão preto e branco e para quem não vê cor.
    const svg = DIAGRAMAS["matriz-perfis"].svg;
    expect(svg).toContain("✓");
    expect(svg).toContain("—");
  });
});
