// Importa o inventário de TI (aba "ATIVAS." de "Máquinas Sistenge.xlsx") para
// o cadastro de itens.
//
// Spec: docs/superpowers/specs/2026-09-05-inventario-ti-design.md (fase B)
//
// QUATRO NÍVEIS, como o resto do catálogo desde a 0.65.0:
//
//   Categoria TI  →  Tipo NOTEBOOK/DESKTOP/SERVIDOR  →  Item "Latitude 3410"
//                                                          →  Peça 4L1KL22
//
// Sem o último nível o sistema saberia que existem 16 Latitude 3410 e
// continuaria sem saber qual está com quem — que é exatamente o que a planilha
// já não responde.
//
// Uso (PowerShell ou Git Bash), a partir da raiz do projeto:
//   node scripts/db/importar-inventario-ti.mjs                  # prévia, não grava
//   node scripts/db/importar-inventario-ti.mjs --aplicar        # grava
//
// A chave service_role é lida de .env.local e NUNCA impressa. O script é
// idempotente: item por descrição, peça por identificador, funcionário por
// nome, frente por (obra, nome).

import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

// A MESMA regra da tela. `email-corporativo.ts` não importa nada, e o Node 24
// remove os tipos na importação — é o que permite haver uma implementação em
// vez de duas. Duas cópias de uma regra de e-mail divergiriam do jeito mais
// caro possível: o termo de uma pessoa indo para a caixa de outra.
const { emailDerivado } = await import("../../src/lib/email-corporativo.ts");

const PLANILHA =
  process.argv.find((a) => a.endsWith(".xlsx")) ??
  "C:/Projetos_Sistenge/Loca/Referencias/Importacao/Máquinas Sistenge.xlsx";
// O ponto final faz parte do nome da aba. Não é engano de digitação daqui.
const ABA = "ATIVAS.";
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
// Normalização — o que a planilha tem e o cadastro não pode herdar
// ═══════════════════════════════════════════════════════════════════════════

/** 33 grafias para 27 modelos reais. Chave em minúsculas, sem espaço duplo. */
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

/**
 * O tipo vem do MODELO, nunca da coluna `TIPO DO DISPOSITIVO`: duas linhas
 * declaram um OptiPlex como notebook, e um OptiPlex é desktop.
 */
