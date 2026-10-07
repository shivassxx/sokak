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
  kahve: fast ? { timing: { turn: 12000, between: 3000, result: 4000 } } : undefined,
});
console.log(`[sokak] server listening on :${s.port}`);

const shutdown = async () => {
  console.log('[sokak] shutting down…');
  await s.close();
  // after close: the players' last saves happen while the rooms shut down
  s.wallets.flush();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
