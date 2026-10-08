import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { NetBot } from './netBot';
import { KAHVE_ROOM, KMSG, MSG, QUICK_CHAT_OKEY, SPECTATOR_LIMIT, TABLES, TAVLA_TABLES, type HandReplayMsg, type OkeyEventMsg } from '@sokak/shared';
import { startServer, type StartedServer } from '../src/app';
import { until, sleep } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  // a short turn timer: the seated human is auto-played, so hands finish quickly
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 200, result: 400, turn: 150 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const table = (b: NetBot, i: number) => st(b).tables[i];
const errors = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.okeyError).map((m) => m.msg as string);

async function join(name: string) {
  const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name });
  await until(() => !!st(a).players?.get(a.id));
  const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
  return { a, room };
}

/** A human at table `ti` with three bots, match running. */
async function botMatch(name: string, ti: number, hands: number) {
  const { a, room } = await join(name);
  room.debugPlace(a.id, TABLES[ti]!.x, TABLES[ti]!.z + 2);
  await sleep(80);
  a.room.send(KMSG.sit, { table: ti, seat: 0 });
  await until(() => me(a).table === ti);
  a.room.send(KMSG.tableConfig, { hands });
  await until(() => table(a, ti).hands === hands);
  a.room.send(KMSG.fillBots);
  await until(() => table(a, ti).status === 'playing');
  return { a, room };
}

async function spectator(name: string, room: KahvehaneRoom, ti: number) {
  const { a: s } = await join(name);
  room.debugPlace(s.id, TABLES[ti]!.x + 2, TABLES[ti]!.z);
  await sleep(80);
  return s;
}

