import { describe, it, expect } from "vitest";
import {
  podeReceberTermo,
  ehRegularizacao,
  resolverPecaPedida,
  podeEncerrarDevolucao,
  lembreteValido,
  MOTIVO_SEM_ASSINATURA_MINIMO,
} from "./custodia";

const peca = (situacao: string, temPosseAberta = false) => ({
  situacao,
  temPosseAberta,
});

describe("podeReceberTermo", () => {
  it("peça disponível e sem posse pode receber", () => {
    expect(podeReceberTermo(peca("disponivel"))).toBe(true);
  });

  it("peça EM USO sem posse aberta também pode — é o caso das 95", () => {
    // A importação do inventário marcou `em_uso` a partir da planilha sem criar
    // termo. Sem esta regra elas ficavam presas: a matriz só admite chegar a
    // `em_uso` POR um termo, e sair dali por devolução NUM termo.
    expect(podeReceberTermo(peca("em_uso"))).toBe(true);
  });

  it("peça com posse aberta NÃO pode, esteja como estiver", () => {
    // É a proteção que o filtro antigo queria dar e mirava errado: dois termos
    // assinados sobre o mesmo patrimônio.
    expect(podeReceberTermo(peca("em_uso", true))).toBe(false);
    expect(podeReceberTermo(peca("disponivel", true))).toBe(false);
  });

  it("manutenção, baixada e perdida ficam de fora", () => {
    // Entregar a alguém uma peça que está na oficina ou dada como perdida é um
    // documento que nasce mentindo.
    expect(podeReceberTermo(peca("manutencao"))).toBe(false);
    expect(podeReceberTermo(peca("baixada"))).toBe(false);
    expect(podeReceberTermo(peca("perdida"))).toBe(false);
  });

  it("a posse vence a situação", () => {
    // A ordem das checagens importa: se a situação fosse consultada primeiro,
    // uma peça disponível com posse aberta passaria.
    expect(podeReceberTermo(peca("disponivel", true))).toBe(false);
  });
});

describe("ehRegularizacao", () => {
  it("em uso sem posse é regularização, não entrega nova", () => {
    // Muda o rótulo do botão, e o rótulo importa: "Entregar a funcionário" numa
    // máquina que já está com a pessoa há meses faria quem clica achar que está
    // fazendo outra coisa.
    expect(ehRegularizacao(peca("em_uso"))).toBe(true);
  });

  it("disponível é entrega nova", () => {
    expect(ehRegularizacao(peca("disponivel"))).toBe(false);
  });

  it("com posse aberta não é nem uma coisa nem outra", () => {
    // E nem chega a aparecer: `podeReceberTermo` já barrou.
    expect(ehRegularizacao(peca("em_uso", true))).toBe(false);
  });
});

describe("resolverPecaPedida", () => {
  const livres = [
    { id: "aaa", identificador: "13RK564" },
    { id: "bbb", identificador: "14L4594" },
  ];

  it("devolve a peça quando ela está entre as livres", () => {
    const r = resolverPecaPedida("aaa", livres);
    expect(r.peca?.identificador).toBe("13RK564");
    expect(r.foraDaLista).toBe(false);
  });

  it("sem parâmetro não é peça fora da lista — é termo que não nasceu de peça", () => {
    // Quem entra por "Novo termo" na lista de Termos não pediu peça nenhuma.
    // Marcar `foraDaLista` aqui mostraria a essa pessoa um aviso sobre uma
    // escolha que ela nunca fez.
    for (const vazio of [undefined, null, ""]) {
      const r = resolverPecaPedida(vazio, livres);
      expect(r.peca).toBeNull();
      expect(r.foraDaLista).toBe(false);
    }
  });

  it("RECUSA id que não está na lista de livres", () => {
    // A regra que impede dois termos assinados sobre o mesmo patrimônio. O
    // parâmetro vem da URL — digitável, editável, compartilhável —, e a lista
    // de livres é quem já respondeu, com RLS e custódia, quem pode receber.
    const r = resolverPecaPedida("ccc", livres);
    expect(r.peca).toBeNull();
    expect(r.foraDaLista).toBe(true);
  });

  it("recusa também com a lista vazia", () => {
    const r = resolverPecaPedida("aaa", []);
    expect(r.peca).toBeNull();
    expect(r.foraDaLista).toBe(true);
  });

  it("não confunde id com identificador", () => {
    // Um `find` por identificador aceitaria "13RK564" na URL. São chaves
    // diferentes, e o patrimônio se repete entre organizações.
    const r = resolverPecaPedida("13RK564", livres);
    expect(r.peca).toBeNull();
    expect(r.foraDaLista).toBe(true);
  });
});

describe("podeEncerrarDevolucao", () => {
  it("com assinatura, passa — motivo nem é olhado", () => {
    expect(podeEncerrarDevolucao({ assinou: true, motivo: null }).ok).toBe(true);
  });

  it("sem assinatura e sem motivo, RECUSA", () => {
    const r = podeEncerrarDevolucao({ assinou: false, motivo: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("motivo");
  });

  it("sem assinatura, com motivo suficiente, passa", () => {
    // O caso que motivou existir: quem foi desligado e não volta para assinar.
    const r = podeEncerrarDevolucao({
      assinou: false,
      motivo: "Desligado em 12/08, equipamento recolhido pelo RH.",
    });
    expect(r.ok).toBe(true);
  });

  it("motivo curto demais não vale", () => {
    // Dez caracteres não são burocracia: são a diferença entre uma explicação
    // e um espaço em branco que ninguém entende daqui a um ano.
    const r = podeEncerrarDevolucao({ assinou: false, motivo: "sumiu" });
    expect(r.ok).toBe(false);
  });

  it("espaço em branco não é motivo", () => {
    expect(podeEncerrarDevolucao({ assinou: false, motivo: "              " }).ok)
      .toBe(false);
  });

  it("o mínimo bate com o `check` da migration 0102", () => {
    // Se divergirem, a tela aceita e o banco recusa — erro cru de Postgres na
    // cara de quem está com o funcionário na frente.
    expect(MOTIVO_SEM_ASSINATURA_MINIMO).toBe(10);
  });
});

describe("lembreteValido", () => {
  const base = { destinatarioId: "f1", situacao: "disponivel", temPosseAberta: false };

  it("peça livre e destinatário anotado: o lembrete vale", () => {
    expect(lembreteValido(base)).toBe(true);
  });

  it("sem destinatário, não há lembrete", () => {
    expect(lembreteValido({ ...base, destinatarioId: null })).toBe(false);
  });

  it("ALGUÉM LEVOU ANTES: o lembrete deixa de valer", () => {
    // Não impede, lembra. Insistir transformaria uma intenção anotada num
    // impedimento real — e a decisão foi de quem estava lá.
    expect(lembreteValido({ ...base, temPosseAberta: true })).toBe(false);
    expect(lembreteValido({ ...base, situacao: "em_uso" })).toBe(false);
  });

  it("peça em manutenção também não lembra", () => {
    expect(lembreteValido({ ...base, situacao: "manutencao" })).toBe(false);
  });
});
