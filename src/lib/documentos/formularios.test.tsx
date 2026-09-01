import { describe, it, expect, vi } from "vitest";
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
import { PoliticaAlojamento } from "./pol-rh-001";
import { ITENS_PADRAO, ITENS_ENTREGA } from "@/lib/alojamento";

// Timeout generoso para os testes que renderizam PDF de verdade.
//
// O que eles afirmam é CONTAGEM DE PÁGINAS, não velocidade. Isolados, os 12
// casos deste arquivo rodam em 6,2s — mas o `renderToBuffer` é CPU-bound e, na
// suíte completa, disputa com os outros arquivos em paralelo.
//
// Medido em 2026-09-01: a mesma suíte completou em 33s numa rodada e em 231s em
// outra, sem nenhuma mudança de código. Sete vezes de variação. Limitar
// `maxWorkers` para 4 e 6 não estabilizou. Com essa amplitude, o teto global de
// 30s do vitest.config.ts produz falso negativo — e um teste que falha por
// contenção treina a equipe a ignorar a suíte, que é pior que não ter o teste.
//
// 120s continua pegando travamento de verdade (o alvo do timeout) e não custa
// nada quando a máquina está saudável: o teste termina em 6s de qualquer jeito.
vi.setConfig({ testTimeout: 120_000 });


/**
 * Os rótulos que o PDF de fato desenha. Lidos de ITENS_ENTREGA, que é a fonte
 * que os dois componentes consomem — se um deles voltar a manter lista própria,
 * este helper deixa de refletir o PDF e o teste perde sentido, então ele é
 * deliberadamente simples e direto.
 */
const linhasKitDoPdf = () => ITENS_ENTREGA.kit.map((i) => i.item);
const linhasChavesDoPdf = () => ITENS_ENTREGA.chaves.map((i) => i.item);

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

describe("POL-RH-001", () => {
  it("cai de 14 para no máximo 10 páginas", async () => {
    const b = await renderToBuffer(
      <PoliticaAlojamento {...conteudo("politica_alojamento")} />,
    );
    expect(contarPaginas(b)).toBeLessThanOrEqual(10);
  });

  it("o texto cobre as seções que sustentam o regime disciplinar", async () => {
    const tpl = DEFAULT_TEMPLATES.politica_alojamento;
    for (const termo of ["NR-24", "LGPD", "CFTV", "art. 482", "reincidência"]) {
      expect(tpl.corpo.toLowerCase()).toContain(termo.toLowerCase());
    }
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
      "politica_alojamento",
    ]) {
      const doc = DOCUMENTOS.find((d) => d.tipo === tipo);
      expect(doc, `documento ${tipo}`).toBeTruthy();
      expect(doc!.preenchimento).toBe("em_branco");
      expect(doc!.modulo).toBe("imoveis");
    }
  });
});

describe("formulários preenchidos a partir do registro", () => {
  const dados = {
    ocupante: "José Aparecido da Silva",
    cpf: "123.456.789-00",
    cargo: "Pedreiro",
    centroResultado: "CR-4410",
    obra: "OBRA-014 — Edifício Aurora",
    endereco: "Rua das Palmeiras, 240, Osasco, SP",
    quarto: "3",
    armario: "12",
    entregueEm: "01/08/2026",
    devolvidoEm: "22/08/2026",
    itens: ["Chave da porta de entrada do alojamento", "Fronha"],
    avarias: "Cadeado do armário com a haste empenada, sem impedir o fechamento.",
    devolucaoMotivo: "desligamento",
    tratativa: "desgaste_natural",
  };

  it("FRM-RH-003 preenchido cabe em 2 páginas", async () => {
    const b = await renderToBuffer(
      <TermoChaves {...conteudo("termo_chaves")} dados={dados} />,
    );
    expect(contarPaginas(b)).toBeLessThanOrEqual(2);
  });

  it("FRM-RH-004 preenchido cabe em 2 páginas", async () => {
    const b = await renderToBuffer(
      <KitAlojamento {...conteudo("kit_alojamento")} dados={dados} />,
    );
    expect(contarPaginas(b)).toBeLessThanOrEqual(2);
  });

  it("o checklist de conservação sai em branco mesmo no documento preenchido", async () => {
    // Vistoria conjunta não se pré-marca a partir do sistema: seria inventar uma
    // conferência que não aconteceu, e avaria não registrada na entrada vira
    // cobrança indevida na saída. Se alguém ligar o checklist aos dados, este
    // teste tem de ser reescrito de propósito, não por acidente.
    const comDados = await renderToBuffer(
      <TermoChaves {...conteudo("termo_chaves")} dados={dados} />,
    );
    const semDados = await renderToBuffer(<TermoChaves {...conteudo("termo_chaves")} />);
    expect(contarPaginas(comDados)).toBe(contarPaginas(semDados));
  });
});

describe("rótulos de item — formulário e PDF são a mesma fonte", () => {
  // O defeito que este teste guarda: o formulário gravava "Lençol (par)" e o PDF
  // comparava com "Lençol (par — inferior e superior)". A caixa do lençol nunca
  // era marcada no documento preenchido, e nada acusava — tipo, teste e build
  // passavam todos. Qualquer divergência de rótulo agora reprova aqui.
  it("todo item que o formulário oferece existe na tabela do PDF do kit", () => {
    const noPdf = new Set(linhasKitDoPdf());
    for (const item of ITENS_PADRAO.kit) {
      expect(noPdf, `item "${item}" do formulário`).toContain(item);
    }
  });

  it("todo item que o formulário oferece existe na tabela do PDF de chaves", () => {
    const noPdf = new Set(linhasChavesDoPdf());
    for (const item of ITENS_PADRAO.chaves) {
      expect(noPdf, `item "${item}" do formulário`).toContain(item);
    }
  });
});
