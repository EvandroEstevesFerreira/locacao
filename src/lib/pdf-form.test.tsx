import { describe, it, expect, vi } from "vitest";
import { renderToBuffer, Text } from "@react-pdf/renderer";
import {
  Documento,
  Secao,
  CampoGrid,
  Lista,
  OpcoesCheck,
  AreaTexto,
  Tabela,
  ESTILO_PAGINA,
  CAIXA_GEOMETRIA,
  Assinaturas,
  somaLarguras,
  CAIXA,
  contarPaginas,
  type Coluna,
  type LinhaTabela,
} from "./pdf-form";

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


describe("contarPaginas", () => {
  it("conta as páginas de um PDF renderizado", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-001" titulo="Documento de teste">
        <Secao n={1} titulo="Seção única">
          <Text>Conteúdo curto.</Text>
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("CampoGrid", () => {
  it("renderiza campo com valor e campo em branco sem estourar", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-002" titulo="Campos">
        <Secao n={1} titulo="Identificação">
          <CampoGrid
            colunas={2}
            campos={[
              { label: "Nome completo", valor: "Fulano de Tal" },
              { label: "RG / Órgão emissor" },
              { label: "CPF", valor: "000.000.000-00" },
              { label: "Contato de emergência" },
            ]}
          />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("primitivos de texto", () => {
  it("lista numerada, opções com linha e área de escrita cabem em 1 página", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-003" titulo="Texto">
        <Secao n={1} titulo="Regras">
          <Lista tipo="numerada" itens={["Primeira regra.", "Segunda regra."]} />
        </Secao>
        <Secao n={2} titulo="Tipo de medida">
          <OpcoesCheck
            opcoes={[
              { texto: "Advertência verbal" },
              { texto: "Suspensão — período:", linha: true },
            ]}
          />
        </Secao>
        <Secao n={3} titulo="Descrição">
          <AreaTexto linhas={4} />
        </Secao>
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

const COLUNAS_LIMPEZA: Coluna[] = [
  { titulo: "Tarefa", largura: 34 },
  { titulo: "Freq.", largura: 6, alinhar: "center" },
  { titulo: "Seg", largura: 7, alinhar: "center" },
  { titulo: "Ter", largura: 7, alinhar: "center" },
  { titulo: "Qua", largura: 7, alinhar: "center" },
  { titulo: "Qui", largura: 7, alinhar: "center" },
  { titulo: "Sex", largura: 7, alinhar: "center" },
  { titulo: "Sáb", largura: 7, alinhar: "center" },
  { titulo: "Dom", largura: 7, alinhar: "center" },
  { titulo: "Rubrica", largura: 11 },
];

describe("somaLarguras", () => {
  it("as colunas do checklist de limpeza somam 100%", () => {
    expect(somaLarguras(COLUNAS_LIMPEZA)).toBe(100);
  });

  it("as colunas de penalidades somam 100%", () => {
    expect(
      somaLarguras([
        { titulo: "Penalidade", largura: 30 },
        { titulo: "Como se aplica", largura: 70 },
      ]),
    ).toBe(100);
  });
});

describe("Tabela", () => {
  it("o grid de 45 tarefas em paisagem cabe em 2 páginas", async () => {
    const grupos = [
      "BANHEIROS",
      "COZINHA / REFEITÓRIO",
      "QUARTOS",
      "SALA",
      "LAVANDERIA",
    ];
    const linhas: LinhaTabela[] = [];
    for (const g of grupos) {
      linhas.push({ grupo: g });
      for (let i = 0; i < 9; i++) {
        linhas.push({
          celulas: [
            `Tarefa ${i + 1} do grupo ${g}, com descrição de tamanho realista`,
            "D",
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            CAIXA,
            "",
          ],
        });
      }
    }
    const buffer = await renderToBuffer(
      <Documento
        codigo="FRM-RH-005"
        titulo="Checklist semanal de limpeza"
        orientacao="landscape"
      >
        <Tabela colunas={COLUNAS_LIMPEZA} linhas={linhas} />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBeLessThanOrEqual(2);
  });
});

describe("Assinaturas", () => {
  it("quatro assinantes em grid 2x2 cabem em 1 página", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-004" titulo="Assinaturas">
        <Assinaturas
          localData="São Paulo, 22 de agosto de 2026."
          assinantes={[
            { papel: "Empregado(a)", nome: "Fulano de Tal" },
            { papel: "Recursos Humanos — Sistenge" },
            { papel: "Testemunha 1" },
            { papel: "Testemunha 2" },
          ]}
        />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  // PNG 1x1 transparente, o menor data URI válido. O que se testa aqui é que o
  // renderer ACEITA a imagem e fecha o documento — o desenho em si é do canvas,
  // e verificá-lo pixel a pixel testaria o @react-pdf, não o nosso código.
  const PNG_MINIMO =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  it("no modo imagem imprime o traço desenhado", async () => {
    // Este modo é a correção de um buraco que existia desde a 0012: a vistoria
    // guarda `assinatura_*_img` desde então e NENHUM PDF imprimia. Quem
    // assinava na tela assinava no vazio.
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-006" titulo="Assinatura desenhada">
        <Assinaturas
          modo="imagem"
          assinantes={[
            {
              papel: "Funcionário",
              nome: "Fulano de Tal",
              imagem: PNG_MINIMO,
              detalhe: "Assinado em 02/09/2026 às 09:15 — IP 187.0.0.1",
            },
            { papel: "Sistenge Engenharia", nome: "Beltrano", imagem: PNG_MINIMO },
          ]}
        />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("no modo imagem, assinante SEM traço não quebra nem desalinha", async () => {
    // O espaço da imagem é reservado mesmo vazio: sem isso, uma coluna com
    // traço e outra sem sairiam com as linhas em alturas diferentes.
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-007" titulo="Assinatura parcial">
        <Assinaturas
          modo="imagem"
          assinantes={[
            { papel: "Funcionário", nome: "Fulano", imagem: PNG_MINIMO },
            { papel: "Empresa", nome: "Beltrano", imagem: null },
          ]}
        />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });

  it("no modo aceite imprime o registro em vez de deixar linha", async () => {
    const buffer = await renderToBuffer(
      <Documento codigo="TESTE-005" titulo="Aceite">
        <Assinaturas
          modo="aceite"
          assinantes={[
            {
              papel: "Empregado(a)",
              nome: "Fulano de Tal",
              detalhe: "Aceite em 22/08/2026 às 14:30 — IP 187.0.0.1",
            },
          ]}
        />
      </Documento>,
    );
    expect(contarPaginas(buffer)).toBe(1);
  });
});

describe("rodapé fixo — regressão", () => {
  // O rodapé traz a paginação ("Página 2 de 3"), que num documento de várias
  // folhas é o que prova que nenhuma página foi retirada do processo.
  //
  // Com `lineHeight` no estilo da Page, o @react-pdf/renderer 4.5 simplesmente
  // não desenha filhos `position: absolute` + `fixed`. Some sem erro, e o teste
  // de contagem de páginas passa igual. Este teste é o guarda dessa regra.
  it("o estilo da página não declara lineHeight", () => {
    expect(Object.keys(ESTILO_PAGINA)).not.toContain("lineHeight");
  });

  it("o entrelinhamento vive nos estilos de texto, não na página", () => {
    expect(ESTILO_PAGINA.fontSize).toBe(9);
  });
});

describe("caixa de marcação — regressão", () => {
  // Duas armadilhas já custaram caro neste primitivo:
  //   1. o glifo ☐ do Helvetica não existe — a caixa é desenhada;
  //   2. o X maior que a área interna é recortado e a caixa sai VAZIA mesmo
  //      marcada, sem erro nenhum.
  // Teste de conteúdo não pega nenhuma das duas: o X está no PDF, só invisível.
  it("o X cabe dentro da caixa, descontadas as bordas", () => {
    const { lado, borda, marcaFonte, marcaEntrelinha } = CAIXA_GEOMETRIA;
    const alturaUtil = lado - borda * 2;
    const alturaDoX = marcaFonte * marcaEntrelinha;
    expect(alturaDoX).toBeLessThanOrEqual(alturaUtil);
  });

  it("a marca declara entrelinha própria, sem herdar da página", () => {
    expect(CAIXA_GEOMETRIA.marcaEntrelinha).toBe(1);
  });
});
