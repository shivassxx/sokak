// Verifies the download budget (user decision 2026-10-08: realism over instant load):
// the lobby (html + entry chunk + CSS) stays under 300 KB gzip so it shows at once;
// the whole client with its textures and models stays under 60 MB.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const dist = new URL('../apps/client/dist/', import.meta.url).pathname;
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(dist);
let raw = 0;
let gz = 0;
let initial = 0;
const html = readFileSync(join(dist, 'index.html'), 'utf8');
for (const f of files) {
  const buf = readFileSync(f);
  const g = gzipSync(buf).length;
  raw += buf.length;
  gz += g;
  const rel = f.slice(dist.length);
  if (rel === 'index.html' || html.includes(rel)) initial += g;
  console.log(`${(g / 1024).toFixed(1).padStart(8)} KB gz  ${rel}`);
}
console.log(`\ntotal: ${(raw / 1024).toFixed(0)} KB raw, ${(gz / 1024).toFixed(0)} KB gzip`);
console.log(`needed for the lobby (html + entry js + css): ${(initial / 1024).toFixed(0)} KB gzip`);
const LIMIT = 60 * 1024 * 1024;
const LOBBY = 300 * 1024;
if (gz > LIMIT || initial > LOBBY) {
  console.error(`FAIL: over budget (total ${LIMIT / 1024 / 1024} MB, lobby ${LOBBY / 1024} KB)`);
  process.exit(1);
}
console.log('OK: lobby under 300 KB, total under 60 MB');