const TIPO_POR_FAMILIA = [
  [/poweredge/i, "SERVIDOR"],
  [/optiplex|optplex|thinkcentre|thinkcenter|thinkstation/i, "DESKTOP"],
  [/latitude|vostro|travelmate|thinkbook|precision|s145|ideapad/i, "NOTEBOOK"],
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

function tipoDe(modelo) {
  for (const [re, tipo] of TIPO_POR_FAMILIA) if (re.test(modelo)) return tipo;
  return null;
}

/**
 * A coluna USUÁRIOS mistura pessoa com ESTADO DA MÁQUINA e com LUGAR. Tudo
 * abaixo é estado ou lugar, não gente — sem esta lista o cadastro nasce com um
 * funcionário chamado "Rack" e outro chamado "LIVRE - DATA CENTER".
 */
const NAO_E_PESSOA =
  /^(livre|dispon[ií]vel|devolvida|reserva|obra|or[çc]amentos?|almoxarifado|rack|servidor|paseli|monitor|obsoleta|time\b|n[aã]o possui)\b/i;

function pessoaNormalizada(bruto) {
  const t = bruto.replace(/\s+/g, " ").trim();
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

/**
 * Chave de comparação de nome: sem acento, minúscula, espaço colapsado.
 *
 * O cadastro já tinha "Joao Lirio" — sem acento — vindo da importação de julho.
 * Comparar por `nome.toLowerCase()` fez "João Lirio" entrar como PESSOA NOVA:
 * duas fichas para o mesmo funcionário, e um termo de responsabilidade podendo
 * sair no registro errado.
 *
 * Isto resolve ACENTO, e só. "Cleide Miriam" e "Cleide Mirian" continuam sendo
 * dois registros, e devem continuar: decidir que são a mesma pessoa é juízo
 * humano, não normalização.
 */
const chaveNome = (n) =>
  n
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Chave de licença do Windows na coluna TAG não é patrimônio. */
const ehChaveWindows = (tag) => /^\d{5}-\d{5}-\d{5}-[A-Z]{5}$/i.test(tag);

// ═══════════════════════════════════════════════════════════════════════════
// Departamento → obra e frente
// ═══════════════════════════════════════════════════════════════════════════
//
// Três destinos, e a diferença entre os dois últimos é deliberada:
//
//   obra          o departamento diz um lugar que o Loca conhece
//   sem obra      RESERVA e N/A estão CORRETAMENTE sem obra: a máquina está na
//                 prateleira, não em lugar nenhum
//   pendência     o valor DEVERIA dizer um lugar e não diz ("OBRA", "PASELI")
//
// Misturar os dois últimos esconderia as pendências dentro de um monte de
// máquinas que estão certas.

/** Departamentos administrativos → obra 800, cada um como frente de serviço. */
const FRENTE_ADMINISTRATIVA = {
  RH: "RH",
  DIRETORIA: "Diretoria",
  FINANCEIRO: "Financeiro",
  SUPRIMENTOS: "Suprimentos",
  ENGENHARIA: "Engenharia",
  "ORÇAMENTOS": "Orçamentos",
  PROJETOS: "Projetos",
  SMS: "SMS",
  COMERCIAL: "Comercial",
  PLANEJAMENTO: "Planejamento",
  DEPOSITO: "Depósito",
  "DEPOSITO - NOVA MÁQUINA": "Depósito",
};

/** Corretamente sem obra: é estoque, não é lugar. */
const SEM_OBRA = /^(reserva|n\/a)$/i;

/** Diz que é um lugar e não diz qual. Vira pendência. */
const LUGAR_INDEFINIDO = /^(obra|paseli|entregue com usu[áa]rio comum)$/i;

/**
 * ELEA (685) não existe no cadastro de obras. Decisão do Evandro em 05/09/2026:
 * suas máquinas vão para a 659 — Unimed Contagem.
 */
const CODIGO_REMAPEADO = { 685: "659" };

function destinoDe(departamento) {
  const d = departamento.trim();
  if (!d) return { tipo: "sem_obra", motivo: "departamento em branco" };
  if (SEM_OBRA.test(d)) return { tipo: "sem_obra", motivo: d };
  if (LUGAR_INDEFINIDO.test(d)) return { tipo: "pendencia", motivo: d };

  const frente = FRENTE_ADMINISTRATIVA[d.toUpperCase()];
  if (frente) return { tipo: "administrativo", codigo: "800", frente };

  const m = /\b(\d{3})\b/.exec(d);
  if (!m) return { tipo: "pendencia", motivo: d };
  const codigo = CODIGO_REMAPEADO[m[1]] ?? m[1];
  return { tipo: "obra", codigo, remapeado: codigo !== m[1] ? m[1] : null };
}

// ═══════════════════════════════════════════════════════════════════════════
// A ficha e as colunas nativas
// ═══════════════════════════════════════════════════════════════════════════

const SO_CANONICO = [
  [/windows 11/i, "Windows 11 Pro"],
  [/windows server 2019/i, "Windows Server 2019 Standard"],
  [/windows 10 home/i, "Windows 10 Home Single Language"],
  [/windows 10/i, "Windows 10 Pro"],
  [/windows 7/i, "Windows 7 Professional"],
];

function sistemaOperacional(bruto) {
  if (!bruto || bruto === "-") return null;
  for (const [re, nome] of SO_CANONICO) if (re.test(bruto)) return nome;
  return "Outro";
}

const DISCO_CANONICO = [
  [/nvme|m\.\d/i, "NVMe"],
  [/s[sd]d/i, "SSD"],
  [/r[ií]gido|hdd/i, "Rígido"],
];

function tipoDisco(bruto) {
  if (!bruto || bruto === "-") return null;
  for (const [re, nome] of DISCO_CANONICO) if (re.test(bruto)) return nome;
  // "8 GB" e "7,922 GB" nesta coluna são MEMÓRIA: a linha escorregou uma casa.
  return null;
}

/** `MODELO HD` com valor em GB é a marca de que a linha escorregou. */
const ehMedida = (v) => /\d+([.,]\d+)?\s*(gb|tb|mb)\b/i.test(v);

/**
 * "7,956 GB" → 8. A vírgula é decimal; o Windows reporta a memória utilizável,
 * sempre um pouco menor que a instalada.
 *
 * `null` quando o valor não é uma medida — a coluna contém datas em algumas
 * linhas, que é a mesma linha escorregada.
 */
function memoriaGb(bruto) {
  if (!bruto) return null;
  const m = /^(\d+(?:[.,]\d+)?)\s*(gb|tb)?$/i.exec(bruto.trim());
  if (!m) return null;
  let n = Number(m[1].replace(",", "."));
  if (/^tb$/i.test(m[2] ?? "")) n *= 1024;
  const arredondado = Math.round(n);
  return arredondado >= 1 && arredondado <= 1024 ? arredondado : null;
}

/**
 * A coluna DATA DE GARANTIA mistura data ISO, `dd/mm/aaaa`, serial do Excel,
 * "Alugada", "Expirada 20 DEZ 2016" e ao menos um ano impossível (`28/11/20217`).
 *
 * Só a data legível entra na ficha. O resto vai para a observação, onde não
 * finge ser um campo de data.
 */
function garantiaAte(bruto) {
  if (!bruto) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(bruto);
  if (iso) return bruto;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(bruto);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Leitura e montagem do plano
// ═══════════════════════════════════════════════════════════════════════════
async function lerPlanilha() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(PLANILHA);
  const aba = wb.getWorksheet(ABA);
  if (!aba) {
    throw new Error(
      `Aba "${ABA}" não encontrada. Abas: ${wb.worksheets.map((w) => w.name).join(", ")}`,
    );
  }

  // A aba declara 16384 colunas; só as 17 primeiras têm cabeçalho.
  const cabecalho = [];
  for (let c = 1; c <= 17; c++) cabecalho.push(texto(aba.getRow(1).getCell(c).value));

  const linhas = [];
  for (let r = 2; r <= aba.rowCount; r++) {
    const o = { _linha: r };
    let vazia = true;
    for (let c = 1; c <= 17; c++) {
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
  const maquinas = new Map();
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
    if (!tipo) {
      avisos.push({
        tipo: "tipo_desconhecido",
        linha: l._linha,
        detalhe: `"${modelo}" não casa com NOTEBOOK, DESKTOP nem SERVIDOR — linha ignorada`,
      });
      continue;
    }

    const tipoDeclarado = (l["TIPO DO DISPOSITIVO"] ?? "").trim();
    if (tipoDeclarado && tipoDeclarado.toUpperCase() !== tipo) {
      avisos.push({
        tipo: "tipo_divergente",
        linha: l._linha,
        detalhe: `planilha diz "${tipoDeclarado}", o modelo ${modelo} é ${tipo} — vale o modelo`,
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
      // Entram com patrimônio provisório em vez de ficarem de fora. O prefixo
      // SEM-TAG é deliberadamente feio para saltar aos olhos em qualquer
      // listagem até alguém ler a etiqueta.
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

    // --- linha escorregada -------------------------------------------------
    const ramBruta = l["MEMORIA RAM TOTAL"] ?? "";
    const hdBruto = l["MODELO HD"] ?? "";
    const memoria = memoriaGb(ramBruta);
    const escorregou = (ramBruta && memoria === null) || (hdBruto && ehMedida(hdBruto));
    if (escorregou) {
      avisos.push({
        tipo: "coluna_deslocada",
        linha: l._linha,
        detalhe: `RAM="${ramBruta}" HD="${hdBruto}" — a máquina entra, os campos suspeitos ficam vazios`,
      });
    }

    const usuarioBruto = (l["USUÁRIOS"] ?? "").trim();
    const pessoa = pessoaNormalizada(usuarioBruto);
    const departamento = (l["DEPARTAMENTO"] ?? "").trim();
    const destino = destinoDe(departamento);
    if (destino.tipo === "pendencia") {
      avisos.push({
        tipo: "lugar_indefinido",
        linha: l._linha,
        detalhe: `DEPARTAMENTO="${destino.motivo}" diz que é um lugar mas não diz qual — entra sem obra`,
      });
    }
    if (destino.remapeado) {
      avisos.push({
        tipo: "obra_remapeada",
        linha: l._linha,
        detalhe: `obra ${destino.remapeado} (ELEA) não existe no Loca — vai para a ${destino.codigo}`,
      });
    }

    if (/^livre\b/i.test(usuarioBruto) && /[a-zà-ú]{3,}/i.test(usuarioBruto.replace(/^livre\s*-?\s*/i, ""))) {
      avisos.push({
        tipo: "livre_com_nome",
        linha: l._linha,
        detalhe: `"${usuarioBruto}" — importada como livre, sem posse aberta`,
      });
    }

    // --- situação ----------------------------------------------------------
    // Só a aba ATIVAS., então só quatro valores. `baixada` e `perdida` não
    // aparecem: as máquinas que os justificariam estão nas abas que ficaram
    // de fora.
    const status = (l["STATUS"] ?? "").toLowerCase();
    const situacao = /reserva|livre|não possui|nao possui/.test(status)
      ? "disponivel"
      : pessoa
        ? "em_uso"
        : "disponivel";

    const ficha = {};
    if (nomeDispositivo && nomeDispositivo !== "?" && nomeDispositivo !== "SEM NOME") {
      ficha.nome_dispositivo = nomeDispositivo;
    }
    const so = sistemaOperacional(l["SISTEMA OPERACIONAL"] ?? "");
    if (so) ficha.sistema_operacional = so;
    if (l["PROCESSADOR"] && l["PROCESSADOR"] !== "-") ficha.processador = l["PROCESSADOR"];
    if (l["ARMAZENAMENTO"] && l["ARMAZENAMENTO"] !== "-" && !escorregou) {
      ficha.armazenamento = l["ARMAZENAMENTO"];
    }
    const disco = tipoDisco(hdBruto);
    if (disco) ficha.tipo_disco = disco;
    const garantia = garantiaAte(l["DATA DE GARANTIA"] ?? "");
    if (garantia) ficha.garantia_ate = garantia;

    const alugada = /ALUGADA/i.test(nomeDispositivo);
    const maquina = {
      linha: l._linha,
      identificador,
      serviceTag: provisorio ? null : tag,
      modelo,
      marca,
      tipo,
      descricaoItem: `${marca} ${modelo}`,
      propriedade: alugada ? "locada" : "propria",
      situacao,
      memoriaGb: memoria,
      ficha,
      destino,
      pessoa,
      observacoes: [
        provisorio
          ? "PATRIMÔNIO PROVISÓRIO — ler a etiqueta da máquina e corrigir o identificador."
          : null,
        escorregou
          ? `COLUNA DESLOCADA na planilha — conferir memória e armazenamento. RAM="${ramBruta}" HD="${hdBruto}".`
          : null,
        alugada ? "ALUGADA — ainda sem contrato de locação no Loca." : null,
        pessoa ? `Com: ${pessoa} (conforme planilha)` : null,
        !pessoa && usuarioBruto ? `Usuário na planilha: ${usuarioBruto}` : null,
        departamento ? `Departamento: ${departamento}` : null,
        l["OBSERVAÇÃO"] && l["OBSERVAÇÃO"] !== "Não possui" ? l["OBSERVAÇÃO"] : null,
        l["OBSERVAÇÃO DO DISPOSITIVO"] && l["OBSERVAÇÃO DO DISPOSITIVO"] !== "Não possui"
          ? `Garantia: ${l["OBSERVAÇÃO DO DISPOSITIVO"]}`
          : null,
        l["VALIDAÇÃO"] ? `A conferir: ${l["VALIDAÇÃO"]}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    };

    const anterior = maquinas.get(identificador);
    if (anterior) {
      avisos.push({
        tipo: "tag_duplicada",
        linha: l._linha,
        detalhe: `${identificador} já apareceu na linha ${anterior.linha} — vale a mais recente`,
      });
      maquina.observacoes = `${maquina.observacoes} · Antes com: ${anterior.pessoa ?? "—"}`;
    }
    maquinas.set(identificador, maquina);
  }

  // --- itens do catálogo ---------------------------------------------------
  const itens = new Map();
  for (const m of maquinas.values()) {
    if (!itens.has(m.descricaoItem)) {
      itens.set(m.descricaoItem, { descricao: m.descricaoItem, tipo: m.tipo, pecas: 0 });
    }
    itens.get(m.descricaoItem).pecas += 1;
  }

  // --- pessoas e os e-mails deduzidos --------------------------------------
  const pessoas = new Map();
  for (const m of maquinas.values()) {
    if (m.pessoa) pessoas.set(m.pessoa, (pessoas.get(m.pessoa) ?? 0) + 1);
  }

  // Colisão: se dois nomes derivam o mesmo endereço, NENHUM dos dois recebe.
  // "Andrea MArques" e "Andrea Marques" são provavelmente a mesma pessoa
  // digitada duas vezes, e o palpite certo aqui é não palpitar.
  const porEmail = new Map();
  for (const nome of pessoas.keys()) {
    const e = emailDerivado(nome);
    if (!e) continue;
    porEmail.set(e, [...(porEmail.get(e) ?? []), nome]);
  }
  const emails = new Map();
  const semEmail = [];
  for (const nome of pessoas.keys()) {
    const e = emailDerivado(nome);
    if (!e) {
      semEmail.push({ nome, motivo: "não dá para formar nome.sobrenome" });
    } else if (porEmail.get(e).length > 1) {
      semEmail.push({ nome, motivo: `colide com ${porEmail.get(e).filter((n) => n !== nome).join(", ")}` });
    } else {
      emails.set(nome, e);
    }
  }

  // --- frentes administrativas ---------------------------------------------
  const frentes = new Set();
  for (const m of maquinas.values()) {
    if (m.destino.tipo === "administrativo") frentes.add(m.destino.frente);
  }

  return {
    maquinas: [...maquinas.values()],
    itens: [...itens.values()],
    pessoas,
    emails,
    semEmail,
    frentes: [...frentes].sort(),
    avisos,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Prévia
// ═══════════════════════════════════════════════════════════════════════════
function imprimirPlano(plano, obrasPorCodigo) {
  const { maquinas, itens, pessoas, emails, semEmail, frentes, avisos } = plano;

  console.log("═".repeat(78));
  console.log(`PRÉVIA — ${APLICAR ? "VAI GRAVAR" : "nada será gravado"}`);
  console.log("═".repeat(78));

  const porTipo = new Map();
  for (const m of maquinas) porTipo.set(m.tipo, (porTipo.get(m.tipo) ?? 0) + 1);
  console.log(`\nMÁQUINAS: ${maquinas.length}`);
  for (const [t, n] of [...porTipo].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(4)} ${t}`);
  }
  const locadas = maquinas.filter((m) => m.propriedade === "locada");
  console.log(`   ${String(locadas.length).padStart(4)} ALUGADAS — sem contrato de locação (fase D)`);

  console.log(`\nMODELOS NO CATÁLOGO: ${itens.length}`);
  for (const i of [...itens].sort((a, b) => b.pecas - a.pecas)) {
    console.log(`   ${String(i.pecas).padStart(4)}  ${i.descricao}  (${i.tipo})`);
  }

  console.log("\nONDE FICAM:");
  const porDestino = new Map();
  for (const m of maquinas) {
    const chave =
      m.destino.tipo === "obra"
        ? `obra ${m.destino.codigo}`
        : m.destino.tipo === "administrativo"
          ? `obra 800 · frente ${m.destino.frente}`
          : m.destino.tipo === "sem_obra"
            ? "(sem obra — estoque)"
            : "(pendência de lugar)";
    porDestino.set(chave, (porDestino.get(chave) ?? 0) + 1);
  }
  for (const [c, n] of [...porDestino].sort((a, b) => b[1] - a[1])) {
    const cod = /^obra (\d{3})$/.exec(c)?.[1];
    const nome = cod ? obrasPorCodigo.get(cod)?.nome : null;
    const falta = cod && !obrasPorCodigo.has(cod) ? "  ⚠ código não existe no Loca" : "";
    console.log(`   ${String(n).padStart(4)} ${c}${nome ? ` — ${nome}` : ""}${falta}`);
  }

  console.log(`\nFRENTES A CRIAR NA OBRA 800: ${frentes.length}`);
  console.log(`   ${frentes.join(", ")}`);

  console.log(`\nFUNCIONÁRIOS: ${pessoas.size}`);
  console.log(`   ${emails.size} com e-mail deduzido (todos entram como POR CONFERIR)`);
  if (semEmail.length) {
    console.log(`   ${semEmail.length} SEM e-mail:`);
    for (const s of semEmail) console.log(`      ${s.nome} — ${s.motivo}`);
  }
  const comMais = [...pessoas].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  if (comMais.length) {
    console.log("   com mais de uma máquina:");
    for (const [p, n] of comMais) console.log(`      ${n}  ${p}`);
  }

  const porAviso = new Map();
  for (const a of avisos) porAviso.set(a.tipo, [...(porAviso.get(a.tipo) ?? []), a]);
  console.log(`\nPENDÊNCIAS: ${avisos.length}`);
  for (const [tipo, lista] of [...porAviso].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n   ${tipo.toUpperCase()} (${lista.length})`);
    for (const a of lista) console.log(`      linha ${a.linha}: ${a.detalhe}`);
  }
  console.log("");
}

// ═══════════════════════════════════════════════════════════════════════════
// Gravação — idempotente
// ═══════════════════════════════════════════════════════════════════════════
async function aplicar(plano, orgId, categoriaTI, tiposPorNome, obrasPorCodigo) {
  const { maquinas, itens, emails, frentes } = plano;

  // --- itens do catálogo, por descrição ------------------------------------
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
        natureza: "equipamento",
        descricao: i.descricao,
        unidade: "un",
        categoria_id: categoriaTI,
        tipo_id: tiposPorNome.get(i.tipo),
        ativo: true,
        // `controle` NÃO vai aqui: o trigger `aplicar_controle_do_item` o
        // deriva da natureza. Mandar o valor à mão seria a segunda cópia da
        // mesma regra.
      }),
    });
    itemPorDescricao.set(i.descricao.toLowerCase(), criado.id);
    itensCriados++;
  }

  // --- frentes da obra 800 -------------------------------------------------
  const obra800 = obrasPorCodigo.get("800");
  let frentesCriadas = 0;
  const frentePorNome = new Map();
  if (obra800 && frentes.length) {
    const jaTem = await api(
      `frente_obra?select=id,nome&obra_id=eq.${obra800.id}`,
    );
    for (const f of jaTem) frentePorNome.set(f.nome.toLowerCase(), f.id);
    for (const nome of frentes) {
      if (frentePorNome.has(nome.toLowerCase())) continue;
      const [criada] = await api("frente_obra", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ org_id: orgId, obra_id: obra800.id, nome, ativo: true }),
      });
      frentePorNome.set(nome.toLowerCase(), criada.id);
      frentesCriadas++;
    }
  }

  // --- funcionários, por nome ----------------------------------------------
  const funcExistentes = await api(`funcionario?select=id,nome,email&org_id=eq.${orgId}`);
  const funcPorNome = new Map(funcExistentes.map((f) => [chaveNome(f.nome), f]));

  let funcCriados = 0;
  let emailsGravados = 0;
  for (const nome of plano.pessoas.keys()) {
    const email = emails.get(nome) ?? null;
    const existente = funcPorNome.get(chaveNome(nome));
    if (existente) {
      // Só preenche e-mail em quem ainda não tem. Sobrescrever apagaria um
      // endereço que alguém já conferiu à mão, trocando fato por palpite.
      if (email && !existente.email) {
        await api(`funcionario?id=eq.${existente.id}`, {
          method: "PATCH",
          body: JSON.stringify({ email, email_confirmado: false }),
        });
        emailsGravados++;
      }
      continue;
    }
    const [criado] = await api("funcionario", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        org_id: orgId,
        nome,
        email,
        // SEMPRE falso: o endereço foi deduzido do nome, ninguém conferiu.
        email_confirmado: false,
        ativo: true,
      }),
    });
    funcPorNome.set(chaveNome(nome), { id: criado.id, nome, email });
    funcCriados++;
    if (email) emailsGravados++;
  }

  // --- peças, por identificador --------------------------------------------
  const pecasExistentes = await api(`equipamento_unidade?select=id,identificador&org_id=eq.${orgId}`);
  const pecaPorId = new Map(pecasExistentes.map((p) => [p.identificador.toUpperCase(), p.id]));

  let pecasCriadas = 0;
  let pecasAtualizadas = 0;
  for (const m of maquinas) {
    const obra =
      m.destino.tipo === "obra"
        ? obrasPorCodigo.get(m.destino.codigo)
        : m.destino.tipo === "administrativo"
          ? obra800
          : null;

    const corpo = {
      org_id: orgId,
      item_id: itemPorDescricao.get(m.descricaoItem.toLowerCase()),
      identificador: m.identificador,
      propriedade: m.propriedade,
      situacao: m.situacao,
      obra_id: obra?.id ?? null,
      numero_serie: m.serviceTag,
      service_tag: m.serviceTag,
      memoria_gb: m.memoriaGb,
      ficha: m.ficha,
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

  // --- custódia: NÃO nasce de importação ------------------------------------
  // `custodia_funcionario_exige_termo` (migration 0059) diz que posse de
  // funcionário só nasce de termo assinado, e a regra está certa: o valor do
  // termo é ser a ÚNICA fonte de verdade sobre quem respondeu pelo equipamento.
  // Uma planilha não é isso — ninguém assinou nada ao digitar aquela célula.
  const comDetentor = maquinas.filter((m) => m.pessoa).length;

  console.log("═".repeat(78));
  console.log("GRAVADO");
  console.log("═".repeat(78));
  console.log(`   itens do catálogo criados:  ${itensCriados}`);
  console.log(`   frentes criadas na obra 800: ${frentesCriadas}`);
  console.log(`   funcionários criados:       ${funcCriados}`);
  console.log(`   e-mails deduzidos gravados: ${emailsGravados} (todos POR CONFERIR)`);
  console.log(`   peças criadas:              ${pecasCriadas}`);
  console.log(`   peças atualizadas:          ${pecasAtualizadas}`);
  console.log(`   peças com detentor anotado: ${comDetentor} (posse só nasce por termo assinado)`);
  console.log("");
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  if (!KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente em .env.local");

  const [org] = await api("organizacao?select=id,nome&limit=1");
  const categorias = await api("categoria_equipamento?select=id,nome");
  const categoriaTI = categorias.find((c) => c.nome === "TI")?.id ?? null;
  const tipos = await api(`tipo_equipamento?select=id,nome&categoria_id=eq.${categoriaTI}`);
  const tiposPorNome = new Map(tipos.map((t) => [t.nome, t.id]));
  const obras = await api("obra?select=id,codigo,nome");
  const obrasPorCodigo = new Map(obras.map((o) => [o.codigo, o]));

  const linhas = await lerPlanilha();
  const plano = montarPlano(linhas);

  imprimirPlano(plano, obrasPorCodigo);

  if (!APLICAR) {
    console.log("Prévia apenas. Para gravar:  node scripts/db/importar-inventario-ti.mjs --aplicar\n");
    return;
  }
  if (!categoriaTI) throw new Error('Categoria "TI" não encontrada.');
  for (const n of ["NOTEBOOK", "DESKTOP", "SERVIDOR"]) {
    if (!tiposPorNome.has(n)) throw new Error(`Tipo "${n}" não encontrado — rode a migration 0075.`);
  }
  await aplicar(plano, org.id, categoriaTI, tiposPorNome, obrasPorCodigo);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
