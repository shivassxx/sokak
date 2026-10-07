import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KAHVE_ROOM, KMSG, STAFF_KICK_CODE, type StaffSalonInfo } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { StaffStore } from '../src/staff';
import { NetBot } from './netBot';
import { until } from './helpers';

const OWNER_PW = 'kizkulesi-101';
let server: StartedServer;
let base: string;
let endpoint: string;
let staffFile: string;

beforeAll(async () => {
  staffFile = path.join(mkdtempSync(path.join(tmpdir(), 'sokak-staff-')), 'staff.json');
  server = await startServer(0, { host: '127.0.0.1', staffFile, ownerPassword: OWNER_PW });
  base = `http://127.0.0.1:${server.port}/api/admin`;
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

async function api(method: string, route: string, token?: string, body?: unknown, ip?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (ip) headers['x-forwarded-for'] = ip;
  const res = await fetch(`${base}/${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text, cookie: res.headers.get('set-cookie') ?? '' };
}

async function login(username: string, password: string, ip = '10.0.0.1'): Promise<string> {
  const r = await api('POST', 'login', undefined, { username, password }, ip);
  expect(r.status).toBe(200);
  const m = /sokak_staff=([a-f0-9]{64})/.exec(r.cookie);
  expect(m).toBeTruthy();
  return m![1]!;
}

describe('admin panel API', () => {
  it('owner logs in with an HttpOnly SameSite=Strict cookie; me works; logout ends the session', async () => {
    const r = await api('POST', 'login', undefined, { username: 'shivass', password: OWNER_PW }, '10.0.0.2');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ username: 'shivass', role: 'owner' });
    expect(r.cookie).toMatch(/HttpOnly/);
    expect(r.cookie).toMatch(/SameSite=Strict/);
    expect(r.text).not.toContain(OWNER_PW);
    const token = /sokak_staff=([a-f0-9]+)/.exec(r.cookie)![1]!;
    expect((await api('GET', 'me', token)).body).toEqual({ username: 'shivass', role: 'owner' });
    // no CORS wildcard on admin routes
    const me = await fetch(`${base}/me`, { headers: { authorization: `Bearer ${token}` } });
    expect(me.headers.get('access-control-allow-origin')).toBeNull();
    await api('POST', 'logout', token);
    expect((await api('GET', 'me', token)).status).toBe(401);
    expect((await api('GET', 'me')).status).toBe(401);
  });

  it('bad password and unknown user get the same generic error', async () => {
    const a = await api('POST', 'login', undefined, { username: 'shivass', password: 'wrong-password' }, '10.0.1.1');
    const b = await api('POST', 'login', undefined, { username: 'nobody_here', password: 'wrong-password' }, '10.0.1.2');
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body).toEqual(b.body);
  });

  it('rate limits after 5 failures per IP and per username', async () => {
    for (let i = 0; i < 5; i++) expect((await api('POST', 'login', undefined, { username: 'ghost_' + i, password: 'xxxxxxxx' }, '10.9.9.9')).status).toBe(401);
    // the IP is blocked now, even with the right password
    expect((await api('POST', 'login', undefined, { username: 'shivass', password: OWNER_PW }, '10.9.9.9')).status).toBe(429);
    // per username: five different IPs guessing one account
    const s = new StaffStore(null, { ownerPassword: OWNER_PW });
    for (let i = 0; i < 5; i++) s.login('shivass', 'nope-nope', `1.1.1.${i}`);
    expect(s.limited('2.2.2.2', 'shivass')).toBe(true);
    expect(s.limited('2.2.2.2', 'someone')).toBe(false);
  });

  it('owner creates an admin; admin can run the TV but not owner routes; removal kills the session', async () => {
    const owner = await login('shivass', OWNER_PW, '10.0.2.1');
    expect((await api('POST', 'users', owner, { username: 'Bad Name', password: 'longenough' })).status).toBe(400);
    expect((await api('POST', 'users', owner, { username: 'cayci', password: 'short' })).status).toBe(400);
    const add = await api('POST', 'users', owner, { username: 'cayci', password: 'demlicay123' });
    expect(add.status).toBe(200);
    expect(add.text).not.toMatch(/demlicay|scrypt|passwordHash/);
    const users = await api('GET', 'users', owner);
    expect(users.body.map((u: { username: string }) => u.username)).toEqual(['shivass', 'cayci']);
    expect(users.text).not.toMatch(/scrypt|passwordHash/);

    const admin = await login('cayci', 'demlicay123', '10.0.2.2');
    expect((await api('GET', 'me', admin)).body).toEqual({ username: 'cayci', role: 'admin' });
    for (const [m, route, body] of [
      ['GET', 'users'],
      ['POST', 'users', { username: 'x_y_z', password: 'longenough' }],
      ['POST', 'announce', { text: 'merhaba' }],
      ['GET', 'salons'],
      ['GET', 'stats'],
      ['GET', 'log'],
      ['POST', 'wallet/grant', { roomId: 'abcdefgh', sessionId: 'x', amount: 5 }],
    ] as [string, string, unknown?][])
      expect((await api(m, route, admin, body)).status, route).toBe(403);

    const tv = await api('GET', 'tv', admin);
    expect(tv.status).toBe(200);
    expect(tv.body.teams.length).toBeGreaterThan(2);
    expect((await api('POST', 'tv/start', admin, { home: 'sarikirmizi', away: 'sarikirmizi' })).status).toBe(400);
    const start = await api('POST', 'tv/start', admin, { home: 'sarikirmizi', away: 'siyahbeyaz' });
    expect(start.status).toBe(200);
    expect(server.tv.current()).toMatchObject({ home: 'sarikirmizi', away: 'siyahbeyaz', by: 'cayci' });
    expect((await api('POST', 'tv/stop', admin)).status).toBe(200);
    expect(server.tv.current()).toBeNull();

    // the owner cannot be removed; removing the admin ends their session
    expect((await api('DELETE', 'users/shivass', owner)).status).toBe(400);
    expect((await api('DELETE', 'users/cayci', owner)).status).toBe(200);
    expect((await api('GET', 'me', admin)).status).toBe(401);
    expect((await api('POST', 'login', undefined, { username: 'cayci', password: 'demlicay123' }, '10.0.2.3')).status).toBe(401);

    const log = await api('GET', 'log', owner);
    const actions = log.body.map((e: { action: string }) => e.action);
    expect(actions).toContain('tv/start');
    expect(actions).toContain('users/remove');
  });

  it('password changes: the owner needs the old one; reset works for admins', async () => {
    const owner = await login('shivass', OWNER_PW, '10.0.3.1');
    await api('POST', 'users', owner, { username: 'garson', password: 'tepsi12345' });
    expect((await api('POST', 'users/garson/password', owner, { password: 'yenisifre99' })).status).toBe(200);
    await login('garson', 'yenisifre99', '10.0.3.2');
    expect((await api('POST', 'users/shivass/password', owner, { oldPassword: 'yanlis-eski', password: 'yepyeni-101' })).status).toBe(400);
    expect((await api('POST', 'users/shivass/password', owner, { oldPassword: OWNER_PW, password: 'yepyeni-101' })).status).toBe(200);
    // still logged in with this session; change it back for the other tests
    expect((await api('POST', 'users/shivass/password', owner, { oldPassword: 'yepyeni-101', password: OWNER_PW })).status).toBe(200);
    await api('DELETE', 'users/garson', owner);
  });

  it('stores only salted scrypt hashes, never the password', () => {
    const raw = readFileSync(staffFile, 'utf8');
    expect(raw).not.toContain(OWNER_PW);
    expect(raw).toMatch(/"passwordHash": ?"scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}"/);
    const log = readFileSync(staffFile.replace(/\.json$/, '-log.jsonl'), 'utf8');
    expect(log).toContain('"action":"login"');
    expect(log).not.toContain(OWNER_PW);
  });

  it('generates a one-time owner password when none is set', () => {
    const lines: string[] = [];
    const orig = console.log;
    console.log = (...a: unknown[]) => void lines.push(a.join(' '));
    try {
      const s = new StaffStore(null);
      const pw = lines.map((l) => l.trim()).find((l) => /^[A-Za-z0-9_-]{12}$/.test(l));
      expect(pw).toBeTruthy();
      expect(s.login('shivass', pw, '1.2.3.4')).toBeTruthy();
    } finally {
      console.log = orig;
    }
  });

  it('salons list, grant, announce and kick reach connected players', async () => {
    const owner = await login('shivass', OWNER_PW, '10.0.4.1');
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Ayşe', device: 'ab'.repeat(16) });
    const b = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Mehmet', device: 'cd'.repeat(16) });
    await until(() => (a.room.state as any).players?.size === 2);
    const salons = await api('GET', 'salons', owner);
    const salon = (salons.body as StaffSalonInfo[]).find((s) => s.roomId === a.room.roomId)!;
    expect(salon.players.map((p) => p.name).sort()).toEqual(['Ayşe', 'Mehmet']);
    expect(salons.text).not.toContain('abababab');

    const before = (a.room.state as any).players.get(a.id).money as number;
    const g = await api('POST', 'wallet/grant', owner, { roomId: a.room.roomId, sessionId: a.id, amount: 250 });
    expect(g.body).toMatchObject({ ok: true, money: before + 250 });
    await until(() => (a.room.state as any).players.get(a.id).money === before + 250);
    // clamped to the per-grant limit, never below zero
    const take = await api('POST', 'wallet/grant', owner, { roomId: a.room.roomId, sessionId: a.id, amount: -10_000_000 });
    expect(take.body.money).toBe(0);
    expect(take.body.amount).toBe(-100_000);

    expect((await api('POST', 'announce', owner, { text: 'x'.repeat(141) })).status).toBe(400);
    expect((await api('POST', 'announce', owner, { text: 'Bu akşam turnuva var!' })).status).toBe(200);
    await until(() => b.messages.some((m) => m.type === KMSG.announce));
    expect(b.messages.find((m) => m.type === KMSG.announce)!.msg).toBe('📢 Duyuru: Bu akşam turnuva var!');

    let code = 0;
    b.room.onLeave((c) => (code = c));
    expect((await api('POST', `salons/${a.room.roomId}/kick`, owner, { sessionId: b.id })).status).toBe(200);
    await until(() => code !== 0);
    expect(code).toBe(STAFF_KICK_CODE);
    await until(() => (a.room.state as any).players.size === 1);
    // the kicked device cannot come back to this salon
    await expect(new NetBot(endpoint).join(a.room.roomId, { name: 'Mehmet', device: 'cd'.repeat(16) })).rejects.toThrow();
    await a.leave();
  });
});

describe('TV channels (real streams)', () => {
  it('owner adds, lists and deletes channels; admins get 403 on channel routes; links are validated', async () => {
    const owner = await login('shivass', OWNER_PW, '10.0.5.1');
    await api('POST', 'users', owner, { username: 'ocakci', password: 'semaver123' });
    const admin = await login('ocakci', 'semaver123', '10.0.5.2');
    for (const [m, route, body] of [
      ['GET', 'channels'],
      ['POST', 'channels', { title: 'X', url: 'https://cdn.example.com/a.mp4' }],
      ['DELETE', 'channels/abc'],
    ] as [string, string, unknown?][])
      expect((await api(m, route, admin, body)).status, route).toBe(403);

    for (const bad of [
      { title: 'Derbi', url: 'http://cdn.example.com/a.mp4' },
      { title: 'Derbi', url: 'javascript:alert(1)' },
      { title: 'Derbi', url: 'data:video/mp4;base64,AAAA' },
      { title: 'Derbi', url: `https://cdn.example.com/${'a'.repeat(500)}.mp4` },
      { title: 'x'.repeat(61), url: 'https://cdn.example.com/a.mp4' },
      { title: '', url: 'https://cdn.example.com/a.mp4' },
    ])
      expect((await api('POST', 'channels', owner, bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(400);

    const vid = await api('POST', 'channels', owner, { title: 'Derbi: GS–FB', url: 'https://cdn.example.com/live/index.m3u8' });
    expect(vid.status).toBe(200);
    expect(vid.body).toMatchObject({ title: 'Derbi: GS–FB', url: 'https://cdn.example.com/live/index.m3u8', type: 'video', createdBy: 'shivass' });
    const yt = await api('POST', 'channels', owner, { title: 'Maç özeti', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(yt.body).toMatchObject({ type: 'embed', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1' });
    const list = await api('GET', 'channels', owner);
    expect(list.body.map((c: { title: string }) => c.title)).toEqual(['Derbi: GS–FB', 'Maç özeti']);
    // persisted next to the staff accounts
    expect(readFileSync(staffFile, 'utf8')).toContain('cdn.example.com/live/index.m3u8');
    expect(new StaffStore(staffFile, { ownerPassword: OWNER_PW }).listChannels()).toHaveLength(2);

    // admins see the channels by title, without links
    const tv = await api('GET', 'tv', admin);
    expect(tv.body.channels).toEqual([
      { id: vid.body.id, title: 'Derbi: GS–FB', type: 'video' },
      { id: yt.body.id, title: 'Maç özeti', type: 'embed' },
    ]);
    expect(tv.text).not.toContain('example.com');

    expect((await api('DELETE', `channels/${yt.body.id}`, owner)).status).toBe(200);
    expect((await api('DELETE', `channels/${yt.body.id}`, owner)).status).toBe(404);
    expect((await api('GET', 'channels', owner)).body).toHaveLength(1);
    const actions = (await api('GET', 'log', owner)).body.map((e: { action: string }) => e.action);
    expect(actions).toContain('channels/add');
    expect(actions).toContain('channels/remove');
  });

  it('an admin puts a channel on air by id (never a raw link); joined clients get the stream; stop works', async () => {
    const owner = await login('shivass', OWNER_PW, '10.0.6.1');
    const admin = await login('ocakci', 'semaver123', '10.0.6.2');
    const ch = (await api('POST', 'channels', owner, { title: 'Canlı derbi', url: 'https://cdn.example.com/derbi.mp4' })).body;
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Seyirci' });
    await until(() => !!(a.room.state as any).players?.get(a.id));

    expect((await api('POST', 'tv/start', admin, { url: 'https://evil.example.com/a.mp4' })).status).toBe(400);
    expect((await api('POST', 'tv/start', admin, { channelId: ch.id, url: 'https://evil.example.com/a.mp4' })).status).toBe(400);
    expect((await api('POST', 'tv/start', admin, { channelId: 'nope' })).status).toBe(404);
    expect(server.tv.current()).toBeNull();

    const start = await api('POST', 'tv/start', admin, { channelId: ch.id });
    expect(start.status).toBe(200);
    expect(start.body.current).toMatchObject({ kind: 'stream', title: 'Canlı derbi', url: 'https://cdn.example.com/derbi.mp4', streamType: 'video', by: 'ocakci' });
    const tvOf = () => {
      const s = (a.room.state as { tv?: string }).tv;
      return s ? JSON.parse(s) : null;
    };
    await until(() => tvOf()?.kind === 'stream');
    expect(tvOf()).toMatchObject({ kind: 'stream', url: 'https://cdn.example.com/derbi.mp4', title: 'Canlı derbi', streamType: 'video' });

    // a stream does not expire on its own like a simulated derby
    const cur = server.tv.current()!;
    cur.startedAt -= 24 * 3600_000;
    expect(server.tv.current()).not.toBeNull();

    expect((await api('POST', 'tv/stop', admin)).status).toBe(200);
    await until(() => tvOf() === null);
    expect(server.tv.current()).toBeNull();
    const log = (await api('GET', 'log', owner)).body as { action: string; detail?: string }[];
    expect(log.find((e) => e.action === 'tv/start')?.detail).toContain('Canlı derbi');
    await a.leave();
    await api('DELETE', 'users/ocakci', owner);
  });
});
