// Importa o inventário de TI (planilha "Máquinas") para o cadastro de frota.
//
// DOIS NÍVEIS, como o resto do sistema: o MODELO vira `item_catalogo` ("o quê")
// e cada MÁQUINA vira `equipamento_unidade` ("qual"). Sem o segundo nível o
// sistema saberia que existem 20 Latitude 3410 e continuaria sem saber qual
// está com quem — que é exatamente o que a planilha já não responde.
//
// Uso (PowerShell ou Git Bash), a partir da raiz do projeto:
//   node scripts/db/importar-inventario-ti.mjs                  # prévia, não grava
//   node scripts/db/importar-inventario-ti.mjs --aplicar        # grava
//
// A chave service_role é lida de .env.local e NUNCA impressa. O script é
// idempotente: rodar de novo não duplica nada — item por descrição, peça por
// identificador, funcionário por nome, custódia por posse aberta.

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
  const texto = await r.text();
  if (!r.ok) throw new Error(`${caminho} -> ${r.status} ${texto}`);
  return texto ? JSON.parse(texto) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Normalização
// ═══════════════════════════════════════════════════════════════════════════

/** Correções de grafia confirmadas. Chave em minúsculas, sem espaço duplicado. */
const MODELO_CANONICO = {
  "accer - travelmate p214-55": "TravelMate P214-55",
  "acer travelmate p214-55": "TravelMate P214-55",
  "travelmate p214-55": "TravelMate P214-55",
  "optplex 7070": "OptiPlex 7070",
  thinkcenter: "ThinkCentre",
  "vostro 3510": "Vostro 15 3510",
  "s145-type 81s9": "IdeaPad S145",
  // Não existem no catálogo da Dell; confirmado com o Evandro em 03/09/2026 que
  // são erro de digitação, uma máquina cada.
  "latitude 3411": "Latitude 3410",
  "latitude 3441": "Latitude 3440",
};

/** Modelos que entram como estão, mas com ressalva registrada na prévia. */
const MODELOS_DUVIDOSOS = {
  thinkbook: "modelo incompleto — ThinkBook tem número (14, 15, G2…)",
};

const MARCA_POR_FAMILIA = [
  [/latitude|optiplex|optplex|vostro|precision|poweredge/i, "Dell"],
  [/travelmate|aspire/i, "Acer"],
  [/think(book|centre|center|station|pad)|ideapad|s145/i, "Lenovo"],
];

const TIPO_POR_FAMILIA = [
  [/poweredge/i, "Servidor"],
  [/optiplex|optplex|thinkcentre|thinkcenter|thinkstation/i, "Desktop"],
  [/latitude|vostro|travelmate|thinkbook|precision|s145|ideapad/i, "Notebook"],
];

const texto = (v) => {
  if (v && typeof v === "object") {
    v = v.text ?? v.result ?? (v instanceof Date ? v.toISOString().slice(0, 10) : "");
  }
  return v === null || v === undefined ? "" : String(v).replace(/\s+/g, " ").trim();
};

function modeloNormalizado(bruto) {
  const chave = bruto.toLowerCase().replace(/\s+/g, " ").trim();
  return MODELO_CANONICO[chave] ?? bruto.replace(/\s+/g, " ").trim();
}

function marcaDe(modelo) {
  for (const [re, marca] of MARCA_POR_FAMILIA) if (re.test(modelo)) return marca;
  return "Outra";
}

/** Deriva o tipo do MODELO, não da coluna: duas linhas declaram OptiPlex como notebook. */
function tipoDe(modelo) {
  for (const [re, tipo] of TIPO_POR_FAMILIA) if (re.test(modelo)) return tipo;
  return "Equipamento";
}

/**
 * A coluna USUÁRIOS mistura pessoa com estado da máquina. Tudo abaixo é
 * estado, não gente — sem esta lista o cadastro nasce com um funcionário
 * chamado "Disponivel" e outro chamado "Rack".
 */
const NAO_E_PESSOA =
  /^(livre|dispon[ií]vel|devolvida|reserva|obra|or[çc]amentos?|almoxarifado|rack|servidor|paseli|n[aã]o possui)\b/i;

