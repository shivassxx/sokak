import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@sokak/shared';
import { SaklambacRoom } from './rooms/SaklambacRoom';

export interface StartedServer {
  port: number;
  gameServer: Server;
  close(): Promise<void>;
}

export async function startServer(port: number, opts: { staticDir?: string; host?: string } = {}): Promise<StartedServer> {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  if (opts.staticDir && existsSync(opts.staticDir)) {
    app.use(express.static(opts.staticDir, { maxAge: '1h', index: 'index.html' }));
    app.get('*', (_req, res) => res.sendFile(path.join(opts.staticDir!, 'index.html')));
  }
  const httpServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer, pingInterval: 5000, pingMaxRetries: 3 }),
    greet: false,
  });
  gameServer.define(ROOM_NAME, SaklambacRoom);
  await gameServer.listen(port, opts.host ?? '0.0.0.0');
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    port: actualPort,
    gameServer,
    close: () => gameServer.gracefullyShutdown(false),
  };
}
