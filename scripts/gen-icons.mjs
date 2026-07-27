// Gera ícones PNG (192 e 512) do PWA — quadrado azul-marinho com "L" branca,
// espelhando public/icons/icon.svg. Encoder PNG puro (zlib), sem dependências.
// Uso: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const BG = [15, 23, 42]; // #0f172a
const FG = [255, 255, 255];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function desenhar(n) {
  // "L": barra vertical + pé horizontal, dentro da zona segura central.
  const bar = { x0: n * 0.36, x1: n * 0.48, y0: n * 0.28, y1: n * 0.72 };
  const foot = { x0: n * 0.36, x1: n * 0.66, y0: n * 0.6, y1: n * 0.72 };
  const dentro = (x, y, r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;

  const raw = Buffer.alloc(n * (n * 4 + 1));
  let p = 0;
  for (let y = 0; y < n; y++) {
    raw[p++] = 0; // filtro None
    for (let x = 0; x < n; x++) {
      const isL = dentro(x, y, bar) || dentro(x, y, foot);
      const c = isL ? FG : BG;
      raw[p++] = c[0];
      raw[p++] = c[1];
      raw[p++] = c[2];
      raw[p++] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

for (const n of [192, 512]) {
  const out = `public/icons/icon-${n}.png`;
  writeFileSync(out, desenhar(n));
  console.log("OK:", out);
}
