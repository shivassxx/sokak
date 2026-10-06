import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ROOM_NAME } from '@sokak/shared';
import type { RulesConfig } from '@sokak/rules';
import { SaklambacRoom } from './rooms/SaklambacRoom';
import { Analytics } from './analytics';

export interface StartedServer {
  port: number;
  analytics: Analytics;
  gameServer: Server;
  close(): Promise<void>;
}

export async function startServer(port: number, opts: { staticDir?: string; host?: string; rules?: Partial<RulesConfig>; analyticsFile?: string | null; statsToken?: string } = {}): Promise<StartedServer> {
  const app = express();
  app.disable('x-powered-by');
  const analytics = new Analytics(opts.analyticsFile ?? null);
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  // aggregate counts only; protected by a token when STATS_TOKEN is set
  app.get('/stats', (req, res) => {
    if (opts.statsToken && req.query.token !== opts.statsToken) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    res.json(analytics.summary());
  });
  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    app.use(
      express.static(dir, {
        index: 'index.html',
        setHeaders: (res, file) => {
          // hashed assets are immutable; the page itself must always be fresh
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(dir, 'index.html'));
    });
  }
  const httpServer = http.createServer(app);
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer, pingInterval: 5000, pingMaxRetries: 3 }),
    greet: false,
  });
  const rules = opts.rules ?? {};
  gameServer.define(
    ROOM_NAME,
    class extends SaklambacRoom {
      static override rulesConfig = rules;
      static override analyticsSink = analytics;
    },
  );
  await gameServer.listen(port, opts.host ?? '0.0.0.0');
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    port: actualPort,
    analytics,
    gameServer,
    close: () => gameServer.gracefullyShutdown(false),
  };
}
