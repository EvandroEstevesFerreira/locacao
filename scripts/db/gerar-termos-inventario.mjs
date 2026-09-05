// Gera os RASCUNHOS de termo de equipamento a partir do inventário de TI.
//
// POR QUE SÓ RASCUNHO. A migration 0059 diz que posse de funcionário só nasce
// de termo assinado:
//
//   check (tipo <> 'funcionario' or (origem = 'termo' and termo_id is not null))
//
// A regra está certa e este script não a contorna. Uma planilha de 16/07 não é
// prova de que alguém respondeu pelo equipamento; a assinatura é. O que dá para
// automatizar é o trabalho BURRO — descobrir quem tem o quê e montar o termo —
// deixando para o humano só o ato que exige um humano.
//
// O resultado é um rascunho por PESSOA, com todas as peças dela. Não são 96
// termos para 96 máquinas: são ~N termos, um por detentor, cada um com as suas.
// O RH abre, confere, colhe a assinatura, e `emitirTermo` abre a custódia.
//
// Uso, a partir da raiz do projeto:
//   node scripts/db/gerar-termos-inventario.mjs             # prévia, não grava
//   node scripts/db/gerar-termos-inventario.mjs --aplicar   # grava os rascunhos
//
// Idempotente: pessoa que já tem rascunho aberto é pulada. Rodar de novo não
// duplica. A chave service_role é lida de .env.local e NUNCA impressa.

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const PLANILHA =
  process.argv.find((a) => a.endsWith(".xlsx")) ??
  "C:/Projetos_Sistenge/Loca/Referencias/Nova pasta (2)/Inventário(16.07.26).xlsx";
const ABA = "Máquinas";
const APLICAR = process.argv.includes("--aplicar");

// ═══════════════════════════════════════════════════════════════════════════
// Ambiente
// ═══════════════════════════════════════════════════════════════════════════
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
const URL_BASE = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

