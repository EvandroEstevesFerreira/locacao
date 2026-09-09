// Importa a planilha "Coleta de Locações" preenchida — os contratos de locação
// e os equipamentos de cada um.
//
// A PONTA QUE FALTAVA. `gerar-planilha-coleta.mjs` produz a planilha em branco
// e a manda para quem sabe o dado. Este script é o caminho de volta: sem ele a
// planilha preenchida vira digitação à mão na tela de contrato, uma linha por
// vez, e é onde o valor da locação erra.
//
// O QUE ELE RECUSA — E RECUSAR É O SERVIÇO.
//
// `item_locado.valor_unitario_periodo` é `not null` com DEFAULT 0. Célula de
// valor vazia não dá erro: grava a locação custando R$ 0,00, o relatório de
// custo da obra fecha certo com o número errado, e ninguém desconfia. O mesmo
// vale para retirada no futuro — significa "não entregue" para um equipamento
// que está em campo e sendo faturado. Nos dois casos, aceitar é pior que parar.
//
// A primeira planilha devolvida (contrato 1726, 5I Climatização) tinha o
// segundo caso: a retirada veio com a data de FIM do contrato nas duas linhas.
// Não é desatenção de quem preencheu — é o que acontece quando a coluna ao lado
// tem uma data e a mão desce. Essa recusa é a razão de este script existir.
//
// Uso, a partir da raiz do projeto:
//   node scripts/db/importar-coleta-locacoes.mjs "caminho/planilha.xlsx"
//   node scripts/db/importar-coleta-locacoes.mjs "caminho/planilha.xlsx" --aplicar
//
// Idempotente: contrato por (organização, número), equipamento por (contrato,
// item do catálogo, data de retirada). Rodar duas vezes não duplica.
//
// Se houver um .pdf na MESMA pasta com o número do contrato no nome, ele sobe
// para o bucket `contratos` e vira `anexo_path` — é o que o LEIA-ME da planilha
// promete a quem preenche.

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const PLANILHA = process.argv.find((a) => a.endsWith(".xlsx"));
const APLICAR = process.argv.includes("--aplicar");

if (!PLANILHA) {
  console.error(
    'Informe a planilha:  node scripts/db/importar-coleta-locacoes.mjs "Referencias/Importacao/.../Coleta de Locações.xlsx"',
  );
  process.exit(1);
}

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
  const corpo = await r.text();
  if (!r.ok) throw new Error(`${caminho} -> ${r.status} ${corpo}`);
  return corpo ? JSON.parse(corpo) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Normalização
// ═══════════════════════════════════════════════════════════════════════════

/**
 * "Hoje" no fuso de São Paulo.
 *
 * Cópia deliberada de `hojeISOSaoPaulo` (`src/lib/locacao.ts`), que não pode
 * ser importada aqui: ela usa o alias `@/lib/campos`, e script node cru não
 * resolve alias do tsconfig. A regra do AGENTS.md continua valendo — data
 * comparada com coluna `date` nunca sai de `new Date()` direto, porque o
 * servidor roda em UTC e das 21h à meia-noite em Brasília o dia sai adiantado.
 * Aqui isso decide se uma retirada é "hoje" ou "amanhã", e amanhã é recusa.
 */
function hojeISOSaoPaulo() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
const HOJE = hojeISOSaoPaulo();

const texto = (v) => {
  // Célula com fórmula ou rich text: o ExcelJS devolve objeto, não string.
  if (v != null && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return texto(v.result);
    if ("text" in v) return texto(v.text);
    if ("richText" in v) return texto(v.richText.map((p) => p.text).join(""));
  }
  return v == null ? "" : String(v).trim().replace(/\s+/g, " ");
};

/** Para casar nome de tipo e categoria: sem acento, sem hífen, sem espaço. */
const chave = (v) =>
  texto(v)
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Z0-9]/g, "");

/** Só os dígitos, para casar CNPJ com ou sem pontuação. */
const digitos = (v) => texto(v).replace(/\D/g, "");

/**
 * Data da planilha como 'yyyy-mm-dd'.
 *
 * Três retornos distintos, e a diferença importa: `null` é célula vazia,
 * `undefined` é "tem conteúdo e não é data". Tratar os dois como o mesmo faria
 * a data ilegível virar campo em branco, que em algumas colunas é permitido.
 */
