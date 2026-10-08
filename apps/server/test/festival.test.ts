import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { KAHVE_ROOM, KMSG, festivalById } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { NetBot } from './netBot';
import { until } from './helpers';

const OWNER_PW = 'bayram-harcligi';
let server: StartedServer;
let base: string;
let endpoint: string;

beforeAll(async () => {
  const staffFile = path.join(mkdtempSync(path.join(tmpdir(), 'sokak-fest-')), 'staff.json');
  server = await startServer(0, { host: '127.0.0.1', staffFile, ownerPassword: OWNER_PW });
  base = `http://127.0.0.1:${server.port}/api/admin`;
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

async function api(method: string, route: string, token?: string, body?: unknown) {
  const headers: Record<string, string> = { 'x-forwarded-for': '10.7.0.1' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${base}/${route}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, cookie: res.headers.get('set-cookie') ?? '' };
}
async function login(username: string, password: string): Promise<string> {
  const r = await api('POST', 'login', undefined, { username, password });
  expect(r.status).toBe(200);
  return /sokak_staff=([a-f0-9]{64})/.exec(r.cookie)![1]!;
}

const st = (b: NetBot) => b.room.state as any;
const notices = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.notice).map((m) => String(m.msg));

describe('mevsimlik olaylar', () => {
  it('the owner puts a bayram on; every device gets its harçlık once; admins cannot change it', async () => {
    const owner = await login('shivass', OWNER_PW);
    expect((await api('POST', 'users', owner, { username: 'cayci', password: 'demlicay123' })).status).toBe(200);
    const admin = await login('cayci', 'demlicay123');
    expect((await api('POST', 'festival', admin, { id: 'kurbanBayrami' })).status).toBe(403);
    expect((await api('GET', 'festival', admin)).status).toBe(403);
    expect((await api('POST', 'festival', owner, { id: 'nope' })).status).toBe(400);
    const set = await api('POST', 'festival', owner, { id: 'kurbanBayrami' });
    expect(set.status).toBe(200);
    expect(set.body.current).toBe('kurbanBayrami');

    const gift = festivalById('kurbanBayrami')!.gift;
    const device = 'fe'.repeat(16);
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Bayramci', device });
    await until(() => st(a).festival === 'kurbanBayrami');
    const start = st(a).players.get(a.id).money as number;
    await until(() => notices(a).some((n) => n.includes('Kurban Bayramınız')), 6000);
    expect(notices(a).find((n) => n.includes('Kurban'))).toContain(`+${gift} ₺`);
    // the gift is already in the money the player starts with (paid on join)
    const w1 = server.wallets.get(device)!;
    expect(w1.money).toBe(start);
    expect(w1.gifts?.some((k) => k.startsWith('kurbanBayrami:'))).toBe(true);
    // a second tab of the same device: greeted, no second harçlık
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Bayramci2', device });
    await until(() => notices(b).some((n) => n.includes('Kurban')), 6000);
    expect(notices(b).find((n) => n.includes('Kurban'))).not.toContain('₺');
    expect(server.wallets.get(device)!.money).toBe(start);

    // switched off: the salon takes the decorations down within a few seconds
    expect((await api('POST', 'festival', owner, { id: 'none' })).body.current).toBeNull();
    await until(() => st(a).festival === '', 8000);
    const auto = await api('POST', 'festival', owner, { id: 'auto' });
    expect(auto.body.manual).toBeNull();
    await a.leave();
    await b.leave();
  }, 20000);
});
