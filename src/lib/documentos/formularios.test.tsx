import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import {
  corpoParaParagrafos,
  DEFAULT_TEMPLATES,
  DOCUMENTOS,
  renderTemplate,
} from "@/lib/templates";
import { MedidaDisciplinar } from "./frm-rh-002";
import { TermoChaves } from "./frm-rh-003";
import { KitAlojamento } from "./frm-rh-004";
import { ChecklistLimpeza, TAREFAS, linhasDoGrid } from "./frm-rh-005";

const ORG = "Sistenge Construções e Comércio Ltda";

function conteudo(tipo: keyof typeof DEFAULT_TEMPLATES) {
  const tpl = DEFAULT_TEMPLATES[tipo];
  const v = { empresa_nome: ORG };
  return {
    orgNome: ORG,
    titulo: renderTemplate(tpl.titulo, v),
    paragrafos: corpoParaParagrafos(renderTemplate(tpl.corpo, v)),
  };
}

describe("formulários em branco — densidade", () => {
  it("FRM-RH-002 cabe em 2 páginas", async () => {
    const b = await renderToBuffer(<MedidaDisciplinar {...conteudo("medida_disciplinar")} />);
    expect(contarPaginas(b)).toBeLessThanOrEqual(2);
  });

  it("FRM-RH-003 cabe em 2 páginas", async () => {
    const b = await renderToBuffer(<TermoChaves {...conteudo("termo_chaves")} />);
    expect(contarPaginas(b)).toBeLessThanOrEqual(2);
  });

  it("FRM-RH-004 cabe em 2 páginas", async () => {
    const b = await renderToBuffer(<KitAlojamento {...conteudo("kit_alojamento")} />);
    expect(contarPaginas(b)).toBeLessThanOrEqual(2);
  });

  // 3 páginas, não 2: o grid de 44 linhas ocupa 2 folhas sozinho em paisagem
  // (527pt de altura útil) e o apêndice a terceira. Ver o cabeçalho de
  // frm-rh-005.tsx para o que foi tentado antes de aceitar.
  it("FRM-RH-005 semanal cabe em 3 páginas paisagem", async () => {
    const b = await renderToBuffer(<ChecklistLimpeza {...conteudo("checklist_limpeza")} />);
    expect(contarPaginas(b)).toBeLessThanOrEqual(3);
  });

  it("FRM-RH-005 mensal cabe em 1 página", async () => {
    const b = await renderToBuffer(
      <ChecklistLimpeza {...conteudo("checklist_limpeza")} frequencias={["M"]} />,
    );
    expect(contarPaginas(b)).toBe(1);
  });
});

describe("catálogo de tarefas de limpeza", () => {
  it("o corte por frequência é o que viabiliza a folha semanal", () => {
    const diarias = TAREFAS.filter((t) => t.frequencia === "D").length;
    const semanais = TAREFAS.filter((t) => t.frequencia === "S").length;
    const mensais = TAREFAS.filter((t) => t.frequencia === "M").length;
    expect(diarias + semanais + mensais).toBe(TAREFAS.length);
    // A folha semanal só faz sentido se as mensais saírem dela.
    expect(mensais).toBeGreaterThan(0);
    expect(diarias + semanais).toBeLessThan(TAREFAS.length);
  });

  it("cada bloco do grid abre com sua linha de grupo", () => {
    const linhas = linhasDoGrid(["D", "S"]);
    const grupos = linhas.filter((l) => "grupo" in l);
    const gruposDistintos = new Set(
      TAREFAS.filter((t) => t.frequencia !== "M").map((t) => t.grupo),
    );
    expect(grupos.length).toBe(gruposDistintos.size);
  });

  it("a folha mensal não traz tarefa diária nem semanal", () => {
    const linhas = linhasDoGrid(["M"]);
    const celulas = linhas.filter((l) => "celulas" in l) as { celulas: string[] }[];
    expect(celulas.length).toBeGreaterThan(0);
    expect(celulas.every((l) => l.celulas[1] === "M")).toBe(true);
  });
});

describe("catálogo de documentos", () => {
  it("os quatro formulários novos estão declarados", () => {
    for (const tipo of [
      "medida_disciplinar",
      "termo_chaves",
      "kit_alojamento",
      "checklist_limpeza",
    ]) {
      const doc = DOCUMENTOS.find((d) => d.tipo === tipo);
      expect(doc, `documento ${tipo}`).toBeTruthy();
      expect(doc!.preenchimento).toBe("em_branco");
      expect(doc!.modulo).toBe("imoveis");
    }
  });
});