function comoISO(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = texto(v);
  if (!s) return null;
  const br = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return undefined;
}

/** Número da planilha. Aceita 1234.56 e "1.234,56". Mesma convenção de retorno. */
function comoNumero(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = texto(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** Arredonda para centavo, que é a precisão de `numeric(14,2)` no banco. */
const centavos = (n) => Math.round(n * 100) / 100;

const CADENCIAS = ["diaria", "semanal", "quinzenal", "mensal"];
const SITUACOES = ["ativo", "encerrado", "cancelado"];

function comoCadencia(v) {
  const k = chave(v);
  if (!k) return null;
  return CADENCIAS.find((c) => chave(c) === k);
}

function comoBooleano(v) {
  const k = chave(v);
  if (!k) return null;
  if (["SIM", "S", "TRUE", "1"].includes(k)) return true;
  if (["NAO", "N", "FALSE", "0"].includes(k)) return false;
  return undefined;
}

/** Código da obra a partir de "691 — Racional Garoa", "691 - RACIONAL" ou "691". */
function codigoDaObra(v) {
  const m = texto(v).match(/^\s*(\d+)/);
  return m ? m[1] : texto(v);
}

// ═══════════════════════════════════════════════════════════════════════════
// Leitura
// ═══════════════════════════════════════════════════════════════════════════
const EXEMPLO = /LINHA DE EXEMPLO/i;

async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);

  const abaCt = wb.getWorksheet("CONTRATOS");
  const abaEq = wb.getWorksheet("EQUIPAMENTOS");
  if (!abaCt || !abaEq) {
    throw new Error('A planilha precisa ter as abas "CONTRATOS" e "EQUIPAMENTOS".');
  }

  const contratos = [];
  abaCt.eachRow((linha, n) => {
    if (n === 1) return;
    const c = (i) => linha.getCell(i).value;
    if (EXEMPLO.test(texto(c(11)))) return;
    if (![1, 2, 4, 5].some((i) => texto(c(i)))) return;
    contratos.push({
      linha: n,
      numero: texto(c(1)),
      fornecedor: texto(c(2)),
      cnpj: texto(c(3)),
      obra: texto(c(4)),
      inicio: comoISO(c(5)),
      fim: comoISO(c(6)),
      cadencia: comoCadencia(c(7)),
      prorata: comoBooleano(c(8)),
      situacao: texto(c(9)) ? texto(c(9)).toLowerCase() : null,
      quem: texto(c(10)),
      obs: texto(c(11)),
    });
  });

  const equipamentos = [];
  abaEq.eachRow((linha, n) => {
    if (n === 1) return;
    const c = (i) => linha.getCell(i).value;
    if (EXEMPLO.test(texto(c(13)))) return;
    if (![1, 2, 5, 6].some((i) => texto(c(i)))) return;
    equipamentos.push({
      linha: n,
      contrato: texto(c(1)),
      descricao: texto(c(2)),
      categoria: texto(c(3)),
      tipo: texto(c(4)),
      qtd: comoNumero(c(5)),
      valor: comoNumero(c(6)),
      retirada: comoISO(c(7)),
      prevista: comoISO(c(8)),
      patrimonio: texto(c(9)),
      serie: texto(c(10)),
      frente: texto(c(12)),
      obs: texto(c(13)),
    });
  });

  return { contratos, equipamentos };
}

