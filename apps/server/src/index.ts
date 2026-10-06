import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERVER_PORT } from '@sokak/shared';
import { startServer } from './app';

const here = path.dirname(fileURLToPath(import.meta.url));
const staticDir = process.env.CLIENT_DIR ?? path.resolve(here, '../../client/dist');
const port = Number(process.env.PORT ?? SERVER_PORT);

const s = await startServer(port, { staticDir: process.env.NODE_ENV === 'production' ? staticDir : undefined });
console.log(`[sokak] server listening on :${s.port}`);
