import http from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { KAHVE_ROOM, type LeaderInfo, type SalonInfo, type SalonMeta } from '@sokak/shared';
import { KahvehaneRoom } from './rooms/KahvehaneRoom';
import { Analytics } from './analytics';
import { WalletStore } from './wallets';

export interface StartedServer {
  port: number;
  analytics: Analytics;
  wallets: WalletStore;
  gameServer: Server;
  close(): Promise<void>;
}

export async function startServer(port: number, opts: {
    staticDir?: string;
    host?: string;
    analyticsFile?: string | null;
    statsToken?: string;
    walletFile?: string | null;
    /** clock of the wallet store (weekly leaderboard), injectable for tests */
    now?: () => number;
    kahve?: { timing?: Partial<typeof KahvehaneRoom.timing>; rng?: () => number };
  } = {}): Promise<StartedServer> {
  const app = express();
  app.disable('x-powered-by');
  const analytics = new Analytics(opts.analyticsFile ?? null);
  const wallets = new WalletStore(opts.walletFile ?? null, { now: opts.now });
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  // lobby: public kahvehane salons (no personal data, readable cross-origin in dev)
  app.get('/api/salons', async (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rooms = await matchMaker.query({ name: KAHVE_ROOM });
      const list: SalonInfo[] = rooms
        .filter((r) => !(r.metadata as SalonMeta | undefined)?.private && !r.private)
        .map((r) => {
          const m = (r.metadata ?? {}) as Partial<SalonMeta>;
          return { roomId: r.roomId, name: m.name ?? 'Salon', players: r.clients, max: r.maxClients, playing: m.playing ?? 0, waiting: m.waiting ?? 0 };
        });
      res.json(list);
    } catch {
      res.json([]);
    }
  });
  // the lobby's "your wallet" line: only whoever holds the device token can ask
  app.get('/api/wallet', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const token = req.query.device;
    const w = WalletStore.validToken(token) ? wallets.get(token) : null;
    res.json(w ? { money: w.money, played: w.played ?? 0, won: w.won ?? 0 } : null);
  });
  // lobby leaderboard: the richest players online right now, public salons only
  app.get('/api/leaders', async (_req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const rooms = await matchMaker.query({ name: KAHVE_ROOM });
      const list: LeaderInfo[] = [];
      for (const r of rooms) {
        const m = (r.metadata ?? {}) as Partial<SalonMeta>;
        if (m.private || r.private) continue;
        for (const t of m.top ?? []) list.push({ name: t.name, money: t.money, salon: m.name ?? 'Salon' });
      }
      res.json(list.sort((a, b) => b.money - a.money).slice(0, 10));
    } catch {
      res.json([]);
    }
  });
  // weekly leaderboard ("Haftanın en iyileri"): names and results only, never device tokens;
  // ?device= adds the asker's own rank, ?week=last gives last week's final standings
  app.get('/api/leaders/weekly', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    const device = WalletStore.validToken(req.query.device) ? req.query.device : undefined;
    res.json(wallets.weekly(req.query.week === 'last' ? 'last' : 'current', device));
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
  const kahveTiming = { ...KahvehaneRoom.timing, ...(opts.kahve?.timing ?? {}) };
  const kahveRng = opts.kahve?.rng ?? Math.random;
  gameServer
    .define(
      KAHVE_ROOM,
      class extends KahvehaneRoom {
        static override timing = kahveTiming;
        static override rng = kahveRng;
        static override wallets = wallets;
        static override analyticsSink = {
          tableStarted: (players: number, bet: number) => analytics.tableStarted(players, bet),
          handPlayed: () => analytics.okeyHandPlayed(),
        };
      },
    )
    // public: anyone can drop in; friends share the room link
    .enableRealtimeListing();
  await gameServer.listen(port, opts.host ?? '0.0.0.0');
  const addr = httpServer.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : port;
  return {
    port: actualPort,
    analytics,
    wallets,
    gameServer,
    close: () => gameServer.gracefullyShutdown(false),
  };
}