// ═══════════════════════════════════════════════════════════════════════════
// Conferência
// ═══════════════════════════════════════════════════════════════════════════
function conferir({ contratos, equipamentos }, ref) {
  const recusas = [];
  const avisos = [];
  const recusar = (aba, linha, motivo) => recusas.push({ aba, linha, motivo });
  const avisar = (aba, linha, motivo) => avisos.push({ aba, linha, motivo });

  // ── CONTRATOS ────────────────────────────────────────────────────────────
  const porNumero = new Map();
  for (const c of contratos) {
    const onde = ["CONTRATOS", c.linha];
    if (!c.numero) recusar(...onde, "número do contrato em branco");
    else if (porNumero.has(c.numero)) {
      recusar(...onde, `número ${c.numero} repetido (já na linha ${porNumero.get(c.numero).linha})`);
    }

    const codigo = codigoDaObra(c.obra);
    c.obraRef = ref.obrasPorCodigo.get(codigo);
    if (!c.obra) recusar(...onde, "obra em branco");
    else if (!c.obraRef) recusar(...onde, `obra "${c.obra}" não existe no Loca`);
    else if (chave(c.obra) !== chave(`${codigo} ${c.obraRef.nome}`)) {
      // O código casou, o texto não. Não é erro: quem preencheu digitou o nome
      // como está no contrato, e o contrato traz o nome do projeto.
      avisar(...onde, `obra ${codigo} está no Loca como "${c.obraRef.nome}"`);
    }

    c.fornRef =
      ref.fornPorCnpj.get(digitos(c.cnpj)) ?? ref.fornPorNome.get(chave(c.fornecedor));
    if (!c.fornecedor && !c.cnpj) recusar(...onde, "fornecedor em branco");
    else if (!c.fornRef) recusar(...onde, `fornecedor "${c.fornecedor || c.cnpj}" não cadastrado`);

    if (c.inicio === undefined) recusar(...onde, "início não é uma data");
    else if (!c.inicio) recusar(...onde, "início em branco");

    if (c.fim === undefined) recusar(...onde, "fim previsto não é uma data");
    else if (c.fim && c.inicio && c.fim < c.inicio) {
      recusar(...onde, `fim previsto (${c.fim}) é antes do início (${c.inicio})`);
    }

    if (c.cadencia === undefined) {
      recusar(...onde, `cobrança fora da lista (${CADENCIAS.join(", ")})`);
    } else if (!c.cadencia) recusar(...onde, "cobrança em branco");

    if (c.prorata === undefined) recusar(...onde, 'pró-rata precisa ser "sim" ou "nao"');
    if (c.situacao && !SITUACOES.includes(c.situacao)) {
      recusar(...onde, `situação "${c.situacao}" fora da lista (${SITUACOES.join(", ")})`);
    }
    if (c.numero) porNumero.set(c.numero, c);
  }

  // ── EQUIPAMENTOS ─────────────────────────────────────────────────────────
  for (const e of equipamentos) {
    const onde = ["EQUIPAMENTOS", e.linha];
    e.contratoRef = porNumero.get(e.contrato);
    if (!e.contrato) recusar(...onde, "nº do contrato em branco");
    else if (!e.contratoRef) recusar(...onde, `contrato ${e.contrato} não está na aba CONTRATOS`);

    if (!e.descricao) recusar(...onde, "equipamento em branco");

    if (e.qtd === undefined) recusar(...onde, "quantidade não é um número");
    else if (e.qtd == null) recusar(...onde, "quantidade em branco");
    else if (e.qtd <= 0) recusar(...onde, `quantidade ${e.qtd} não é positiva`);

    // O campo que mais importa. Ver o cabeçalho deste arquivo.
    if (e.valor === undefined) recusar(...onde, "valor não é um número");
    else if (e.valor == null) {
      recusar(...onde, "VALOR EM BRANCO — entraria como locação de R$ 0,00");
    } else if (e.valor <= 0) {
      recusar(...onde, `valor ${e.valor} não é positivo — entraria como locação de graça`);
    } else if (centavos(e.valor) !== e.valor) {
      // O FORNECEDOR COBRA COM MAIS CASAS QUE O BANCO GUARDA.
      //
      // `valor_unitario_periodo` é `numeric(14,2)`. A 5I cobra o split de 12000
      // a R$ 156,667 a unidade e fatura a LINHA arredondada: 2 × 156,667 =
      // R$ 313,33. Guardando 156,67, o Loca calcula 2 × 156,67 = R$ 313,34.
      // Um centavo por linha, todo mês, para sempre — e quem conferir o
      // relatório contra a fatura vai procurar o erro no lugar errado.
      //
      // Não é motivo para recusar: o contrato é legítimo e a diferença é de
      // centavos. É motivo para dizer o número, porque a alternativa é alguém
      // descobrir a diferença sem saber de onde ela vem.
      const arredondado = centavos(e.valor);
      const deriva = centavos((e.qtd ?? 1) * arredondado) - centavos((e.qtd ?? 1) * e.valor);
      avisar(
        ...onde,
        `valor ${e.valor} grava como ${arredondado.toFixed(2)} (a coluna tem 2 casas)` +
          (deriva ? ` — a linha fica ${deriva > 0 ? "+" : ""}${deriva.toFixed(2)} vs. a fatura` : ""),
      );
    }

    if (e.retirada === undefined) recusar(...onde, "retirada não é uma data");
    else if (!e.retirada) recusar(...onde, "retirada em branco");
    else if (e.retirada > HOJE) {
      recusar(
        ...onde,
        `retirada ${e.retirada} está no FUTURO — entraria como equipamento não entregue`,
      );
    } else if (e.contratoRef?.inicio && e.retirada < e.contratoRef.inicio) {
      avisar(
        ...onde,
        `retirada ${e.retirada} é antes do início do contrato (${e.contratoRef.inicio})`,
      );
    }

    if (e.prevista === undefined) recusar(...onde, "devolução prevista não é uma data");
    else if (e.prevista && e.retirada && e.prevista < e.retirada) {
      recusar(...onde, `devolução prevista (${e.prevista}) é antes da retirada (${e.retirada})`);
    }

    // O tipo manda; a categoria é DERIVADA dele no banco (migration 0083).
    // Categoria discordante é aviso, não recusa: quem decide é o trigger.
    e.tipoRef = e.tipo ? ref.tiposPorChave.get(chave(e.tipo)) : null;
    if (e.tipo && !e.tipoRef) {
      const nomes = [...ref.tiposPorChave.values()].map((t) => t.nome).join(", ");
      recusar(...onde, `tipo "${e.tipo}" não existe — cadastrados: ${nomes}`);
    }
    if (e.tipoRef && e.categoria) {
      const cat = ref.catPorId.get(e.tipoRef.categoria_id);
      if (cat && chave(cat.nome) !== chave(e.categoria)) {
        avisar(
          ...onde,
          `categoria "${e.categoria}" entra como "${cat.nome}", derivada do tipo ${e.tipoRef.nome}`,
        );
      }
    }
    if (!e.tipo) avisar(...onde, "sem tipo — o item entra sem categoria, para classificar depois");
    if (!e.patrimonio && !e.serie) {
      avisar(...onde, `${e.qtd ?? "?"} un. sem patrimônio nem nº de série — controle por quantidade`);
    }
    if (e.frente) {
      avisar(...onde, `frente "${e.frente}" não é importada — o cadastro de frente é por obra`);
    }
  }

  return { recusas, avisos };
}

