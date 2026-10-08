import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { KAHVE_ROOM, KMSG, TABLES } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  // slow bots: the match must still be running when the "restart" comes
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 4000, botMax: 5000, turn: 60000 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;

describe('server restart', () => {
  it('a running match is called off and the player gets the bet back, saved in the wallet', async () => {
    const device = 'c0'.repeat(16);
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Yolcu', device });
    await until(() => !!st(a).players?.get(a.id));
    const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
    room.debugPlace(a.id, TABLES[1]!.x, TABLES[1]!.z + 2);
    await sleep(80);
    a.room.send(KMSG.sit, { table: 1, seat: 0 });
    await until(() => st(a).players.get(a.id).table === 1);
    a.room.send(KMSG.tableConfig, { bet: 100, hands: 3 });
    for (let i = 0; i < 3; i++) a.room.send(KMSG.tableBot, {});
    await until(() => [...st(a).tables[1].seats].every((s: string) => s));
    const before = st(a).players.get(a.id).money as number;
    a.room.send(KMSG.tableStart);
    await until(() => st(a).tables[1].status === 'playing');
    await until(() => st(a).players.get(a.id).money === before - 100);
    expect(st(a).tables[1].pot).toBe(400);

    room.onBeforeShutdown();
    await until(() => a.messages.some((m) => m.type === KMSG.notice && String(m.msg).includes('iade')));
    expect(server.wallets.get(device)!.money).toBe(before);
  }, 20000);
});
