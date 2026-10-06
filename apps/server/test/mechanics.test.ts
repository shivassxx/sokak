import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from '@sokak/bots/client';
import { CONTAINERS, MSG, type PebbleMsg } from '@sokak/shared';
import { until, withServer, sleep } from './helpers';
import type { StartedServer } from '../src/app';
import type { SaklambacRoom } from '../src/rooms/SaklambacRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  ({ server, endpoint } = await withServer({ ebeSelectionMs: 200, countingMs: 400, seekingMs: 30000, roundEndMs: 2000 }));
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const seen = (viewer: NetBot, id: string) => !!viewer.lastSnapshot?.p.some((p) => p[0] === id);

async function seekingRound() {
  const a = await new NetBot(endpoint).create({ name: 'Aa' });
  const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Bb' });
  const c = await new NetBot(endpoint).join(a.room.roomId, { name: 'Cc' });
  const all = [a, b, c];
  await until(() => st(a).players?.size === 3);
  const room = matchMaker.getLocalRoomById(a.room.roomId) as SaklambacRoom;
  a.room.send(MSG.start);
  await until(() => st(a).phase === 'seeking', 3000);
  const ebe = all.find((x) => x.id === st(a).ebeId)!;
  const [h1, h2] = all.filter((x) => x !== ebe) as [NetBot, NetBot];
  return { a, all, room, ebe, h1, h2 };
}

describe('new mechanics', () => {
  it('sprint is applied on the server and reported in the snapshot', async () => {
    const { all, room, h1 } = await seekingRound();
    room.debugPlace(h1.id, 0, 30);
    await sleep(100);
    const x0 = h1.lastSnapshot!.me![0];
    h1.move = { mx: 1, mz: 0, jump: false, crouch: false, sprint: true } as any;
    h1.drive();
    await sleep(1000);
    h1.stop();
    await sleep(150);
    const me = h1.lastSnapshot!.me!;
    expect(me[0] - x0).toBeGreaterThan(5.5); // faster than walking
    expect(me[5]).toBeLessThan(1); // stamina used
    for (const x of all) await x.leave();
  });

  it('çöp konteyneri: hide inside, invisible to everyone, found when the Ebe lifts the lid', async () => {
    const { all, room, ebe, h1, h2 } = await seekingRound();
    const c = CONTAINERS[0]!;
    room.debugPlace(h1.id, c.x, c.z + c.d / 2 + 0.6);
    room.debugPlace(ebe.id, c.x, c.z + 9);
    room.debugPlace(h2.id, c.x + 3, c.z + 5);
    await sleep(100);
    h1.room.send(MSG.interact);
    await until(() => room.debugSim(h1.id)!.inside === 0);
    await sleep(400);
    expect(h1.lastSnapshot!.me![7]).toBe(0);
    expect(seen(ebe, h1.id)).toBe(false);
    expect(seen(h2, h1.id)).toBe(false);
    // Gördüm from far away does nothing
    ebe.room.send(MSG.spot);
    await sleep(350);
    expect(st(ebe).players.get(h1.id).status).toBe('hiding');
    // next to the container: lid opens, hider is out and spotted
    room.debugPlace(ebe.id, c.x, c.z + c.d / 2 + 1.2);
    await sleep(100);
    ebe.room.send(MSG.spot);
    await until(() => st(ebe).players.get(h1.id).status === 'spotted');
    expect(room.debugSim(h1.id)!.inside).toBe(-1);
    for (const x of all) await x.leave();
  });

  it('pebble: broadcast landing spot, Ebe hears a direction, cooldown applies', async () => {
    const { all, room, ebe, h1 } = await seekingRound();
    room.debugPlace(h1.id, -30, 30);
    room.debugPlace(ebe.id, -30, 45);
    await sleep(100);
    h1.room.send(MSG.throwPebble);
    await until(() => ebe.messages.some((m) => m.type === MSG.pebble));
    const p = ebe.messages.find((m) => m.type === MSG.pebble)!.msg as PebbleMsg;
    expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
    h1.room.send(MSG.throwPebble);
    await sleep(300);
    expect(ebe.messages.filter((m) => m.type === MSG.pebble).length).toBe(1);
    for (const x of all) await x.leave();
  });

  it('Ebe hears a running hider it cannot see; hiders feel the Ebe nearby', async () => {
    const { all, room, ebe, h1, h2 } = await seekingRound();
    // ebe on one side of the Ebe wall, hider runs behind it
    room.debugPlace(ebe.id, 0, 1.5);
    room.debugPlace(h1.id, -3, -6);
    room.debugPlace(h2.id, 40, 40);
    await sleep(100);
    h1.move = { mx: 1, mz: 0, jump: false, crouch: false, sprint: true } as any;
    h1.drive();
    let heard = false;
    await until(() => {
      if (ebe.lastSnapshot?.n?.length) heard = true;
      return heard;
    }, 3000);
    h1.stop();
    expect(heard).toBe(true);
    expect(h1.lastSnapshot!.e ?? 0).toBeGreaterThan(0.3);
    expect(h2.lastSnapshot!.e ?? 0).toBe(0);
    for (const x of all) await x.leave();
  });
});