// ═══════════════════════════════════════════════════════════════════════════
// Prévia
// ═══════════════════════════════════════════════════════════════════════════
const brl = (n) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function imprimir({ contratos, equipamentos }, { recusas, avisos }, existentes) {
  console.log("═".repeat(78));
  console.log(`COLETA DE LOCAÇÕES — ${path.basename(PLANILHA)}`);
  console.log("═".repeat(78));

  for (const c of contratos) {
    const ja = existentes.get(c.numero);
    console.log(`\nCONTRATO ${c.numero}${ja ? "   (já existe no Loca — será atualizado)" : ""}`);
    console.log(`   fornecedor: ${c.fornRef?.nome ?? `?? ${c.fornecedor}`}`);
    console.log(
      `   obra:       ${c.obraRef ? `${c.obraRef.codigo} — ${c.obraRef.nome}` : `?? ${c.obra}`}`,
    );
    console.log(`   vigência:   ${c.inicio ?? "??"} → ${c.fim ?? "sem fim previsto"}`);
    console.log(
      `   cobrança:   ${c.cadencia ?? "??"}${c.prorata ? " (pró-rata)" : ""}    situação: ${c.situacao ?? "ativo"}`,
    );

    const meus = equipamentos.filter((e) => e.contrato === c.numero);
    let total = 0;
    for (const e of meus) {
      // Com o valor JÁ arredondado: a prévia tem de mostrar o que vai ser
      // gravado, não o que a planilha diz. Mostrar o total da fatura aqui e
      // gravar três centavos a mais é a prévia mentindo com a verdade.
      const sub = centavos((e.qtd ?? 0) * centavos(e.valor ?? 0));
      total += sub;
      console.log(
        `      ${String(e.qtd ?? "?").padStart(4)} × ${e.descricao.padEnd(30).slice(0, 30)} ` +
          `${brl(centavos(e.valor ?? 0)).padStart(12)} = ${brl(sub).padStart(13)}   retirada ${e.retirada ?? "??"}`,
      );
    }
    if (meus.length) console.log(`      ${" ".repeat(37)}total por período: ${brl(total)}`);
    else console.log("      (nenhum equipamento na aba EQUIPAMENTOS)");
  }

  if (avisos.length) {
    console.log(`\nAVISOS (${avisos.length}) — entram assim mesmo:`);
    for (const a of avisos) console.log(`   ${a.aba} linha ${a.linha}: ${a.motivo}`);
  }

  console.log(
    recusas.length
      ? `\nRECUSAS (${recusas.length}) — nada é gravado enquanto existir alguma:`
      : "\nRECUSAS: nenhuma.",
  );
  for (const r of recusas) console.log(`   ${r.aba} linha ${r.linha}: ${r.motivo}`);
  console.log("");
}

