import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT } from '@sokak/shared';
import { startServer } from './app';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.CLIENT_DIR ?? path.resolve(here, '../../client/dist');
const port = Number(process.env.PORT ?? SERVER_PORT);

// SOKAK_TIMERS=fast shortens rounds for local testing
const fast = process.env.SOKAK_TIMERS === 'fast';
const s = await startServer(port, {
  staticDir: process.env.NODE_ENV === 'production' ? staticDir : undefined,
  rules: fast ? { countingMs: 6000, seekingMs: 45000, roundEndMs: 8000 } : {},
});
console.log(`[sokak] server listening on :${s.port}`);
