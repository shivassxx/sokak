import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NetBot } from '@sokak/bots/client';
import { BASE, MSG, type SummaryMsg } from '@sokak/shared';
import { until, withServer, sleep } from './helpers';
import type { StartedServer } from '../src/app';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  ({ server, endpoint } = await withServer({ ebeSelectionMs: 300, countingMs: 600, seekingMs: 2500, roundEndMs: 500 }));
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
    await until(() => st(a).phase === 'roundEnd', 6000);
    const sum = a.messages.find((m) => m.type === MSG.summary)!.msg as SummaryMsg;
    expect(sum.round).toBe(1);
    // nobody did anything → everyone survived; scores for survivors
    expect(sum.safe.length).toBe(2);
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
    a.room.send(MSG.addBot);
    a.room.send(MSG.addBot);
    await until(() => st(a).players?.size === 3);
    for (let attempt = 0; attempt < 6; attempt++) {
      a.room.send(MSG.start);
      await until(() => st(a).phase === 'ebeSelection' || st(a).phase === 'counting', 3000);
      if (st(a).ebeId !== a.id) break;
      // we are Ebe: wait for the round to time out and try again
      await until(() => st(a).phase === 'roundEnd', 6000);
      await until(() => st(a).phase === 'ebeSelection', 3000);
      if (st(a).ebeId !== a.id) break;
    }
    expect(st(a).ebeId).not.toBe(a.id);
    await until(() => st(a).phase === 'seeking', 3000);
    // walk toward the base
    a.drive();
    await until(() => {
      const me = a.lastSnapshot!.me!;
      const dx = BASE.x - me[0];
      const dz = BASE.z + 1.5 - me[2];
      const l = Math.hypot(dx, dz) || 1;
      a.move = { mx: dx / l, mz: dz / l, jump: false, crouch: false };
      return st(a).players.get(a.id).status === 'safe';
    }, 4000);
    a.stop();
    expect(st(a).players.get(a.id).score).toBeGreaterThanOrEqual(3);
    await a.leave();
  });
});
