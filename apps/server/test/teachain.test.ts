import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KAHVE_ROOM, KMSG, MENU, type ServedMsg } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1' });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const served = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.served).map((m) => m.msg as ServedMsg);

describe('çay zinciri', () => {
  it('a round for the whole salon reaches everyone; another player answering adds a link, the same one does not', async () => {
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Ali' });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Veli' });
    const c = await new NetBot(endpoint).join(a.room.roomId, { name: 'Ayse' });
    await until(() => st(a).players.size === 3);
    const price = MENU.find((m) => m.id === 'cay')!.price;
    const money0 = st(a).players.get(a.id).money as number;

    a.room.send(KMSG.order, { item: 'cay', to: 'all' });
    await until(() => served(c).length === 1);
    expect(served(c)[0]).toMatchObject({ from: a.id, item: 'cay', chain: 1 });
    expect([...served(c)[0]!.to].sort()).toEqual([a.id, b.id, c.id].sort());
    await until(() => st(a).players.get(a.id).money === money0 - 3 * price);

    await sleep(1600); // the order throttle
    a.room.send(KMSG.order, { item: 'cay', to: 'all' });
    await until(() => served(c).length === 2);
    expect(served(c)[1]!.chain).toBe(1);

    b.room.send(KMSG.order, { item: 'cay', to: 'all' });
    await until(() => served(c).length === 3);
    expect(served(c)[2]!.chain).toBe(2);
    // an ordinary order is no part of the chain
    c.room.send(KMSG.order, { item: 'cay', to: c.id });
    await until(() => served(a).length === 4);
    expect(served(a)[3]!.chain).toBeUndefined();
    await Promise.all([a.leave(), b.leave(), c.leave()]);
  }, 15000);
});
