import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { KAHVE_ROOM, KMSG, type FriendReqMsg, type FriendsView } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { until } from './helpers';

let server: StartedServer;
let endpoint: string;
let http: string;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1' });
  endpoint = `ws://127.0.0.1:${server.port}`;
  http = `http://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const friends = async (device: string) => (await (await fetch(`${http}/api/friends?device=${device}`)).json()) as FriendsView;
const got = (b: NetBot, type: string) => b.messages.filter((m) => m.type === type);

describe('arkadaşlar', () => {
  it('a request, then the answer makes mutual friends who see each other’s salon; removing ends it both ways', async () => {
    const da = 'd1'.repeat(16);
    const db = 'd2'.repeat(16);
    const a = await new NetBot(endpoint).create(KAHVE_ROOM, { name: 'Ali', device: da });
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Veli', device: db });
    await until(() => (a.room.state as any).players.size === 2);

    a.room.send(KMSG.friendAdd, { id: b.id });
    await until(() => got(b, KMSG.friendReq).length === 1);
    expect(got(b, KMSG.friendReq)[0]!.msg as FriendReqMsg).toEqual({ from: a.id, name: 'Ali' });
    // one-sided: Veli sees a request with a name only, Ali sees nothing yet
    const fb = await friends(db);
    expect(fb.incoming.map((r) => r.name)).toEqual(['Ali']);
    expect(fb.friends).toEqual([]);
    expect((await friends(da)).friends).toEqual([]);

    b.room.send(KMSG.friendAdd, { id: a.id });
    await until(() => got(a, KMSG.friendUpdate).length === 1 && got(b, KMSG.friendUpdate).length === 1);
    const fa = await friends(da);
    expect(fa.friends).toHaveLength(1);
    expect(fa.friends[0]).toMatchObject({ name: 'Veli', online: { roomId: a.room.roomId } });
    expect((await friends(db)).incoming).toEqual([]);
    // tokens never appear in the answer
    expect(JSON.stringify(fa)).not.toContain(db);

    // Veli leaves: offline for Ali
    await b.leave();
    await new Promise((r) => setTimeout(r, 300));
    expect((await friends(da)).friends[0]!.online).toBeNull();

    const r = await fetch(`${http}/api/friends/remove`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ device: da, code: fa.friends[0]!.code }) });
    expect(((await r.json()) as { ok: boolean }).ok).toBe(true);
    expect((await friends(da)).friends).toEqual([]);
    expect((await friends(db)).friends).toEqual([]);
    expect(await (await fetch(`${http}/api/friends?device=nope`)).json()).toBeNull();
    await a.leave();
  }, 15000);
});