describe('seyirci (kibitzer) mode', () => {
  it('a spectator watches a running bot match: table updates, never a hand; chats; leaves with Kalk or by walking away', async () => {
    const { a, room } = await botMatch('Oyuncu', 5, 9);
    const s = await spectator('Seyirci', room, 5);
    s.room.send(KMSG.watch, { kind: 'okey', table: 5 });
    await until(() => me(s).watch === 5);
    // standing at a corner behind the table, facing it
    const b = room.debugBody(s.id)!;
    const d = Math.hypot(b.x - TABLES[5]!.x, b.z - TABLES[5]!.z);
    expect(d).toBeGreaterThan(1.3);
    expect(d).toBeLessThan(2.2);
    // public table updates keep coming
    const seen = new Set<string>();
    await until(() => (seen.add(table(s, 5).view), seen.size >= 4), 10000);
    // kibitzing: a spectator line reaches the players
    const q = QUICK_CHAT_OKEY.indexOf('Okey sende mi?');
    s.room.send(MSG.chat, q);
    await until(() => a.messages.some((m) => m.type === MSG.chat && (m.msg as { id: string }).id === s.id && (m.msg as { q: number }).q === q));
    // Kalk
    s.room.send(KMSG.unwatch);
    await until(() => me(s).watch === -1);
    // watch again, then walk away
    s.room.send(KMSG.watch, { kind: 'okey', table: 5 });
    await until(() => me(s).watch === 5);
    room.debugPlace(s.id, TABLES[5]!.x + 8, TABLES[5]!.z);
    await until(() => me(s).watch === -1);
    // hidden information never reached the spectator: no hand, no rack in any event
    expect(s.messages.some((m) => m.type === KMSG.hand)).toBe(false);
    for (const m of s.messages.filter((x) => x.type === KMSG.okeyEvent)) expect((m.msg as OkeyEventMsg).e).not.toHaveProperty('hands');
    expect(a.messages.some((m) => m.type === KMSG.hand)).toBe(true);
    await s.leave();
    await a.leave();
  });

  it('cannot watch an open table or from across the room', async () => {
    const { a, room } = await join('Uzaktan');
    room.debugPlace(a.id, TABLES[9]!.x + 2, TABLES[9]!.z);
    await sleep(80);
    a.room.send(KMSG.watch, { kind: 'okey', table: 9 });
    await until(() => errors(a).length === 1);
    room.debugPlace(a.id, 11, -8);
    await sleep(80);
    a.room.send(KMSG.watch, { kind: 'okey', table: 0 });
    await sleep(150);
    expect(me(a).watch).toBe(-1);
    await a.leave();
  });

  it(`at most ${SPECTATOR_LIMIT} spectators per table`, async () => {
    const { a, room } = await botMatch('Ev sahibi', 6, 9);
    const crowd: NetBot[] = [];
    for (let i = 0; i < SPECTATOR_LIMIT; i++) {
      const s = await spectator(`Seyirci ${i + 1}`, room, 6);
      s.room.send(KMSG.watch, { kind: 'okey', table: 6 });
      await until(() => me(s).watch === 6);
      crowd.push(s);
    }
    const late = await spectator('Geç kalan', room, 6);
    late.room.send(KMSG.watch, { kind: 'okey', table: 6 });
    await until(() => errors(late).length > 0);
    expect(errors(late)[0]).toContain('dolu');
    expect(me(late).watch).toBe(-1);
    // one leaves, the late one gets in
    await crowd.pop()!.leave();
    late.room.send(KMSG.watch, { kind: 'okey', table: 6 });
    await until(() => me(late).watch === 6);
    for (const s of [...crowd, late, a]) await s.leave();
  });

  it('tavla: a spectator gets the board and stops watching when the match closes', async () => {
    const { a, room } = await join('Tavlaci');
    room.debugPlace(a.id, TAVLA_TABLES[1]!.x, TAVLA_TABLES[1]!.z + 1.2);
    await sleep(80);
    a.room.send(KMSG.tavlaSit, { table: 1, seat: 0 });
    await until(() => me(a).tavla === 1);
    a.room.send(KMSG.fillBots);
    await until(() => st(a).tavla[1].status === 'playing');
    const { a: s } = await join('Tavla seyircisi');
    room.debugPlace(s.id, TAVLA_TABLES[1]!.x + 1.5, TAVLA_TABLES[1]!.z);
    await sleep(80);
    s.room.send(KMSG.watch, { kind: 'tavla', table: 1 });
    await until(() => me(s).watchTavla === 1);
    expect(me(s).watch).toBe(-1);
    expect(st(s).tavla[1].view).not.toBe('');
    // the last human leaves: the table closes and the spectator steps back
    a.room.send(KMSG.stand);
    await until(() => st(s).tavla[1].status === 'open');
    await until(() => me(s).watchTavla === -1);
    await s.leave();
    await a.leave();
  });

  it('el sonu tekrarı: the hand-end replay reaches players and spectators with public info only', async () => {
    const { a, room } = await botMatch('Kazanan', 8, 1);
    const s = await spectator('Izleyici', room, 8);
    s.room.send(KMSG.watch, { kind: 'okey', table: 8 });
    await until(() => me(s).watch === 8);
    const { a: by } = await join('Gelip gecen');
    await until(() => a.messages.some((m) => m.type === KMSG.replay), 60000);
    const r = a.messages.find((m) => m.type === KMSG.replay)!.msg as HandReplayMsg;
    await until(() => s.messages.some((m) => m.type === KMSG.replay));
    expect(s.messages.find((m) => m.type === KMSG.replay)!.msg).toEqual(r);
    // somebody elsewhere in the salon does not get it
    await sleep(100);
    expect(by.messages.some((m) => m.type === KMSG.replay)).toBe(false);
    expect(r.table).toBe(8);
    expect(r.handNo).toBe(1);
    expect(r.moves.length).toBeGreaterThan(0);
    expect(r.moves.length).toBeLessThanOrEqual(12);
    expect(Object.keys(r).sort()).toEqual(['finisher', 'gosterge', 'handNo', 'melds', 'moves', 'okey', 'okeyFinish', 'table']);
    // deck draws never carry the tile; the melds are the finisher's own (already on the table)
    for (const m of r.moves) if (m.k === 'draw' && m.from === 'deck') expect(m).not.toHaveProperty('tile');
    const g = room.debugGame(8);
    if (r.finisher !== null) {
      expect(r.melds.length).toBeGreaterThan(0);
      for (const m of r.melds) expect(m.owner).toBe(r.finisher);
      // the losers' racks are nowhere in the message
      const losers = g ? g.hands.filter((_, i) => i !== r.finisher).flat() : [];
      const meldTiles = new Set(r.melds.flatMap((m) => m.tiles));
      for (const t of losers) expect(meldTiles.has(t)).toBe(false);
    } else expect(r.melds).toEqual([]);
    expect(r.moves.some((m) => m.k === 'discard')).toBe(true);
    // the room-wide hand-end event carries the result only
    const he = s.messages.map((m) => m.msg as OkeyEventMsg).find((m) => m?.e?.type === 'handEnd');
    expect(he?.e).not.toHaveProperty('hands');
    expect(s.messages.some((m) => m.type === KMSG.hand)).toBe(false);
    for (const c of [s, by, a]) await c.leave();
  }, 70000);
});
