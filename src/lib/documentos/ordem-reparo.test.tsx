import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas } from "@/lib/pdf-form";
import { OrdemReparo, type DadosOrdemReparo } from "./ordem-reparo";
import { textoDe, contemTexto } from "./inspecionar";

vi.setConfig({ testTimeout: 120_000 });

/**
 * A ordem de reparo é o único documento de equipamento que VIAJA COM A MÁQUINA.
 * Sai da obra na mão de quem leva a peça, e a assinatura de quem recebe na
 * oficina é a única prova de onde ela foi parar.
 */

const base: DadosOrdemReparo = {
  numero: "RPE-2026-0002",
  orgNome: "Sistenge Engenharia",
  peca: "VI-0087",
  item: "Vibrador de imersão 1,5 cv",
  descricao: "Substituir mangote e revisar o cabeçote.",
  executor: "Oficina Central Ltda.",
  status: "Em execução",
  responsabilidade: "Da obra",
  abertoEm: "05/09/2026",
  enviadoEm: "06/09/2026",
  previstoPara: "12/09/2026",
  concluidoEm: null,
  valor: "R$ 1.250,00",
  garantia: "90 dias",
  observacoes: null,
  avaria: "AVA-2026-0003",
  localData: "05/09/2026.",
};

describe("OrdemReparo — o que está escrito", () => {
  it("diz que é ordem de reparo, e traz o número", () => {
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "Ordem de reparo de equipamento")).toBe(true);
    expect(contemTexto(doc, "RPE-2026-0002")).toBe(true);
  });

  it("o rodapé é o de locações, não o de Recursos Humanos", () => {
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "controle de locações")).toBe(true);
    expect(contemTexto(doc, "Recursos Humanos")).toBe(false);
  });

  it("tem a linha de assinatura de quem recebe na oficina", () => {
    // O CASO QUE MAIS IMPORTA NESTE ARQUIVO. Sem esta assinatura, a ordem é um
    // pedido interno; com ela, é o recibo de que a peça chegou a alguém.
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "Recebido na oficina — Oficina Central Ltda.")).toBe(true);
    expect(contemTexto(doc, "Retirado por — transportador")).toBe(true);
    expect(contemTexto(doc, "Autorizado por — obra")).toBe(true);
  });

  it("identifica a peça e o equipamento, não só um deles", () => {
    // "VI-0087" sozinho não diz nada a quem recebe na oficina; "Vibrador"
    // sozinho não diz QUAL vibrador. Os dois, sempre.
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "VI-0087")).toBe(true);
    expect(contemTexto(doc, "Vibrador de imersão 1,5 cv")).toBe(true);
  });

  it("aponta a avaria de origem quando existe", () => {
    expect(contemTexto(<OrdemReparo dados={base} />, "AVA-2026-0003")).toBe(true);
  });

  it("a manutenção preventiva sai sem avaria e sem lixo no lugar", () => {
    // Reparo sem avaria é revisão de rotina — caso legítimo e comum. O campo
    // não pode imprimir "null" nem sumir com o rótulo.
    const texto = textoDe(
      <OrdemReparo
        dados={{ ...base, avaria: null, concluidoEm: null, garantia: null }}
      />,
    );
    expect(texto).toContain("Avaria de origem");
    expect(texto).not.toMatch(/undefined|null|NaN|\[object Object\]/);
  });

  it("valor e garantia saem formatados, não como número cru", () => {
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "R$ 1.250,00")).toBe(true);
    expect(contemTexto(doc, "90 dias")).toBe(true);
  });

  it("as quatro datas do ciclo aparecem rotuladas", () => {
    const doc = <OrdemReparo dados={base} />;
    expect(contemTexto(doc, "Aberta em")).toBe(true);
    expect(contemTexto(doc, "Saída da obra")).toBe(true);
    expect(contemTexto(doc, "Previsão de retorno")).toBe(true);
    expect(contemTexto(doc, "Concluída em")).toBe(true);
  });
});

describe("OrdemReparo — a forma", () => {
  it("uma ordem comum cabe em uma página", async () => {
    const buffer = await renderToBuffer(<OrdemReparo dados={base} />);
    expect(contarPaginas(buffer)).toBe(1);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("aguenta uma descrição longa de serviço", async () => {
    const longo: DadosOrdemReparo = {
      ...base,
      descricao: Array.from(
        { length: 30 },
        (_, n) => `Item ${n + 1} do serviço a executar, descrito com detalhe.`,
      ).join(" "),
      observacoes: "Peça retirada com o cabo de alimentação e a maleta.",
    };
    const buffer = await renderToBuffer(<OrdemReparo dados={longo} />);
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });
});