/** Máquina devolvida ao locador saiu da frota — não é peça disponível. */
const DEVOLVIDA_AO_LOCADOR = /^devolvida/i;

/** `andrea.marques`, `JOÃO.UBIRAJARA` e `Andrea Marques` são a mesma forma. */
function pessoaNormalizada(bruto) {
  const t = bruto.replace(/\s+/g, " ").trim();
  if (!t) return null;
  if (NAO_E_PESSOA.test(t)) return null;
  return t
    .replace(/\s*\(new\)\s*$/i, "") // marcação de máquina nova, não faz parte do nome
    .replace(/\s+atual\s*$/i, "")     // "Jessica Matos atual": anotação, não sobrenome
    .replace(/[._]+/g, " ")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((p) => (p.length <= 2 ? p : p[0].toUpperCase() + p.slice(1)))
    .join(" ");
}

/** Chave de licença do Windows na coluna TAG não é patrimônio. */
const ehChaveWindows = (tag) => /^\d{5}-\d{5}-\d{5}-[A-Z]{5}$/i.test(tag);

/** `Obra - 605 - Fator Tawer`, `608 - Dante` -> `605`, `608`. */
function codigoObra(departamento) {
  const m = /\b(\d{3})\b/.exec(departamento);
  return m ? m[1] : null;
}

function situacaoDe(status, usuarioBruto, pessoa) {
  if (DEVOLVIDA_AO_LOCADOR.test(usuarioBruto)) return "baixada";
  const s = status.toLowerCase();
  if (/reserva|livre/.test(s)) return "disponivel";
  return pessoa ? "em_uso" : "disponivel";
}

// ═══════════════════════════════════════════════════════════════════════════
// Leitura e montagem do plano
// ═══════════════════════════════════════════════════════════════════════════
async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);
  const aba = wb.getWorksheet(ABA);
  if (!aba) throw new Error(`Aba "${ABA}" não encontrada em ${PLANILHA}`);

  const cabecalho = [];
  for (let c = 1; c <= aba.columnCount; c++) cabecalho.push(texto(aba.getRow(1).getCell(c).value));

  const linhas = [];
  for (let r = 2; r <= aba.rowCount; r++) {
    const o = { _linha: r };
    let vazia = true;
    for (let c = 1; c <= aba.columnCount; c++) {
      const v = texto(aba.getRow(r).getCell(c).value);
      o[cabecalho[c - 1]] = v;
      if (v) vazia = false;
    }
    if (!vazia) linhas.push(o);
  }
  return linhas;
}

