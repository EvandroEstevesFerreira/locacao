import { describe, it, expect, vi } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { contarPaginas, type Campo } from "@/lib/pdf-form";
import {
  corpoParaParagrafos,
  DEFAULT_TEMPLATES,
  renderTemplate,
} from "@/lib/templates";
import { TermoCompromisso } from "./frm-rh-001";

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


const VARIAVEIS = {
  ocupante: "Fulano de Tal",
  ocupante_cpf: "000.000.000-00",
  ocupante_cargo: "Pedreiro",
  imovel: "Alojamento Central (casa)",
  imovel_endereco: "Rua das Obras, 100, São Paulo, SP",
  quarto: "3",
  armario: "12",
  obra: "OBRA-001 — Edifício Aurora",
  centro_resultado: "CR-4410",
  empresa_nome: "Sistenge Construções e Comércio Ltda",
  cidade: "São Paulo",
};

/** Os 14 rótulos do bloco de identificação, na ordem do FRM-RH-001. */
function campos(preenchidos: boolean): Campo[] {
  const v = preenchidos ? VARIAVEIS : ({} as Partial<typeof VARIAVEIS>);
  return [
    { label: "Nome completo", valor: v.ocupante },
    { label: "CPF", valor: v.ocupante_cpf },
    { label: "RG / Órgão emissor" },
    { label: "Função / Cargo", valor: v.ocupante_cargo },
    { label: "Centro de Resultado (CR)", valor: v.centro_resultado },
    { label: "Contrato / Obra", valor: v.obra },
    { label: "Data de admissão" },
    { label: "Endereço do alojamento", valor: v.imovel_endereco },
    { label: "Nº do alojamento / Quarto", valor: v.quarto },
    { label: "Nº do armário individual", valor: v.armario },
    { label: "Encarregado responsável" },
    { label: "Telefone do encarregado" },
    { label: "Contato de emergência (nome)" },
    { label: "Contato de emergência (telefone)" },
  ];
}

function montar(preenchidos = true) {
  const tpl = DEFAULT_TEMPLATES.termo_responsabilidade;
  return (
    <TermoCompromisso
      orgNome={VARIAVEIS.empresa_nome}
      titulo={renderTemplate(tpl.titulo, VARIAVEIS)}
      campos={campos(preenchidos)}
      paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, VARIAVEIS))}
      localData="São Paulo, 22 de agosto de 2026."
    />
  );
}

// META DE DENSIDADE: 4 páginas — 3 de corpo mais o Anexo I.
//
// O anexo começa em página nova de propósito: é o que se espera de um anexo, e
// evita tabela de penalidades pendurada no rodapé da folha de assinaturas. A
// conta abaixo explica as 3 primeiras.
//
// Medido: o texto do termo sozinho — 54 parágrafos, 44 cláusulas, 7.270
// caracteres — já ocupa 2 páginas cheias a 8,5pt. Somando o bloco de 14 campos
// de identificação, a tabela de penalidades e as 4 assinaturas, 2 páginas só
// seriam possíveis abaixo de 7,5pt.
//
// Não vale a pena: este é o documento que o alojado precisa LER e que sustenta
// justa causa. Vale aqui o mesmo princípio que a spec fixou para a política —
// não se resume para caber. Os demais formulários seguem com meta de 2.
describe("FRM-RH-001 — Termo de Compromisso de Alojamento", () => {
  it("cabe em 4 páginas com todos os dados preenchidos", async () => {
    expect(contarPaginas(await renderToBuffer(montar(true)))).toBeLessThanOrEqual(4);
  });

  it("cabe em 4 páginas em branco, para impressão", async () => {
    expect(contarPaginas(await renderToBuffer(montar(false)))).toBeLessThanOrEqual(4);
  });

  it("renderiza sem erro mesmo sem parágrafos de template", async () => {
    const buffer = await renderToBuffer(
      <TermoCompromisso
        orgNome="Sistenge"
        titulo="TERMO DE COMPROMISSO DE ALOJAMENTO"
        campos={campos(true)}
        paragrafos={[]}
        localData="São Paulo, 22 de agosto de 2026."
      />,
    );
    expect(contarPaginas(buffer)).toBeGreaterThanOrEqual(1);
  });
});

describe("aceite eletrônico", () => {
  it("com aceite, o termo continua cabendo em 4 páginas", async () => {
    const tpl = DEFAULT_TEMPLATES.termo_responsabilidade;
    const b = await renderToBuffer(
      <TermoCompromisso
        orgNome={VARIAVEIS.empresa_nome}
        titulo={renderTemplate(tpl.titulo, VARIAVEIS)}
        campos={campos(true)}
        paragrafos={corpoParaParagrafos(renderTemplate(tpl.corpo, VARIAVEIS))}
        localData="São Paulo, 22 de agosto de 2026."
        aceite={{ em: "22/08/2026 14:30", ip: "187.0.0.1" }}
      />,
    );
    expect(contarPaginas(b)).toBeLessThanOrEqual(4);
  });
});
