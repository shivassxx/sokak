import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from './netBot';
import { KAHVE_ROOM, type TvBroadcast } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { until } from './helpers';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1' });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const tvOf = (b: NetBot): TvBroadcast | null => {
  const s = (b.room.state as { tv?: string }).tv;
  return s ? (JSON.parse(s) as TvBroadcast) : null;
};

describe('kıraathane TV', () => {
  it('starting and stopping the channel reaches joined clients, late joiners see the running derby', async () => {
    const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name: 'Seyirci' });
    await until(() => !!(a.room.state as any).players?.get(a.id));
    expect(tvOf(a)).toBeNull();

    expect(server.tv.start('sarikirmizi', 'sarikirmizi', 'test')).toBeNull();
    const b = server.tv.start('sarikirmizi', 'sarilacivert', 'test')!;
    expect(b).not.toBeNull();
    await until(() => tvOf(a)?.id === b.id);
    expect(tvOf(a)).toEqual(b);

    // a late joiner in the same salon gets the running broadcast with the first state
    const late = await new NetBot(endpoint).join(a.room.roomId, { name: 'Gecikmeli' });
    await until(() => !!(late.room.state as any).players?.get(late.id));
    expect(tvOf(late)).toEqual(b);

    // a salon created after the kick-off gets it too
    const other = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Başka', private: true });
    await until(() => !!(other.room.state as any).players?.get(other.id));
    expect(tvOf(other)?.id).toBe(b.id);

    server.tv.stop();
    await until(() => tvOf(a) === null && tvOf(late) === null && tvOf(other) === null);

    await Promise.all([a.leave(), late.leave(), other.leave()]);
  });

  it('disposed rooms unsubscribe from the channel', async () => {
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Tek', private: true });
    const roomId = a.room.roomId;
    await until(() => !!matchMaker.getLocalRoomById(roomId));
    await a.leave();
    await until(() => !matchMaker.getLocalRoomById(roomId));
    // no listener left on a disposed room: starting a broadcast must not throw
    expect(() => server.tv.start('siyahbeyaz', 'bordomavi', 'test')).not.toThrow();
    server.tv.stop();
    const listeners = (server.tv as unknown as { listeners: Set<unknown> }).listeners;
    const rooms = await matchMaker.query({ name: KAHVE_ROOM });
    expect(listeners.size).toBe(rooms.length);
  });
});
