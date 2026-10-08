import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KAHVE_ROOM, KMSG, tourPrizes, type TourView } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { until } from './helpers';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 200, result: 300, turn: 400 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const tour = (b: NetBot): TourView | null => (st(b).tour ? (JSON.parse(st(b).tour) as TourView) : null);
const money = (b: NetBot) => st(b).players.get(b.id).money as number;

describe('okey turnuvası', () => {
  it('entry fees make the pool; semis, then the final; prizes only to people; nothing is printed', async () => {
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Ali', device: 'f1'.repeat(16) });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Veli', device: 'f2'.repeat(16) });
    await until(() => st(a).players.size === 2);
    const a0 = money(a);
    const b0 = money(b);

    b.room.send(KMSG.tourJoin); // nothing to join yet
    a.room.send(KMSG.tourOpen, { fee: 100 });
    await until(() => tour(a)?.phase === 'open');
    b.room.send(KMSG.tourJoin);
    await until(() => tour(a)?.entrants.length === 2);
    expect(tour(a)!.pool).toBe(200);
    await until(() => money(a) === a0 - 100 && money(b) === b0 - 100);
    // leaving before the start gives the fee back; joining again pays again
    b.room.send(KMSG.tourLeave);
    await until(() => tour(a)?.entrants.length === 1 && money(b) === b0);
    b.room.send(KMSG.tourJoin);
    await until(() => tour(a)?.entrants.length === 2);

    b.room.send(KMSG.tourStart); // only the host starts
    a.room.send(KMSG.tourStart);
    await until(() => tour(a)?.phase === 'semis');
    const semis = tour(a)!.semis;
    expect(semis).toHaveLength(2);
    expect(semis.flatMap((x) => x.players).filter((p) => !p.bot).map((p) => p.name).sort()).toEqual(['Ali', 'Veli']);
    expect(semis.flatMap((x) => x.players)).toHaveLength(8);
    await until(() => tour(a)?.phase === 'final', 60000);
    expect(tour(a)!.final!.players).toHaveLength(4);
    await until(() => tour(a)?.phase === 'done', 60000);
    const v = tour(a)!;
    expect(v.podium).toHaveLength(4);
    const prizes = tourPrizes(200);
    // people get their place's prize, bots nothing
    v.podium.forEach((p, i) => expect(p.prize).toBe(p.bot || i > 2 ? 0 : prizes[i]));
    const paid = v.podium.reduce((s, p) => s + p.prize, 0);
    expect(paid).toBeLessThanOrEqual(200);
    // a new one can be opened afterwards
    b.room.send(KMSG.tourOpen, { fee: 0 });
    await until(() => tour(a)?.phase === 'open' && tour(a)?.host === b.id, 20000);
    await Promise.all([a.leave(), b.leave()]);
  }, 90000);
});
