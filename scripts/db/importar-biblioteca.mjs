// Importa a pasta de documentos do alojamento para a Biblioteca (Imóveis).
// A chave service_role é lida do ambiente e NUNCA impressa.
//
// Uso (PowerShell):
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<sua service_role>"   # cole só no SEU terminal
//   node scripts/db/importar-biblioteca.mjs "C:\\Users\\evandro.ferreira\\Projects\\alojamentos"
//   Remove-Item Env:\SUPABASE_SERVICE_ROLE_KEY               # limpa depois
//
// Opcionais por ambiente:
//   SUPABASE_URL  (default: projeto Loca)   ORG_ID (default: 1ª organização)
import { readdir, readFile } from "node:fs/promises";
import { extname, basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const DIR = process.argv[2] ?? "C:\\Users\\evandro.ferreira\\Projects\\alojamentos";
const URL = process.env.SUPABASE_URL ?? "https://tvntdfvburuqpwphvsjd.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "imoveis";

if (!KEY) {
  console.error("Defina SUPABASE_SERVICE_ROLE_KEY no ambiente (não cole em chat).");
  process.exit(1);
}

// Arquivos intermediários/prévias que não devem virar itens da biblioteca.
const IGNORAR =
  /^_(decl_preview|logo_preview|qr_preview|preview_p\d+|kit_p\d+|lim_p\d+)/i;

const CONTENT_TYPE = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".doc": "application/msword",
  ".ppt": "application/vnd.ms-powerpoint",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

function categoriaDe(nome) {
  const n = nome.toLowerCase();
  // Normativo antes de placa: "Critica_Placas" é análise, não sinalização.
  if (/^pol[-_]|politic|critica/.test(n)) return "normativo";
  if (/^frm[-_]|termo|advert|chaves|kit|checklist|limpeza/.test(n)) return "formulario";
  if (/^_p_/.test(nome) || n.includes("placa")) return "placa";
  if (n.includes("email") || n.includes("comunic")) return "comunicacao";
  return "outro";
}

const FORMATO = {
  ".pdf": "PDF",
  ".docx": "Word",
  ".doc": "Word",
  ".pptx": "PowerPoint",
  ".ppt": "PowerPoint",
  ".xlsx": "Excel",
};

function tituloDe(nome) {
  const ext = extname(nome).toLowerCase();
  let t = basename(nome, ext);
  if (/^_p_/.test(t)) t = "Placa " + t.replace(/^_p_/, "");
  t = t
    .replace(/^_+/, "")
    .replace(/^\d+[_-]/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // Rotula o formato para DOCX/PDF/PPTX conviverem sem colidir o título.
  return FORMATO[ext] ? `${t} (${FORMATO[ext]})` : t;
}

function nomeSeguro(nome) {
  return nome.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

// Organização alvo.
let orgId = process.env.ORG_ID;
if (!orgId) {
  const { data, error } = await supabase.from("organizacao").select("id").limit(1);
  if (error || !data?.length) {
    console.error("Não achei a organização.", error?.message ?? "");
    process.exit(1);
  }
  orgId = data[0].id;
}

// Evita duplicar em reexecuções: títulos já existentes.
const { data: existentes } = await supabase
  .from("biblioteca_documento")
  .select("titulo")
  .eq("org_id", orgId);
const jaTem = new Set((existentes ?? []).map((r) => r.titulo));

const arquivos = (await readdir(DIR)).filter((f) => {
  const ext = extname(f).toLowerCase();
  if (!(ext in CONTENT_TYPE)) return false; // ignora .txt e afins
  if (IGNORAR.test(f)) return false;
  return true;
});

let ok = 0;
let pulados = 0;
for (const arquivo of arquivos) {
  const titulo = tituloDe(arquivo);
  if (jaTem.has(titulo)) {
    console.log(`= já existe, pulando: ${titulo}`);
    pulados++;
    continue;
  }
  const categoria = categoriaDe(arquivo);
  const bytes = await readFile(join(DIR, arquivo));
  const path = `${orgId}/biblioteca/${nomeSeguro(arquivo)}`;
  const { error: eUp } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: CONTENT_TYPE[extname(arquivo).toLowerCase()],
      upsert: true,
    });
  if (eUp) {
    console.error(`x falha no upload de ${arquivo}: ${eUp.message}`);
    continue;
  }
  const { error: eIns } = await supabase.from("biblioteca_documento").insert({
    org_id: orgId,
    categoria,
    titulo,
    path,
  });
  if (eIns) {
    console.error(`x falha ao registrar ${arquivo}: ${eIns.message}`);
    continue;
  }
  console.log(`+ [${categoria}] ${titulo}`);
  ok++;
}

console.log(`\nConcluído: ${ok} importado(s), ${pulados} já existente(s).`);
