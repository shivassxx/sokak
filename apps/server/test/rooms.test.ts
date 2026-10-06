import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetBot } from '@sokak/bots/client';
import { MSG } from '@sokak/shared';
import { until, withServer, sleep } from './helpers';
import type { StartedServer } from '../src/app';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  ({ server, endpoint } = await withServer());
});
afterAll(async () => {
  await server.close();
});

describe('rooms', () => {
  it('creates a room with an unguessable id and lets a friend join by id', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Ayşe', color: '#3498db' });
    expect(a.room.roomId).toMatch(/^[A-Za-z0-9]{12}$/);
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Mehmet' });
    await until(() => (a.room.state as any).players.size === 2);
    const pa = (a.room.state as any).players.get(a.id);
    expect(pa.name).toBe('Ayşe');
    expect(pa.color).toBe('#3498db');
    expect((a.room.state as any).hostId).toBe(a.id);
    await a.leave();
    await b.leave();
  });

  it('syncs movement between clients', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Ali' });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Veli' });
    await until(() => !!b.lastSnapshot && b.lastSnapshot.p.some((p) => p[0] === a.id));
    const before = b.lastSnapshot!.p.find((p) => p[0] === a.id)!;
    a.move = { mx: 1, mz: 0, jump: false, crouch: false };
    a.drive();
    await sleep(600);
    a.stop();
    await sleep(150);
    const after = b.lastSnapshot!.p.find((p) => p[0] === a.id)!;
    expect(after[1] - before[1]).toBeGreaterThan(1.5);
    expect(a.lastSnapshot!.a).toBeGreaterThan(5);
    await a.leave();
    await b.leave();
  });

  it('host can add bots and bots wander', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Host' });
    a.room.send(MSG.addBot);
    a.room.send(MSG.addBot);
    await until(() => (a.room.state as any).players?.size === 3);
    await until(() => (a.lastSnapshot?.p.length ?? 0) === 2);
    const first = a.lastSnapshot!.p.map((p) => [p[1], p[3]]);
    await sleep(4000);
    const later = a.lastSnapshot!.p.map((p) => [p[1], p[3]]);
    const moved = later.some((l, i) => Math.hypot(l[0]! - first[i]![0]!, l[1]! - first[i]![1]!) > 1);
    expect(moved).toBe(true);
    await a.leave();
  });

  it('keeps the slot during the reconnect window', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Zeynep' });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Can' });
    const token = b.room.reconnectionToken;
    const bid = b.id;
    await b.leave(false);
    await until(() => (a.room.state as any).players.get(bid)?.connected === false);
    const b2 = await new NetBot(endpoint).reconnect(token);
    expect(b2.id).toBe(bid);
    await until(() => (a.room.state as any).players.get(bid)?.connected === true);
    await a.leave();
    await b2.leave();
  });

  it('sanitizes nicknames and colors', async () => {
    const a = await new NetBot(endpoint).create({ name: '<script>x', color: 'red' });
    await until(() => !!(a.room.state as any).players?.get(a.id));
    const p = (a.room.state as any).players.get(a.id);
    expect(p.name).toBe('scriptx');
    expect(p.color).toBe('#e74c3c');
    await a.leave();
  });
});