async function api(caminho, opcoes = {}) {
  const r = await fetch(`${URL_BASE}/${caminho}`, {
    ...opcoes,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(opcoes.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${caminho}: ${await r.text()}`);
  // O PostgREST responde 201 com CORPO VAZIO quando não se pede
  // `Prefer: return=representation`. Chamar r.json() ali estoura com
  // "Unexpected end of JSON input" DEPOIS de a linha já ter sido gravada — o
  // pior tipo de falha: o efeito aconteceu e o script aborta como se não.
  const corpo = await r.text();
  return corpo ? JSON.parse(corpo) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Normalização — a MESMA de `importar-inventario-ti.mjs`
// ═══════════════════════════════════════════════════════════════════════════
// Copiada, e não importada, de propósito: os dois scripts são independentes e
// rodam em momentos diferentes. Divergir aqui criaria "Andrea Marques" e
// "andrea.marques" como duas pessoas — que é exatamente o que a normalização
// existe para impedir. O teste em `gerar-termos.test.ts` compara as duas.
const NAO_E_PESSOA =
  /^(livre|dispon[ií]vel|devolvida|reserva|obra|or[çc]amentos?|almoxarifado|rack|servidor|paseli|n[aã]o possui)\b/i;

export function pessoaNormalizada(bruto) {
  const t = String(bruto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (NAO_E_PESSOA.test(t)) return null;
  return t
    .replace(/\s*\(new\)\s*$/i, "")
    .replace(/\s+atual\s*$/i, "")
    .replace(/[._]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p) => (p.length <= 2 ? p : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// Planilha
// ═══════════════════════════════════════════════════════════════════════════
const txt = (v) => String(v?.text ?? v?.result ?? v ?? "").trim();

async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);
  const ws = wb.getWorksheet(ABA);
  if (!ws) throw new Error(`Aba "${ABA}" não encontrada em ${PLANILHA}`);

  const cab = ws.getRow(1).values.slice(1).map((v) => txt(v));
  const col = (nome) => cab.indexOf(nome) + 1;
  const cUsuario = col("USUÁRIOS");
  const cTag = col("TAG");
  const cNome = col("NOME DO DISPOSITIVO");
  if (cUsuario < 1) throw new Error('Coluna "USUÁRIOS" não encontrada.');

  const linhas = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const identificador = txt(row.values[cTag]) || txt(row.values[cNome]);
    if (!identificador) return;
    linhas.push({
      bruto: txt(row.values[cUsuario]),
      pessoa: pessoaNormalizada(txt(row.values[cUsuario])),
      identificador,
    });
  });
  return linhas;
}

// ═══════════════════════════════════════════════════════════════════════════
// Plano
// ═══════════════════════════════════════════════════════════════════════════
function montarPlano(linhas, pecasPorId, funcPorNome, comTermo) {
  const porPessoa = new Map();
  const semPeca = [];
  const semFuncionario = [];
  const semDetentor = [];

  for (const l of linhas) {
    if (!l.pessoa) {
      semDetentor.push(l);
      continue;
    }
    const peca = pecasPorId.get(l.identificador.toUpperCase());
    if (!peca) {
      // A peça está na planilha e não no banco: a importação de itens não a
      // criou. Não invento — reporto.
      semPeca.push(l);
      continue;
    }
    const func = funcPorNome.get(l.pessoa.toLowerCase());
    if (!func) {
      semFuncionario.push(l);
      continue;
    }
    const atual = porPessoa.get(func.id) ?? { func, pecas: [] };
    atual.pecas.push({ ...peca, identificador: l.identificador });
    porPessoa.set(func.id, atual);
  }

  const aCriar = [];
  const jaTem = [];
  for (const [funcId, dados] of porPessoa) {
    if (comTermo.has(funcId)) jaTem.push(dados);
    else aCriar.push(dados);
  }

  return { aCriar, jaTem, semPeca, semFuncionario, semDetentor };
}

function imprimirPlano(p) {
  const linha = "═".repeat(76);
  console.log(linha);
  console.log("PRÉVIA — rascunhos de termo a partir do inventário");
  console.log(linha);

  const totalPecas = p.aCriar.reduce((s, d) => s + d.pecas.length, 0);
  console.log(`\n  rascunhos a criar: ${p.aCriar.length}`);
  console.log(`  peças cobertas:    ${totalPecas}`);
  if (p.jaTem.length) {
    console.log(`  pulados (já têm termo aberto): ${p.jaTem.length}`);
  }

  console.log("\n  Por pessoa:");
  for (const d of [...p.aCriar].sort((a, b) => b.pecas.length - a.pecas.length)) {
    console.log(
      `    ${String(d.pecas.length).padStart(2)}  ${d.func.nome}  —  ${d.pecas
        .map((x) => x.identificador)
        .join(", ")
        .slice(0, 90)}`,
    );
  }

  // O que NÃO entra é tão importante quanto o que entra: sem esta lista, as
  // peças que ficaram de fora somem sem que ninguém saiba.
  if (p.semFuncionario.length) {
    console.log(`\n  ⚠ SEM FUNCIONÁRIO CADASTRADO (${p.semFuncionario.length}):`);
    const nomes = [...new Set(p.semFuncionario.map((l) => l.pessoa))];
    nomes.forEach((n) => console.log(`      ${n}`));
    console.log("      Cadastre em /termos/funcionarios e rode de novo.");
  }
  if (p.semPeca.length) {
    console.log(`\n  ⚠ PEÇA NÃO ENCONTRADA NO BANCO (${p.semPeca.length}):`);
    p.semPeca.slice(0, 10).forEach((l) => console.log(`      ${l.identificador} (${l.bruto})`));
    if (p.semPeca.length > 10) console.log(`      … e mais ${p.semPeca.length - 10}`);
    console.log("      Rode importar-inventario-ti.mjs --aplicar antes.");
  }
  console.log(`\n  sem detentor na planilha (livre, obra, servidor…): ${p.semDetentor.length}`);
  console.log("");
}

// ═══════════════════════════════════════════════════════════════════════════
// Gravação
// ═══════════════════════════════════════════════════════════════════════════
async function aplicar(plano, orgId) {
  let criados = 0;
  let itens = 0;

  for (const d of plano.aCriar) {
    // `emitido_em` fica NULO: nasce rascunho. É `emitirTermo`, com a assinatura
    // em mãos, que numera o termo e abre a custódia.
    const [termo] = await api("termo_equipamento", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId,
        funcionario_id: d.func.id,
        data_entrega: DATA_INVENTARIO,
        observacoes:
          "Rascunho gerado do inventário de TI de 16/07/2026. Confira as peças " +
          "com o colaborador antes de colher a assinatura.",
      }),
    });

    await api("termo_equipamento_item", {
      method: "POST",
      body: JSON.stringify(
        d.pecas.map((peca) => ({
          org_id: orgId,
          termo_id: termo.id,
          item_id: peca.item_id,
          unidade_id: peca.id,
          quantidade: 1,
          // "bom" e não "usado": o enum `estado_equipamento` é novo | bom |
          // regular | com_avaria. A planilha não diz o estado, e "bom" é a
          // suposição que o RH corrige na conferência, antes de assinar.
          estado_entrega: "bom",
        })),
      ),
    });

    criados++;
    itens += d.pecas.length;
  }

  console.log("═".repeat(76));
  console.log("GRAVADO");
  console.log("═".repeat(76));
  console.log(`   rascunhos criados: ${criados}`);
  console.log(`   peças nos termos:  ${itens}`);
  console.log("\n   Nenhuma custódia foi aberta: posse nasce da assinatura.");
  console.log("   Próximo passo é humano — /termos, abrir cada rascunho e emitir.\n");
}

/** A data que a planilha representa. Não é "hoje": o inventário é de 16/07. */
const DATA_INVENTARIO = "2026-07-16";

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente em .env.local");

  const [org] = await api("organizacao?select=id,nome&limit=1");
  const pecas = await api("equipamento_unidade?select=id,identificador,item_id");
  const funcs = await api("funcionario?select=id,nome");
  // Pessoa que já tem termo em aberto não ganha outro: o termo aberto é a
  // verdade corrente, e um segundo rascunho competiria com ele.
  const termos = await api(
    "termo_equipamento?select=funcionario_id&cancelado_em=is.null&encerrado_em=is.null",
  );

  const pecasPorId = new Map(pecas.map((p) => [p.identificador.toUpperCase(), p]));
  const funcPorNome = new Map(funcs.map((f) => [f.nome.toLowerCase(), f]));
  const comTermo = new Set(termos.map((t) => t.funcionario_id));

  const linhas = await lerPlanilha();
  const plano = montarPlano(linhas, pecasPorId, funcPorNome, comTermo);

  imprimirPlano(plano);

  if (!APLICAR) {
    console.log("Prévia apenas. Para gravar:  node scripts/db/gerar-termos-inventario.mjs --aplicar\n");
    return;
  }
  await aplicar(plano, org.id);
}

// `import.meta.main` não existe no Node 24; o teste importa só as funções puras.
if (process.argv[1]?.endsWith("gerar-termos-inventario.mjs")) {
  main().catch((e) => {
    console.error("ERRO:", e.message);
    process.exit(1);
  });
}
