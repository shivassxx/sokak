// Verifies the instant-load budget: total gzip size of the client build < 5 MB,
// and reports what is needed before the lobby can show (entry chunk + CSS).
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
const LIMIT = 5 * 1024 * 1024;
if (gz > LIMIT) {
  console.error('FAIL: over the 5 MB budget');
  process.exit(1);
}
console.log('OK: under the 5 MB budget');
