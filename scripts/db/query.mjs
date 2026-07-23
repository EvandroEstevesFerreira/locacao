// Executa um .sql e imprime as linhas retornadas (JSON).
// Uso: node scripts/db/query.mjs <arquivo.sql>
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const file = process.argv[2];
const connectionString = process.env.DATABASE_URL;
if (!file || !connectionString) {
  console.error("Uso: DATABASE_URL=... node scripts/db/query.mjs <arquivo.sql>");
  process.exit(1);
}

const sql = await readFile(file, "utf8");
const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
try {
  await client.connect();
  const res = await client.query(sql);
  const rows = Array.isArray(res) ? res[res.length - 1].rows : res.rows;
  console.log(JSON.stringify(rows, null, 2));
} catch (err) {
  console.error("ERRO:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