function montarPlano(linhas) {
  const avisos = [];
  const maquinas = new Map(); // identificador -> máquina
  let semTagSeq = 0;

  for (const l of linhas) {
    const modeloBruto = l["MODELO EQUIPAMENTO"] ?? "";
    if (!modeloBruto) {
      avisos.push({ tipo: "sem_modelo", linha: l._linha, detalhe: "linha sem modelo — ignorada" });
      continue;
    }

    const modelo = modeloNormalizado(modeloBruto);
    const marca = marcaDe(modelo);
    const tipo = tipoDe(modelo);
    const tipoDeclarado = (l["TIPO DO DISPOSITIVO"] ?? "").trim();
    if (tipoDeclarado && tipoDeclarado.toLowerCase() !== tipo.toLowerCase()) {
      avisos.push({
        tipo: "tipo_divergente",
        linha: l._linha,
        detalhe: `planilha diz "${tipoDeclarado}", o modelo ${modelo} é ${tipo}`,
      });
    }
    if (MODELOS_DUVIDOSOS[modeloBruto.toLowerCase()]) {
      avisos.push({
        tipo: "modelo_duvidoso",
        linha: l._linha,
        detalhe: `${modeloBruto} — ${MODELOS_DUVIDOSOS[modeloBruto.toLowerCase()]}`,
      });
    }

    const tag = (l["TAG"] ?? "").toUpperCase().trim();
    const nomeDispositivo = (l["NOME DO DISPOSITIVO"] ?? "").trim();
    let identificador = tag;
    let provisorio = false;
    if (!tag || ehChaveWindows(tag)) {
      // Decisão do Evandro em 03/09/2026: entram com patrimônio provisório em
      // vez de ficarem de fora. O prefixo SEM-TAG é deliberadamente feio para
      // que salte aos olhos em qualquer listagem até alguém ler a etiqueta.
      provisorio = true;
      identificador = `SEM-TAG-${String(++semTagSeq).padStart(3, "0")}`;
      avisos.push({
        tipo: "patrimonio_provisorio",
        linha: l._linha,
        detalhe: tag
          ? `TAG "${tag}" é chave de licença do Windows — entra como ${identificador}`
          : `sem TAG — entra como ${identificador}`,
      });
    }

    const usuarioBruto = (l["USUÁRIOS"] ?? "").trim();
    const pessoa = pessoaNormalizada(usuarioBruto);
    const departamento = (l["DEPARTAMENTO"] ?? "").trim();

    // "LIVRE - COM ISABEL", "Livre - Eduardo Uda": marcada como livre e ao mesmo
    // tempo citando alguém. Não dá para decidir sozinho se está com a pessoa ou
    // se ela só a devolveu — entra como livre e fica registrado.
    if (/^livre\b/i.test(usuarioBruto) && /[a-zà-ú]{3,}/i.test(usuarioBruto.replace(/^livre\s*-?\s*/i, ""))) {
      avisos.push({
        tipo: "livre_com_nome",
        linha: l._linha,
        detalhe: `"${usuarioBruto}" — importada como livre, sem posse aberta`,
      });
    }
    if (DEVOLVIDA_AO_LOCADOR.test(usuarioBruto)) {
      avisos.push({
        tipo: "devolvida_ao_locador",
        linha: l._linha,
        detalhe: `"${usuarioBruto}" — entra como baixada, fora da frota ativa`,
      });
    }
    const maquina = {
      linha: l._linha,
      identificador,
      nomeDispositivo: nomeDispositivo && nomeDispositivo !== "?" ? nomeDispositivo : null,
      modelo,
      marca,
      tipo,
      descricaoItem: `${tipo} ${marca} ${modelo}`,
      propriedade: /alugad/i.test(nomeDispositivo) ? "locada" : "propria",
      situacao: situacaoDe(l["STATUS"] ?? "", usuarioBruto, pessoa),
      codigoObra: codigoObra(departamento),
      departamento,
      pessoa,
      observacoes: [
        provisorio
          ? "PATRIMÔNIO PROVISÓRIO — ler a etiqueta da máquina e corrigir o identificador."
          : null,
        nomeDispositivo && nomeDispositivo !== "?" ? `Nome: ${nomeDispositivo}` : null,
        pessoa ? `Com: ${pessoa} (conforme planilha de 16/07/2026)` : null,
        departamento ? `Departamento: ${departamento}` : null,
        l["SISTEMA OPERACIONAL"] ? `SO: ${l["SISTEMA OPERACIONAL"]}` : null,
        l["PROCESSADOR"] ? `Processador: ${l["PROCESSADOR"]}` : null,
        l["MEMORIA RAM TOTAL"] ? `RAM: ${l["MEMORIA RAM TOTAL"]}` : null,
        l["ARMAZENAMENTO"] ? `Armazenamento: ${l["ARMAZENAMENTO"]}` : null,
        l["OBSERVAÇÃO"] || null,
        l["OBSERVAÇÃO DO DISPOSITIVO"] ? `Garantia: ${l["OBSERVAÇÃO DO DISPOSITIVO"]}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };

    // Mesma TAG duas vezes = mesma máquina relançada porque trocou de mão. A
    // linha MAIS RECENTE (número maior) tem o dono atual; a anterior vira
    // histórico na observação.
    const anterior = maquinas.get(identificador);
    if (anterior) {
      avisos.push({
        tipo: "tag_duplicada",
        linha: l._linha,
        detalhe: `${identificador} já apareceu na linha ${anterior.linha} (${anterior.pessoa ?? "sem usuário"}) — vale a mais recente: ${maquina.pessoa ?? "sem usuário"}`,
      });
      maquina.observacoes = `${maquina.observacoes} · Antes com: ${anterior.pessoa ?? "—"}`;
    }
    maquinas.set(identificador, maquina);
  }

  const itens = new Map();
  for (const m of maquinas.values()) {
    if (!itens.has(m.descricaoItem)) {
      itens.set(m.descricaoItem, { descricao: m.descricaoItem, marca: m.marca, modelo: m.modelo, tipo: m.tipo, pecas: 0 });
    }
    itens.get(m.descricaoItem).pecas += 1;
  }

  const pessoas = new Map();
  for (const m of maquinas.values()) {
    if (m.pessoa) pessoas.set(m.pessoa, (pessoas.get(m.pessoa) ?? 0) + 1);
  }

  return { maquinas: [...maquinas.values()], itens: [...itens.values()], pessoas, avisos };
}

// ═══════════════════════════════════════════════════════════════════════════
// Prévia
// ═══════════════════════════════════════════════════════════════════════════
function imprimirPlano(plano, obrasPorCodigo) {
  const { maquinas, itens, pessoas, avisos } = plano;

  console.log("═".repeat(76));
  console.log(`PRÉVIA — ${APLICAR ? "VAI GRAVAR" : "nada será gravado"}`);
  console.log("═".repeat(76));

  const porTipo = new Map();
  for (const m of maquinas) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);

  console.log(`\nMÁQUINAS: ${maquinas.length}`);
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)} ${t}`);
  const locadas = maquinas.filter((m) => m.propriedade === "locada").length;
  console.log(`   ${String(locadas).padStart(4)} alugadas (${Math.round((locadas / maquinas.length) * 100)}% do parque)`);

  console.log(`\nMODELOS NO CATÁLOGO: ${itens.length}`);
  for (const i of [...itens].sort((a, b) => b.pecas - a.pecas)) {
    console.log(`   ${String(i.pecas).padStart(4)}  ${i.descricao}`);
  }

  console.log(`\nFUNCIONÁRIOS: ${pessoas.size}`);
  const comMais = [...pessoas].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  if (comMais.length) {
    console.log("   com mais de uma máquina:");
    for (const [p, n] of comMais) console.log(`      ${n}  ${p}`);
  }

  console.log("\nOBRAS:");
  const porObra = new Map();
  for (const m of maquinas) porObra.set(m.codigoObra ?? "(sede/sem obra)", (porObra.get(m.codigoObra ?? "(sede/sem obra)") ?? 0) + 1);
  for (const [c, n] of [...porObra].sort((a, b) => b[1] - a[1])) {
    const nome = obrasPorCodigo?.get(c)?.nome;
    const marca = c === "(sede/sem obra)" ? "" : nome ? ` — ${nome}` : "  ⚠ código não existe no Loca";
    console.log(`   ${String(n).padStart(4)} ${c}${marca}`);
  }

  const porAviso = new Map();
  for (const a of avisos) porAviso.set(a.tipo, [...(porAviso.get(a.tipo) ?? []), a]);
  console.log(`\nPENDÊNCIAS: ${avisos.length}`);
  for (const [tipo, lista] of porAviso) {
    console.log(`\n   ${tipo.toUpperCase()} (${lista.length})`);
    for (const a of lista) console.log(`      linha ${a.linha}: ${a.detalhe}`);
  }
  console.log("");
}

// ═══════════════════════════════════════════════════════════════════════════
// Gravação — idempotente
// ═══════════════════════════════════════════════════════════════════════════
async function aplicar(plano, orgId, categoriaTI, obrasPorCodigo) {
  const { maquinas, itens } = plano;

  // --- itens do catálogo, por descrição -----------------------------------
  const existentes = await api(`item_catalogo?select=id,descricao&org_id=eq.${orgId}`);
  const itemPorDescricao = new Map(existentes.map((i) => [i.descricao.toLowerCase(), i.id]));

  let itensCriados = 0;
  for (const i of itens) {
    if (itemPorDescricao.has(i.descricao.toLowerCase())) continue;
    const [criado] = await api("item_catalogo", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId,
        tipo: "equipamento",
        descricao: i.descricao,
        unidade: "un",
        controle: "peca",
        categoria_id: categoriaTI,
        ativo: true,
      }),
    });
    itemPorDescricao.set(i.descricao.toLowerCase(), criado.id);
    itensCriados++;
  }

  // --- funcionários, por nome ---------------------------------------------
  const funcExistentes = await api(`funcionario?select=id,nome&org_id=eq.${orgId}`);
  const funcPorNome = new Map(funcExistentes.map((f) => [f.nome.toLowerCase(), f.id]));

  let funcCriados = 0;
  for (const nome of plano.pessoas.keys()) {
    if (funcPorNome.has(nome.toLowerCase())) continue;
    const [criado] = await api("funcionario", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ org_id: orgId, nome, ativo: true }),
    });
    funcPorNome.set(nome.toLowerCase(), criado.id);
    funcCriados++;
  }

  // --- peças, por identificador -------------------------------------------
  const pecasExistentes = await api(`equipamento_unidade?select=id,identificador&org_id=eq.${orgId}`);
  const pecaPorId = new Map(pecasExistentes.map((p) => [p.identificador.toUpperCase(), p.id]));

  let pecasCriadas = 0;
  let pecasAtualizadas = 0;
  for (const m of maquinas) {
    const itemId = itemPorDescricao.get(m.descricaoItem.toLowerCase());
    const obraId = m.codigoObra ? (obrasPorCodigo.get(m.codigoObra)?.id ?? null) : null;
    const corpo = {
      org_id: orgId,
      item_id: itemId,
      identificador: m.identificador,
      propriedade: m.propriedade,
      situacao: m.situacao,
      obra_id: obraId,
      numero_serie: m.identificador,
      observacoes: m.observacoes.slice(0, 2000),
      ativo: true,
    };
    const jaTem = pecaPorId.get(m.identificador.toUpperCase());
    if (jaTem) {
      await api(`equipamento_unidade?id=eq.${jaTem}`, {
        method: "PATCH",
        body: JSON.stringify(corpo),
      });
      pecasAtualizadas++;
    } else {
      const [criada] = await api("equipamento_unidade", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(corpo),
      });
      pecaPorId.set(m.identificador.toUpperCase(), criada.id);
      pecasCriadas++;
    }
  }

  // --- custódia: NÃO se cria por importação --------------------------------
  // `custodia_funcionario_exige_termo` (migration 0059) diz que posse de
  // funcionário só nasce de termo assinado, e a regra está certa: o valor do
  // termo é ser a única fonte de verdade sobre quem respondeu pelo equipamento.
  // Uma planilha de 16/07 não é isso. O nome do detentor fica registrado na
  // observação da peça, e a posse de verdade nasce quando o termo for assinado.
  const comDetentor = maquinas.filter((m) => m.pessoa).length;

  console.log("═".repeat(76));
  console.log("GRAVADO");
  console.log("═".repeat(76));
  console.log(`   itens do catálogo criados: ${itensCriados}`);
  console.log(`   funcionários criados:      ${funcCriados}`);
  console.log(`   peças criadas:             ${pecasCriadas}`);
  console.log(`   peças atualizadas:         ${pecasAtualizadas}`);
  console.log(`   peças com detentor anotado: ${comDetentor} (posse só nasce por termo assinado)`);
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente em .env.local");

  const [org] = await api("organizacao?select=id,nome&limit=1");
  const categorias = await api("categoria_equipamento?select=id,nome");
  const categoriaTI = categorias.find((c) => c.nome === "TI")?.id ?? null;
  const obras = await api("obra?select=id,codigo,nome");
  const obrasPorCodigo = new Map(obras.map((o) => [o.codigo, o]));

  const linhas = await lerPlanilha();
  const plano = montarPlano(linhas);

  imprimirPlano(plano, obrasPorCodigo);

  if (!APLICAR) {
    console.log("Prévia apenas. Para gravar:  node scripts/db/importar-inventario-ti.mjs --aplicar\n");
    return;
  }
  if (!categoriaTI) throw new Error('Categoria "TI" não encontrada — rode a migration 0055.');
  await aplicar(plano, org.id, categoriaTI, obrasPorCodigo);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