// ═══════════════════════════════════════════════════════════════════════════
// Gravação — idempotente
// ═══════════════════════════════════════════════════════════════════════════
async function gravar({ contratos, equipamentos }, orgId, existentes) {
  let ctCriados = 0;
  let ctAtualizados = 0;
  let itensCriados = 0;
  let locadosCriados = 0;
  let locadosPulados = 0;
  let pdfs = 0;

  const catalogo = await api(`item_catalogo?select=id,descricao&org_id=eq.${orgId}`);
  const itemPorDescricao = new Map(catalogo.map((i) => [chave(i.descricao), i.id]));

  for (const c of contratos) {
    const corpo = {
      org_id: orgId,
      obra_id: c.obraRef.id,
      fornecedor_id: c.fornRef.id,
      numero: c.numero,
      cadencia: c.cadencia,
      data_inicio: c.inicio,
      data_fim_prevista: c.fim,
      cobranca_prorata: c.prorata ?? false,
      status: c.situacao ?? "ativo",
      observacoes:
        [c.obs, c.quem ? `Coleta respondida por ${c.quem}.` : ""].filter(Boolean).join(" ") ||
        null,
    };

    let contratoId = existentes.get(c.numero)?.id;
    if (contratoId) {
      await api(`contrato_locacao?id=eq.${contratoId}`, {
        method: "PATCH",
        body: JSON.stringify(corpo),
      });
      ctAtualizados++;
    } else {
      const [criado] = await api("contrato_locacao", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(corpo),
      });
      contratoId = criado.id;
      ctCriados++;
    }

    const anexo = await subirPdf(c.numero, orgId, contratoId);
    if (anexo) {
      await api(`contrato_locacao?id=eq.${contratoId}`, {
        method: "PATCH",
        body: JSON.stringify({ anexo_path: anexo }),
      });
      pdfs++;
    }

    const jaLocados = await api(
      `item_locado?select=id,item_id,data_retirada&contrato_id=eq.${contratoId}`,
    );
    const jaTem = new Set(jaLocados.map((l) => `${l.item_id}|${l.data_retirada}`));

    for (const e of equipamentos.filter((x) => x.contrato === c.numero)) {
      let itemId = itemPorDescricao.get(chave(e.descricao));
      if (!itemId) {
        const [criado] = await api("item_catalogo", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            org_id: orgId,
            natureza: "equipamento",
            descricao: e.descricao,
            unidade: "un",
            tipo_id: e.tipoRef?.id ?? null,
            // `categoria_id` e `controle` NÃO vão aqui: o banco os deriva do
            // tipo e da natureza (migrations 0083 e 0069). Mandar o valor à mão
            // seria a segunda cópia da regra, e é assim que ela diverge.
            ativo: true,
          }),
        });
        itemPorDescricao.set(chave(e.descricao), criado.id);
        itemId = criado.id;
        itensCriados++;
      }

      if (jaTem.has(`${itemId}|${e.retirada}`)) {
        locadosPulados++;
        continue;
      }
      await api("item_locado", {
        method: "POST",
        body: JSON.stringify({
          org_id: orgId,
          contrato_id: contratoId,
          item_id: itemId,
          quantidade: e.qtd,
          valor_unitario_periodo: centavos(e.valor),
          data_retirada: e.retirada,
          data_devolucao_prevista: e.prevista,
          identificacao: [e.patrimonio, e.serie].filter(Boolean).join(" / ") || null,
          observacoes: e.obs || null,
          status: "em_aberto",
        }),
      });
      jaTem.add(`${itemId}|${e.retirada}`);
      locadosCriados++;
    }
  }

  console.log("═".repeat(78));
  console.log("GRAVADO");
  console.log("═".repeat(78));
  console.log(`   contratos criados:     ${ctCriados}`);
  console.log(`   contratos atualizados: ${ctAtualizados}`);
  console.log(`   itens do catálogo:     ${itensCriados} criados`);
  console.log(`   equipamentos locados:  ${locadosCriados} criados, ${locadosPulados} já existiam`);
  console.log(`   PDFs anexados:         ${pdfs}`);
  console.log("");
}

