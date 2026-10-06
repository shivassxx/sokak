import http from 'node:http';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { SERVER_PORT } from '@sokak/shared';

const port = Number(process.env.PORT ?? SERVER_PORT);
const app = express();
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const httpServer = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server: httpServer }) });

await gameServer.listen(port, '0.0.0.0');
console.log(`[sokak] server listening on :${port}`);
