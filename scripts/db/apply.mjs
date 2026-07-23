// Aplica um arquivo .sql no banco usando a connection string em DATABASE_URL.
// Uso: node scripts/db/apply.mjs <caminho-do-arquivo.sql>
// A DATABASE_URL é lida do ambiente (nunca commitada).
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("Informe o caminho do arquivo .sql.");
  process.exit(1);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Defina DATABASE_URL no ambiente.");
  process.exit(1);
}

const sql = await readFile(file, "utf8");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: aplicado ${file}`);
} catch (err) {
  console.error("ERRO ao aplicar:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
