import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from './netBot';
import {
  BOARD_SPOT,
  KAHVE_ROOM,
  KMSG,
  MSG,
  START_MONEY,
  VAPUR_CYCLE_MS,
  VAPUR_DOCKED_S,
  deckToWorld,
  onDeck,
  vapurState,
  type SnapshotMsg,
} from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;
/** the vapur clock of the room (ms into the timeline): tests move it by hand */
let vt = 5000;
const DOCKED = 5000;
const AT_SEA = (VAPUR_DOCKED_S + 40) * 1000;

beforeAll(async () => {
  server = await startServer(0, { host: '127.0.0.1', kahve: { vapurNow: () => vt } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const errors = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.okeyError).map((m) => m.msg as string);

async function joined(name: string) {
  const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name });
  await until(() => !!st(a).players?.get(a.id));
  const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
  return { a, room };
}

async function atPier(name: string) {
  const r = await joined(name);
  r.room.debugPlace(r.a.id, BOARD_SPOT.x, BOARD_SPOT.z);
  await sleep(60);
  return r;
}

async function aboard(name: string) {
  vt = DOCKED;
  const r = await atPier(name);
  r.a.room.send(KMSG.board);
  await until(() => me(r.a).aboard === true);
  return r;
}

describe('vapur', () => {
  it('cannot board while the vapur is out at sea', async () => {
    vt = AT_SEA;
    const { a } = await atPier('Gezgin');
    a.room.send(KMSG.board);
    await until(() => errors(a).length > 0);
    expect(errors(a)[0]).toMatch(/seferde/);
    expect(me(a).aboard).toBe(false);
    await a.leave();
  });

  it('cannot board from away from the pier', async () => {
    vt = DOCKED;
    const { a, room } = await joined('Uzakta');
    room.debugPlace(a.id, 0, 25);
    await sleep(60);
    a.room.send(KMSG.board);
    await until(() => errors(a).length > 0);
    expect(errors(a)[0]).toMatch(/iskeleye yaklaş/);
    expect(me(a).aboard).toBe(false);
    await a.leave();
  });

  it('boards when docked: on the deck, and the position follows the vapur at sea', async () => {
    const { a, room } = await aboard('Yolcu');
    const deck = room.debugDeck(a.id)!;
    expect(deck).not.toBeNull();
    expect(onDeck(deck.x, deck.z)).toBe(true);
    // my snapshot carries the deck position
    await until(() => a.messages.some((m) => m.type === MSG.snapshot && ((m.msg as SnapshotMsg).me?.length ?? 0) === 10));
    // out at sea the body is the deck spot on the moving boat
    for (const t of [AT_SEA, AT_SEA + 20000, AT_SEA + 45000]) {
      vt = t;
      await sleep(120);
      const w = deckToWorld(vapurState(t), deck.x, deck.z);
      const b = room.debugBody(a.id)!;
      expect(b.x).toBeCloseTo(w.x, 3);
      expect(b.z).toBeCloseTo(w.z, 3);
      expect(b.y).toBeGreaterThan(3);
      if (t === AT_SEA + 20000) expect(Math.hypot(b.x - BOARD_SPOT.x, b.z - BOARD_SPOT.z)).toBeGreaterThan(50);
    }
    await a.leave();
  });

  it('others see a rider in deck coordinates (flag 8)', async () => {
    const { a, room } = await aboard('Kaptan');
    const b = await new NetBot(endpoint).join(a.room.roomId, { name: 'Bakan' });
    vt = AT_SEA;
    const deck = room.debugDeck(a.id)!;
    await until(() => b.messages.some((m) => m.type === MSG.snapshot && (m.msg as SnapshotMsg).p.some((p) => p[0] === a.id && p[5] === 8)));
    const snap = b.messages.filter((m) => m.type === MSG.snapshot).pop()!.msg as SnapshotMsg;
    const ps = snap.p.find((p) => p[0] === a.id)!;
    expect(ps[1]).toBeCloseTo(deck.x, 1);
    expect(ps[3]).toBeCloseTo(deck.z, 1);
    await a.leave();
    await b.leave();
  });

  it('walks on the deck (input in the deck frame) but never off it', async () => {
    const { a, room } = await aboard('Gezen');
    vt = AT_SEA;
    const start = room.debugDeck(a.id)!;
    for (let s = 1; s <= 120; s++) a.room.send(MSG.input, { s, mx: 0, mz: 1, j: 0, c: 0, y: 0 });
    await until(() => room.debugDeck(a.id)!.z !== start.z, 3000);
    await sleep(300);
    for (let s = 121; s <= 400; s++) a.room.send(MSG.input, { s, mx: 1, mz: 0, j: 0, c: 0, y: 0 });
    await sleep(1500);
    const d = room.debugDeck(a.id)!;
    expect(onDeck(d.x, d.z)).toBe(true);
    expect(d.x).toBeGreaterThan(start.x);
    await a.leave();
  });

  it('gets off only while docked, back onto the pier', async () => {
    const { a, room } = await aboard('İnen');
    vt = AT_SEA;
    await sleep(60);
    a.room.send(KMSG.alight);
    await until(() => errors(a).some((e) => /yanaşınca inebilirsin/.test(e)));
    expect(me(a).aboard).toBe(true);
    // the next call at the pier
    vt = VAPUR_CYCLE_MS + 2000;
    await sleep(60);
    a.room.send(KMSG.alight);
    await until(() => me(a).aboard === false);
    await until(() => a.messages.some((m) => m.type === MSG.teleport));
    const b = room.debugBody(a.id)!;
    expect(b.x).toBeCloseTo(BOARD_SPOT.x, 3);
    expect(b.z).toBeCloseTo(BOARD_SPOT.z, 3);
    expect(room.debugDeck(a.id)).toBeNull();
    await a.leave();
  });

  it('a rider who drops is put back on the pier', async () => {
    const { a, room } = await aboard('Kopan');
    const watcher = await new NetBot(endpoint).join(a.room.roomId, { name: 'Gözcü' });
    await until(() => st(watcher).players?.get(a.id)?.aboard === true);
    vt = AT_SEA;
    await sleep(60);
    await a.leave(false);
    await until(() => st(watcher).players.get(a.id)?.connected === false);
    expect(st(watcher).players.get(a.id).aboard).toBe(false);
    const b = room.debugBody(a.id)!;
    expect(b.x).toBeCloseTo(BOARD_SPOT.x, 3);
    expect(b.z).toBeCloseTo(BOARD_SPOT.z, 3);
    await watcher.leave();
  });

  it('the vapur çaycısı sells only on board, the kahve çaycı cannot reach the boat, gulls can be fed from the deck', async () => {
    vt = DOCKED;
    const { a: shore } = await atPier('Karada');
    shore.room.send(KMSG.buy, { shop: 'vapur', item: 'cay' });
    await until(() => errors(shore).length > 0);
    expect(me(shore).holding).toBe('');
    const { a } = await aboard('Çaysever');
    a.room.send(KMSG.buy, { shop: 'vapur', item: 'cay' });
    await until(() => me(a).holding === 'cay');
    expect(me(a).money).toBe(START_MONEY - 5);
    a.room.send(KMSG.order, { item: 'cay', to: a.id });
    await until(() => errors(a).some((e) => /vapura yetişemez/.test(e)));
    await sleep(700);
    a.room.send(KMSG.buy, { shop: 'vapur', item: 'simit' });
    await until(() => me(a).holding === 'simit');
    // feeding gulls from the deck works (the simit is used)
    a.room.send(KMSG.use);
    await until(() => me(a).uses === 3);
    await a.leave();
    await shore.leave();
  });
});