/**
 * Sobe o PDF do contrato para o bucket `contratos`, se houver um na pasta da
 * planilha com o número do contrato no nome.
 *
 * O LEIA-ME da planilha promete isto ("O Loca guarda o PDF do contrato anexado
 * ao registro"), e é do PDF que se confere o resto depois. Deixar o arquivo
 * para trás na importação transformaria a promessa em mentira.
 */
async function subirPdf(numero, orgId, contratoId) {
  const pasta = path.dirname(path.resolve(PLANILHA));
  const arquivo = fs
    .readdirSync(pasta)
    .find((f) => f.toLowerCase().endsWith(".pdf") && f.includes(numero));
  if (!arquivo) return null;

  // Acento vira a letra sem acento, e nao underscore: o nome do arquivo
  // aparece na tela do contrato, e "Locacao" se le melhor que "Loca__o".
  const limpo = arquivo
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\w.\- ]/g, "_")
    .replace(/\s+/g, " ");
  const destino = `${orgId}/${contratoId}/${limpo}`;
  const r = await fetch(
    `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/contratos/${encodeURI(destino)}`,
    {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/pdf",
        "x-upsert": "true",
      },
      body: fs.readFileSync(path.join(pasta, arquivo)),
    },
  );
  if (!r.ok) throw new Error(`upload do PDF -> ${r.status} ${await r.text()}`);
  return destino;
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente em .env.local");

  const [org] = await api("organizacao?select=id,nome&limit=1");
  const obras = await api(`obra?select=id,codigo,nome&org_id=eq.${org.id}`);
  const fornecedores = await api(`fornecedor?select=id,nome,cnpj&org_id=eq.${org.id}`);
  const tipos = await api(`tipo_equipamento?select=id,nome,categoria_id&org_id=eq.${org.id}`);
  const categorias = await api(`categoria_equipamento?select=id,nome&org_id=eq.${org.id}`);

  const ref = {
    obrasPorCodigo: new Map(obras.map((o) => [o.codigo, o])),
    fornPorCnpj: new Map(fornecedores.filter((f) => f.cnpj).map((f) => [digitos(f.cnpj), f])),
    fornPorNome: new Map(fornecedores.map((f) => [chave(f.nome), f])),
    tiposPorChave: new Map(tipos.map((t) => [chave(t.nome), t])),
    catPorId: new Map(categorias.map((c) => [c.id, c])),
  };

  const dados = await lerPlanilha();
  const problemas = conferir(dados, ref);

  const numeros = dados.contratos.map((c) => c.numero).filter(Boolean);
  const jaNoLoca = numeros.length
    ? await api(
        `contrato_locacao?select=id,numero&org_id=eq.${org.id}&numero=in.(${numeros
          .map((n) => `"${n}"`)
          .join(",")})`,
      )
    : [];
  const existentes = new Map(jaNoLoca.map((c) => [c.numero, c]));

  imprimir(dados, problemas, existentes);

  if (problemas.recusas.length) {
    console.log("Corrija a planilha e rode de novo. Nada foi gravado.\n");
    process.exit(1);
  }
  if (!APLICAR) {
    console.log("Prévia apenas. Para gravar, repita o comando com  --aplicar\n");
    return;
  }
  await gravar(dados, org.id, existentes);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
