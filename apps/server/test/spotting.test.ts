import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from '@sokak/bots/client';
import { MSG } from '@sokak/shared';
import { until, withServer, sleep } from './helpers';
import type { StartedServer } from '../src/app';
import type { SaklambacRoom } from '../src/rooms/SaklambacRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  ({ server, endpoint } = await withServer({ ebeSelectionMs: 200, countingMs: 400, seekingMs: 20000, roundEndMs: 2000 }));
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const seen = (viewer: NetBot, id: string) => !!viewer.lastSnapshot?.p.some((p) => p[0] === id);

async function threeHumans() {
  const a = await new NetBot(endpoint).create({ name: 'Aa' });
  const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Bb' });
  const c = await new NetBot(endpoint).join(a.room.roomId, { name: 'Cc' });
  const all = [a, b, c];
  await until(() => st(a).players?.size === 3);
  const room = matchMaker.getLocalRoomById(a.room.roomId) as SaklambacRoom;
  return { a, all, room };
}

describe('M4: visibility filtering & Gördüm!', () => {
  it('Ebe receives no hider positions while counting', async () => {
    const { a, all } = await threeHumans();
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'counting');
    const ebe = all.find((x) => x.id === st(a).ebeId)!;
    const hiders = all.filter((x) => x !== ebe);
    await sleep(150);
    for (const h of hiders) expect(seen(ebe, h.id)).toBe(false);
    // hiders still see each other and the Ebe
    expect(seen(hiders[0]!, hiders[1]!.id)).toBe(true);
    expect(seen(hiders[0]!, ebe.id)).toBe(true);
    for (const x of all) await x.leave();
  });

  it('filters by line of sight, validates Gördüm!, race to base → sobelendi', async () => {
    const { a, all, room } = await threeHumans();
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'seeking', 3000);
    const ebe = all.find((x) => x.id === st(a).ebeId)!;
    const [h1, h2] = all.filter((x) => x !== ebe) as [NetBot, NetBot];
    // Ebe in the plaza; h1 in open view; h2 behind the Ebe wall
    room.debugPlace(ebe.id, 0, 8);
    room.debugPlace(h1.id, 0, 14);
    room.debugPlace(h2.id, 0, -6, true);
    await sleep(500);
    expect(seen(ebe, h1.id)).toBe(true);
    expect(seen(ebe, h2.id)).toBe(false);

    // Gördüm! spots the visible one only
    ebe.room.send(MSG.spot);
    await until(() => st(a).players.get(h1.id).status === 'spotted');
    expect(st(a).players.get(h2.id).status).toBe('hiding');

    // Ebe reaches the base first → sobe
    room.debugPlace(ebe.id, 0, 0.5);
    await until(() => st(a).players.get(h1.id).status === 'caught');
    expect(st(a).players.get(ebe.id).score).toBe(2);

    // Gördüm! from the base is refused
    room.debugPlace(h2.id, 0, 4);
    await sleep(350);
    ebe.room.send(MSG.spot);
    await until(() => ebe.messages.some((m) => m.type === MSG.event && (m.msg as any).type === 'spotMiss'));
    expect(st(a).players.get(h2.id).status).toBe('hiding');

    // only the Ebe can spot
    room.debugPlace(ebe.id, 0, 9);
    h1.room.send(MSG.spot);
    await sleep(350);
    expect(st(a).players.get(h2.id).status).toBe('hiding');

    // last hider sneaks to base → herkes kurtuldu
    room.debugPlace(h2.id, 0, 1);
    await until(() => st(a).phase === 'roundEnd');
    expect(st(a).players.get(h1.id).status).toBe('safe');
    expect(a.messages.some((m) => m.type === MSG.event && (m.msg as any).type === 'herkesKurtuldu')).toBe(true);
    for (const x of all) await x.leave();
  });

  it('out of range hiders are not sent to the Ebe', async () => {
    const { a, all, room } = await threeHumans();
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'seeking', 3000);
    const ebe = all.find((x) => x.id === st(a).ebeId)!;
    const [h1] = all.filter((x) => x !== ebe) as [NetBot];
    room.debugPlace(ebe.id, -40, 3);
    room.debugPlace(h1.id, 10, 3);
    await sleep(400);
    expect(seen(ebe, h1.id)).toBe(false);
    for (const x of all) await x.leave();
  });

  it('bots play a full round on their own (hide, seek, spot, race)', async () => {
    const a = await new NetBot(endpoint).create({ name: 'Izleyici' });
    for (let i = 0; i < 5; i++) a.room.send(MSG.addBot);
    await until(() => st(a).players?.size === 6);
    a.room.send(MSG.start);
    await until(() => st(a).phase === 'seeking', 3000);
    // let the human sit at a far corner so bots decide the round
    const room = matchMaker.getLocalRoomById(a.room.roomId) as SaklambacRoom;
    if (st(a).ebeId !== a.id) room.debugPlace(a.id, 55, 55, true);
    await until(() => st(a).phase === 'roundEnd', 25000);
    const sum = a.messages.find((m) => m.type === MSG.summary)!.msg as any;
    expect(sum.caught.length + sum.safe.length).toBe(5);
    console.log('bot round:', sum.reason, 'caught', sum.caught.length, 'safe', sum.safe.length, 'events', a.messages.filter((m) => m.type === MSG.event).map((m) => (m.msg as any).type).join(','));
    await a.leave();
  }, 40000);
});
