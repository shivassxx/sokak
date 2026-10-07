import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT } from '@sokak/shared';
import { startServer } from './app';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.CLIENT_DIR ?? path.resolve(here, '../../client/dist');
const port = Number(process.env.PORT ?? SERVER_PORT);

// SOKAK_TIMERS=fast shortens the okey turn timer and the breaks for local testing
const fast = process.env.SOKAK_TIMERS === 'fast';
const prod = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
const s = await startServer(port, {
  staticDir: prod ? staticDir : undefined,
  analyticsFile: process.env.ANALYTICS_FILE ?? (prod ? path.resolve('data/analytics.jsonl') : null),
  statsToken: process.env.STATS_TOKEN,
  walletFile: process.env.WALLET_FILE ?? path.resolve('data/wallets.json'),
  staffFile: process.env.STAFF_FILE ?? path.resolve('data/staff.json'),
  ownerPassword: process.env.SOKAK_OWNER_PASSWORD || undefined,
  kahve: fast ? { timing: { turn: 12000, between: 3000, result: 4000 } } : undefined,
});
console.log(`[sokak] server listening on :${s.port}`);
// local screenshot / browser testing only: put a derby on the TV right away
// (SOKAK_DEV_TV_SEED picks the match, SOKAK_DEV_TV_AT jumps that many ms into it)
if (process.env.SOKAK_DEV_TV === '1' && !prod) {
  const b = s.tv.start('sarikirmizi', 'sarilacivert', 'dev');
  if (b && process.env.SOKAK_DEV_TV_SEED) b.seed = Number(process.env.SOKAK_DEV_TV_SEED) >>> 0;
  if (b) b.startedAt -= Number(process.env.SOKAK_DEV_TV_AT ?? 0) || 0;
}
// local testing only: put a stream on the TV without the https check (e.g. a test clip served by Vite)
if (process.env.SOKAK_DEV_STREAM_URL && !prod) {
  const type = process.env.SOKAK_DEV_STREAM_TYPE === 'embed' ? 'embed' : 'video';
  s.tv.startStream({ id: 'dev', title: process.env.SOKAK_DEV_STREAM_TITLE ?? 'Test yayını', url: process.env.SOKAK_DEV_STREAM_URL, type }, 'dev');
}

const shutdown = async () => {
  console.log('[sokak] shutting down…');
  await s.close();
  // after close: the players' last saves happen while the rooms shut down
  s.wallets.flush();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
