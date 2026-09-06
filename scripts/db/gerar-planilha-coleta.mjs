// Gera a planilha de coleta das locações de equipamento.
//
// POR QUE ELA EXISTE.
//
// O parque de TI entrou porque havia uma planilha. O resto da frota — PTA,
// andaime, ar-condicionado, gerador — não tem: quem sabe é quem faz a locação,
// e o dado está em contrato, fatura e memória. Esta planilha é o instrumento
// para cobrar isso dos responsáveis, pedindo EXATAMENTE o que o Loca exige e
// nada além.
//
// O CAMPO QUE MAIS IMPORTA É O VALOR. `item_locado.valor_unitario_periodo` é
// `not null` com DEFAULT 0: sem ele o Loca grava a locação custando R$ 0,00, o
// relatório de custo por obra fecha certo com o número errado, e ninguém
// desconfia. Não vir preenchido é pior que não vir.
//
// Uso: node scripts/db/gerar-planilha-coleta.mjs

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const SAIDA = "Referencias/Importacao/Coleta de Locações.xlsx";

// ─────────────────────────────────────────────────────────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(process.cwd(), ".env.local"), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

async function api(caminho) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${caminho}`, {
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!r.ok) throw new Error(`${caminho} -> ${r.status}`);
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
const CINZA = "FFF1F5F9";
const ESCURO = "FF0F172A";
const VERMELHO = "FFBE3A31";

function cabecalho(aba, colunas) {
  aba.columns = colunas.map((c) => ({
    header: c.titulo,
    key: c.chave,
    width: c.largura,
  }));
  const linha = aba.getRow(1);
  linha.height = 30;
  linha.eachCell((cel, i) => {
    const col = colunas[i - 1];
    cel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    cel.fill = {
      type: "pattern",
      pattern: "solid",
      // Obrigatório em vermelho: a diferença tem de saltar antes de alguém
      // começar a preencher, não depois de devolver a planilha incompleta.
      fgColor: { argb: col.obrigatorio ? VERMELHO : ESCURO },
    };
    cel.alignment = { vertical: "middle", wrapText: true };
  });
  linha.commit();
  aba.views = [{ state: "frozen", ySplit: 1 }];
}

/** Lista suspensa numa coluna inteira, a partir da linha 2. */
function listaSuspensa(aba, letra, valores, ate = 400) {
  for (let r = 2; r <= ate; r++) {
    aba.getCell(`${letra}${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${valores.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Valor fora da lista",
      error: "Escolha uma das opções da lista.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const obras = await api("obra?select=codigo,nome&order=codigo");
  const fornecedores = await api(
    "fornecedor?select=nome,cnpj&ativo=eq.true&order=nome",
  );
  const categorias = await api("categoria_equipamento?select=nome&order=nome");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Loca — Sistenge";
  wb.created = new Date();

  // ═══ LEIA-ME ═══════════════════════════════════════════════════════════
  const leia = wb.addWorksheet("LEIA-ME");
  leia.getColumn(1).width = 3;
  leia.getColumn(2).width = 104;

  const texto = [
    ["t", "Coleta de locações de equipamento"],
    ["p", ""],
    [
      "p",
      "Esta planilha alimenta o Loca, o sistema de controle de locações da Sistenge. " +
        "O parque de TI já está lá dentro; falta o equipamento de obra.",
    ],
    ["p", ""],
    ["h", "O que preencher"],
    [
      "p",
      "Aba CONTRATOS: uma linha por contrato de locação. Se o mesmo fornecedor tem " +
        "três contratos em obras diferentes, são três linhas.",
    ],
    [
      "p",
      "Aba EQUIPAMENTOS: uma linha por equipamento locado, ligada ao contrato pelo " +
        "número. Andaime e escora entram como UMA linha com a quantidade total — " +
        "não é preciso uma linha por painel.",
    ],
    ["p", ""],
    ["h", "As colunas em vermelho são obrigatórias"],
    [
      "p",
      "Sem elas o registro não entra. As demais podem vir em branco e ser " +
        "completadas depois.",
    ],
    ["p", ""],
    ["h", "O VALOR é o campo que mais importa"],
    [
      "a",
      "Se o valor vier em branco, o sistema registra a locação custando R$ 0,00. " +
        "Ele não recusa nem avisa — o relatório de custo da obra simplesmente fica " +
        "errado, e ninguém desconfia. Prefira escrever o valor da fatura mais " +
        "recente a deixar vazio.",
    ],
    ["p", ""],
    ["h", "De onde tirar o dado, na ordem mais fácil"],
    [
      "p",
      "1. A FATURA MENSAL é a melhor fonte: ela discrimina equipamento, período e " +
        "valor, porque é o que está sendo cobrado. O contrato muitas vezes não " +
        "discrimina.",
    ],
    ["p", "2. O contrato dá número, vigência, cadência de cobrança e fornecedor."],
    ["p", "3. O controle da obra dá o que está em campo hoje e desde quando."],
    ["p", ""],
    ["h", "Mande o PDF junto"],
    [
      "p",
      "O Loca guarda o PDF do contrato anexado ao registro. Mandar o arquivo vale " +
        "mais que capricho no preenchimento: dele dá para conferir o resto depois.",
    ],
    ["p", ""],
    ["h", "Não sabe algum campo?"],
    [
      "p",
      "Deixe em branco em vez de chutar. Campo vazio o sistema mostra como " +
        "pendência; campo errado ninguém descobre.",
    ],
  ];

  let r = 2;
  for (const [tipo, conteudo] of texto) {
    const cel = leia.getCell(`B${r}`);
    cel.value = conteudo;
    cel.alignment = { wrapText: true, vertical: "top" };
    if (tipo === "t") {
      cel.font = { bold: true, size: 16, color: { argb: ESCURO } };
      leia.getRow(r).height = 26;
    } else if (tipo === "h") {
      cel.font = { bold: true, size: 11, color: { argb: ESCURO } };
      leia.getRow(r).height = 20;
    } else if (tipo === "a") {
      cel.font = { size: 10, color: { argb: VERMELHO }, bold: true };
      cel.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFDECEA" } };
      leia.getRow(r).height = 58;
    } else {
      cel.font = { size: 10, color: { argb: "FF334155" } };
      leia.getRow(r).height = conteudo.length > 90 ? 40 : 16;
    }
    r++;
  }

  // ═══ CONTRATOS ═════════════════════════════════════════════════════════
  const ct = wb.addWorksheet("CONTRATOS");
  cabecalho(ct, [
    { titulo: "Nº do contrato", chave: "numero", largura: 18, obrigatorio: true },
    { titulo: "Fornecedor", chave: "fornecedor", largura: 42, obrigatorio: true },
    { titulo: "CNPJ", chave: "cnpj", largura: 20 },
    { titulo: "Obra", chave: "obra", largura: 34, obrigatorio: true },
    { titulo: "Início", chave: "inicio", largura: 12, obrigatorio: true },
    { titulo: "Fim previsto", chave: "fim", largura: 13 },
    { titulo: "Cobrança", chave: "cadencia", largura: 13, obrigatorio: true },
    { titulo: "Pró-rata?", chave: "prorata", largura: 11 },
    { titulo: "Situação", chave: "situacao", largura: 12 },
    { titulo: "Quem respondeu", chave: "quem", largura: 22 },
    { titulo: "Observações", chave: "obs", largura: 40 },
  ]);

  ct.addRow({
    numero: "EX-1234",
    fornecedor: fornecedores[2]?.nome ?? "ACESSO EQUIPAMENTOS LTDA",
    cnpj: fornecedores[2]?.cnpj ?? "",
    obra: `${obras[0].codigo} — ${obras[0].nome}`,
    inicio: "01/03/2026",
    fim: "",
    cadencia: "mensal",
    prorata: "sim",
    situacao: "ativo",
    quem: "Fulano — Suprimentos",
    obs: "LINHA DE EXEMPLO — apague antes de devolver.",
  });
  ct.getRow(2).font = { italic: true, color: { argb: "FF94A3B8" }, size: 10 };

  listaSuspensa(ct, "B", fornecedores.map((f) => f.nome).slice(0, 60));
  listaSuspensa(ct, "D", obras.map((o) => `${o.codigo} — ${o.nome}`));
  listaSuspensa(ct, "G", ["diaria", "semanal", "quinzenal", "mensal"]);
  listaSuspensa(ct, "H", ["sim", "nao"]);
  listaSuspensa(ct, "I", ["ativo", "encerrado"]);

  // ═══ EQUIPAMENTOS ══════════════════════════════════════════════════════
  const eq = wb.addWorksheet("EQUIPAMENTOS");
  cabecalho(eq, [
    { titulo: "Nº do contrato", chave: "contrato", largura: 18, obrigatorio: true },
    { titulo: "Equipamento (marca e modelo)", chave: "descricao", largura: 40, obrigatorio: true },
    { titulo: "Categoria", chave: "categoria", largura: 24 },
    { titulo: "Tipo", chave: "tipo", largura: 22 },
    { titulo: "Qtd.", chave: "qtd", largura: 8, obrigatorio: true },
    { titulo: "Valor por período (R$)", chave: "valor", largura: 20, obrigatorio: true },
    { titulo: "Retirada", chave: "retirada", largura: 12, obrigatorio: true },
    { titulo: "Devolução prevista", chave: "prevista", largura: 17 },
    { titulo: "Patrimônio do locador", chave: "patrimonio", largura: 22 },
    { titulo: "Nº de série / chassi", chave: "serie", largura: 22 },
    { titulo: "Horímetro na retirada", chave: "horimetro", largura: 19 },
    { titulo: "Frente / setor", chave: "frente", largura: 20 },
    { titulo: "Observações", chave: "obs", largura: 40 },
  ]);

  const exemplos = [
    {
      contrato: "EX-1234",
      descricao: "Genie GS-1932 — PTA tesoura 8 m",
      categoria: "Acesso e altura",
      tipo: "PTA TESOURA",
      qtd: 1,
      valor: 1850,
      retirada: "01/03/2026",
      prevista: "",
      patrimonio: "PTA-0412",
      serie: "GS3216A-98765",
      horimetro: 1240,
      frente: "Estrutura",
      obs: "LINHA DE EXEMPLO — apague antes de devolver.",
    },
    {
      contrato: "EX-1234",
      descricao: "Painel fachadeiro 1,00 × 1,50 m",
      categoria: "Acesso e altura",
      tipo: "ANDAIME FACHADEIRO",
      qtd: 400,
      valor: 4.5,
      retirada: "01/03/2026",
      prevista: "",
      patrimonio: "",
      serie: "",
      horimetro: "",
      frente: "Fachada",
      obs: "LINHA DE EXEMPLO — quantidade, não uma linha por painel.",
    },
  ];
  for (const e of exemplos) {
    const linha = eq.addRow(e);
    linha.font = { italic: true, color: { argb: "FF94A3B8" }, size: 10 };
  }
  eq.getColumn("valor").numFmt = '#,##0.00';

  listaSuspensa(eq, "C", categorias.map((c) => c.nome).concat("Climatização"));
  listaSuspensa(eq, "E", []); // sem lista: quantidade é livre
  eq.getColumn("E").numFmt = "#,##0";

  // Faixa de conferência: o valor não pode ficar zerado sem alguém ter olhado.
  for (let i = 2; i <= 400; i++) {
    eq.getCell(`F${i}`).dataValidation = {
      type: "decimal",
      operator: "greaterThan",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Valor da locação",
      error:
        "O valor precisa ser maior que zero. Se ainda não souber, deixe em BRANCO — " +
        "zero entra no sistema como locação de graça e ninguém descobre.",
    };
  }

  // ═══ LISTAS (referência) ═══════════════════════════════════════════════
  const lst = wb.addWorksheet("LISTAS");
  cabecalho(lst, [
    { titulo: "Obras cadastradas", chave: "obra", largura: 40 },
    { titulo: "Fornecedores cadastrados", chave: "forn", largura: 46 },
    { titulo: "CNPJ", chave: "cnpj", largura: 20 },
  ]);
  const maior = Math.max(obras.length, fornecedores.length);
  for (let i = 0; i < maior; i++) {
    lst.addRow({
      obra: obras[i] ? `${obras[i].codigo} — ${obras[i].nome}` : "",
      forn: fornecedores[i]?.nome ?? "",
      cnpj: fornecedores[i]?.cnpj ?? "",
    });
  }

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  await wb.xlsx.writeFile(SAIDA);

  console.log(`Planilha gerada: ${SAIDA}`);
  console.log(`   obras na lista:        ${obras.length}`);
  console.log(`   fornecedores na lista: ${fornecedores.length}`);
  console.log(`   categorias na lista:   ${categorias.length} + Climatização`);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
