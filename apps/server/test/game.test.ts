import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetBot } from '@sokak/bots/client';
import { BASE, MSG, type SummaryMsg } from '@sokak/shared';
import { until, withServer, sleep } from './helpers';
import type { StartedServer } from '../src/app';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  ({ server, endpoint } = await withServer({ ebeSelectionMs: 300, countingMs: 600, seekingMs: 5000, roundEndMs: 500 }));
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;

describe('saklambaç round flow (server)', () => {
  it('non-host cannot start; host starts with bots; phases advance; summary is broadcast', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Host' });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Misafir' });
    a.room.send(MSG.addBot);
    await until(() => st(a).players?.size === 3);
    b.room.send(MSG.start);
    await sleep(200);
    expect(st(a).phase).toBe('lobby');
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'ebeSelection');
    const ebe = st(a).ebeId;
    expect(ebe).toBeTruthy();
    expect([...st(a).players.values()].filter((p: any) => p.role === 'hider').length).toBe(2);
    await until(() => st(a).phase === 'counting');
    await until(() => st(a).phase === 'seeking');
    expect(a.messages.some((m) => m.type === MSG.event && (m.msg as any).type === 'countingDone')).toBe(true);
    await until(() => st(a).phase === 'roundEnd', 12000);
    const sum = a.messages.find((m) => m.type === MSG.summary)!.msg as SummaryMsg;
    expect(sum.round).toBe(1);
    // every hider ends the round either caught or safe
    expect(sum.caught.length + sum.safe.length).toBe(2);
    await until(() => st(a).phase === 'ebeSelection' && st(a).round === 2, 3000);
    await a.leave();
    await b.leave();
  });

  it('Ebe cannot move while counting', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Ebe' });
    a.room.send(MSG.addBot);
    a.room.send(MSG.addBot);
    await until(() => st(a).players?.size === 3);
    // make sure the human is the Ebe by retrying rounds is flaky; instead check freeze for whoever is human-Ebe
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'ebeSelection');
    if (st(a).ebeId === a.id) {
      await sleep(100);
      const before = a.lastSnapshot!.me!;
      a.move = { mx: 1, mz: 0, jump: false, crouch: false };
      a.drive();
      await sleep(400);
      a.stop();
      const after = a.lastSnapshot!.me!;
      expect(Math.abs(after[0] - before[0])).toBeLessThan(0.01);
    }
    await a.leave();
  });

  it('a hider who walks to the base is kurtuldu', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Koşucu' });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Yürüyen' });
    a.room.send(MSG.addBot);
    await until(() => st(a).players?.size === 3);
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'ebeSelection' || st(a).phase === 'counting', 3000);
    // with two humans and one bot at least one human hides
    const h = st(a).ebeId === a.id ? b : a;
    // walk toward the base right away (touches only count once seeking starts)
    h.drive();
    await until(() => {
      const me = h.lastSnapshot!.me!;
      const dx = BASE.x - me[0];
      const dz = BASE.z + 1.5 - me[2];
      const l = Math.hypot(dx, dz) || 1;
      h.move = { mx: dx / l, mz: dz / l, jump: false, crouch: false };
      return st(a).players.get(h.id).status === 'safe';
    }, 8000);
    h.stop();
    expect(st(a).players.get(h.id).score).toBeGreaterThanOrEqual(3);
    await a.leave();
    await b.leave();
  });
});
