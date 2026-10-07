import express, { type NextFunction, type Request, type Response } from 'express';
import { matchMaker } from '@colyseus/core';
import { KAHVE_ROOM, TV_TEAMS, isOffensive, tvTeam, type StaffSalonInfo } from '@sokak/shared';
import { OWNER_USERNAME, SESSION_MS, type StaffStore, type StaffUserView } from './staff';
import type { TvChannel } from './tv';
import type { Analytics } from './analytics';

const match = (home: string, away: string): string => `${tvTeam(home)?.name ?? home} – ${tvTeam(away)?.name ?? away}`;

const COOKIE = 'sokak_staff';
const MAX_GRANT = 100_000;
const ROOM_ID = /^[A-Za-z0-9]{6,20}$/;

interface Authed {
  user: StaffUserView;
  token: string;
}

function tokenOf(req: Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

const authed = (res: Response): Authed => res.locals.staff as Authed;
const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.slice(0, max) : '');

/**
 * The admin panel API (/api/admin/*). Same-origin only: no CORS headers here, a session
 * cookie (HttpOnly, SameSite=Strict) or a Bearer token. Every role check is done here.
 */
export function adminRouter(deps: { staff: StaffStore; tv: TvChannel; analytics: Analytics }): express.Router {
  const { staff, tv, analytics } = deps;
  const r = express.Router();
  r.use(express.json({ limit: '4kb' }));
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const need =
    (role: 'any' | 'owner') =>
    (req: Request, res: Response, next: NextFunction): void => {
      const token = tokenOf(req);
      const user = staff.session(token);
      if (!user || !token) {
        res.status(401).json({ error: 'Oturum açman gerekiyor.' });
        return;
      }
      if (role === 'owner' && user.role !== 'owner') {
        res.status(403).json({ error: 'Bu işlem için yetkin yok.' });
        return;
      }
      res.locals.staff = { user, token } satisfies Authed;
      next();
    };
  const any = need('any');
  const owner = need('owner');

  // ------------------------------------------------------------ session
  r.post('/login', (req, res) => {
    const ip = req.ip ?? req.socket.remoteAddress ?? '?';
    const username = str(req.body?.username, 40).trim().toLowerCase();
    if (staff.limited(ip, username)) {
      res.status(429).json({ error: 'Çok fazla hatalı deneme. 10 dakika sonra tekrar dene.' });
      return;
    }
    const s = staff.login(username, req.body?.password, ip);
    if (!s) {
      res.status(401).json({ error: 'Kullanıcı adı ya da şifre hatalı.' });
      return;
    }
    const secure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${s.token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`,
    );
    staff.log(s.user.username, 'login');
    res.json({ username: s.user.username, role: s.user.role });
  });

  r.post('/logout', (req, res) => {
    staff.logout(tokenOf(req));
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0`);
    res.json({ ok: true });
  });

  r.get('/me', any, (_req, res) => {
    const { user } = authed(res);
    res.json({ username: user.username, role: user.role });
  });

  // ------------------------------------------------------------ TV (owner and admins)
  r.get('/tv', any, (_req, res) => {
    res.json({ current: tv.current(), teams: TV_TEAMS });
  });

  r.post('/tv/start', any, (req, res) => {
    const { user } = authed(res);
    const b = tv.start(str(req.body?.home, 40), str(req.body?.away, 40), user.username);
    if (!b) {
      res.status(400).json({ error: 'İki farklı takım seç.' });
      return;
    }
    staff.log(user.username, 'tv/start', match(b.home, b.away));
    res.json({ current: b });
  });

  r.post('/tv/stop', any, (_req, res) => {
    const { user } = authed(res);
    const was = tv.current();
    tv.stop();
    if (was) staff.log(user.username, 'tv/stop', match(was.home, was.away));
    res.json({ current: null });
  });

  // ------------------------------------------------------------ staff accounts (owner)
  r.get('/users', owner, (_req, res) => {
    res.json(staff.list());
  });

  r.post('/users', owner, (req, res) => {
    const { user } = authed(res);
    const out = staff.addAdmin(str(req.body?.username, 40).trim().toLowerCase(), req.body?.password, user.username);
    if (out === 'invalid') {
      res.status(400).json({ error: 'Kullanıcı adı 3–20 karakter (a-z, 0-9, _), şifre en az 8 karakter olmalı.' });
      return;
    }
    if (out === 'exists') {
      res.status(409).json({ error: 'Bu kullanıcı adı zaten var.' });
      return;
    }
    staff.log(user.username, 'users/add', out.username);
    res.json(out);
  });

  r.delete('/users/:name', owner, (req, res) => {
    const { user } = authed(res);
    const name = str(req.params.name, 40);
    if (name === OWNER_USERNAME || !staff.remove(name)) {
      res.status(400).json({ error: 'Bu yetkili silinemez.' });
      return;
    }
    staff.log(user.username, 'users/remove', name);
    res.json({ ok: true });
  });

  r.post('/users/:name/password', owner, (req, res) => {
    const { user, token } = authed(res);
    const name = str(req.params.name, 40);
    if (name === user.username) {
      // own password: the old one is required
      if (!staff.verify(user.username, req.body?.oldPassword)) {
        res.status(400).json({ error: 'Eski şifre hatalı.' });
        return;
      }
    }
    const out = staff.setPassword(name, req.body?.password, name === user.username ? token : undefined);
    if (out === 'invalid') {
      res.status(400).json({ error: 'Şifre en az 8 karakter olmalı.' });
      return;
    }
    if (!out) {
      res.status(404).json({ error: 'Böyle bir yetkili yok.' });
      return;
    }
    staff.log(user.username, 'users/password', name);
    res.json({ ok: true });
  });

  // ------------------------------------------------------------ salons (owner)
  const salonIds = async (): Promise<string[]> => (await matchMaker.query({ name: KAHVE_ROOM })).map((x) => x.roomId);
  const call = <T>(roomId: string, method: string, args: unknown[] = []): Promise<T> => matchMaker.remoteRoomCall<T>(roomId, method, args);

  r.get('/salons', owner, async (_req, res) => {
    const out: StaffSalonInfo[] = [];
    for (const id of await salonIds()) {
      try {
        out.push(await call<StaffSalonInfo>(id, 'staffInfo'));
      } catch {
        /* room went away meanwhile */
      }
    }
    res.json(out);
  });

  const roomParam = async (req: Request, res: Response): Promise<string | null> => {
    const id = str(req.params.roomId ?? req.body?.roomId, 40);
    if (ROOM_ID.test(id) && (await salonIds()).includes(id)) return id;
    res.status(404).json({ error: 'Salon bulunamadı.' });
    return null;
  };

  r.post('/salons/:roomId/kick', owner, async (req, res) => {
    const { user } = authed(res);
    const id = await roomParam(req, res);
    if (!id) return;
    const sid = str(req.body?.sessionId, 40);
    const info = await call<StaffSalonInfo>(id, 'staffInfo').catch(() => null);
    const name = info?.players.find((p) => p.sessionId === sid)?.name ?? sid;
    if (!(await call<boolean>(id, 'staffKick', [sid]).catch(() => false))) {
      res.status(404).json({ error: 'Oyuncu bulunamadı.' });
      return;
    }
    staff.log(user.username, 'salons/kick', `${info?.name ?? id}: ${name}`);
    res.json({ ok: true });
  });

  r.post('/salons/:roomId/close', owner, async (req, res) => {
    const { user } = authed(res);
    const id = await roomParam(req, res);
    if (!id) return;
    const info = await call<StaffSalonInfo>(id, 'staffInfo').catch(() => null);
    await call(id, 'staffClose').catch(() => 0);
    staff.log(user.username, 'salons/close', info?.name ?? id);
    res.json({ ok: true });
  });

  r.post('/announce', owner, async (req, res) => {
    const { user } = authed(res);
    const text = str(req.body?.text, 400).replace(/\s+/g, ' ').trim();
    if (!text || text.length > 140) {
      res.status(400).json({ error: 'Duyuru 1–140 karakter olmalı.' });
      return;
    }
    if (isOffensive(text)) {
      res.status(400).json({ error: 'Duyuru uygunsuz bir kelime içeriyor.' });
      return;
    }
    let salons = 0;
    for (const id of await salonIds()) {
      try {
        await call(id, 'staffAnnounce', [`📢 Duyuru: ${text}`]);
        salons++;
      } catch {
        /* gone */
      }
    }
    staff.log(user.username, 'announce', text);
    res.json({ ok: true, salons });
  });

  r.post('/wallet/grant', owner, async (req, res) => {
    const { user } = authed(res);
    const id = await roomParam(req, res);
    if (!id) return;
    const amount = Math.round(Number(req.body?.amount));
    if (!Number.isFinite(amount) || amount === 0) {
      res.status(400).json({ error: 'Geçerli bir miktar gir.' });
      return;
    }
    const clamped = Math.max(-MAX_GRANT, Math.min(MAX_GRANT, amount));
    const sid = str(req.body?.sessionId, 40);
    const money = await call<number | null>(id, 'staffGrant', [sid, clamped]).catch(() => null);
    if (money === null) {
      res.status(404).json({ error: 'Oyuncu bulunamadı.' });
      return;
    }
    staff.log(user.username, 'wallet/grant', `${id}/${sid}: ${clamped > 0 ? '+' : ''}${clamped} ₺ → ${money} ₺`);
    res.json({ ok: true, money, amount: clamped });
  });

  r.get('/stats', owner, (_req, res) => {
    res.json(analytics.summary());
  });

  r.get('/log', owner, (_req, res) => {
    res.json(staff.recentLog());
  });

  r.use((_req, res) => {
    res.status(404).json({ error: 'not found' });
  });
  return r;
}
