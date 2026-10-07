import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { matchMaker } from '@colyseus/core';
import { BAR, legalMovesFor, type Side, type TavlaView } from '@sokak/tavla';
import { KAHVE_ROOM, KMSG, START_MONEY, TAVLA_COUNT, TAVLA_TABLES, tavlaSeatPosition } from '@sokak/shared';
import { NetBot } from './netBot';
import { startServer, type StartedServer } from '../src/app';
import { sleep, until } from './helpers';
import type { KahvehaneRoom } from '../src/rooms/KahvehaneRoom';

let server: StartedServer;
let endpoint: string;

beforeAll(async () => {
  // long turn timer: nobody gets auto-played unless the test wants it
  server = await startServer(0, { host: '127.0.0.1', kahve: { timing: { botMin: 5, botMax: 15, between: 150, result: 250, turn: 30000 } } });
  endpoint = `ws://127.0.0.1:${server.port}`;
});
afterAll(async () => {
  await server.close();
});

const st = (b: NetBot) => b.room.state as any;
const me = (b: NetBot) => st(b).players.get(b.id);
const tavla = (b: NetBot, i: number) => st(b).tavla[i];
const view = (b: NetBot, i: number) => JSON.parse(tavla(b, i).view || 'null') as TavlaView | null;
const errors = (b: NetBot) => b.messages.filter((m) => m.type === KMSG.okeyError).map((m) => m.msg as string);

async function join(name: string) {
  const a = await new NetBot(endpoint).joinOrCreate(KAHVE_ROOM, { name });
  await until(() => !!st(a).players?.get(a.id));
  const room = matchMaker.getLocalRoomById(a.room.roomId) as KahvehaneRoom;
  return { a, room };
}

async function sitAt(a: NetBot, room: KahvehaneRoom, ti: number, seat: number) {
  const sp = tavlaSeatPosition(ti, seat);
  room.debugPlace(a.id, sp.x, sp.z + (seat === 0 ? 0.6 : -0.6));
  await sleep(80);
  a.room.send(KMSG.tavlaSit, { table: ti, seat });
  await until(() => me(a).tavla === ti);
}

/** Play my side with the first legal move each time it is my turn (a lazy but legal client). */
function autoPlay(a: NetBot, ti: number): () => void {
  let last = '';
  const iv = setInterval(() => {
    const t = tavla(a, ti);
    const p = me(a);
    if (!t || !p || p.tavla !== ti || t.status !== 'playing' || !t.view) return;
    if (t.view === last) return;
    const v = JSON.parse(t.view) as TavlaView;
    if (v.turn !== p.seat || v.phase === 'ended') return;
    last = t.view;
    if (v.phase === 'roll') return a.room.send(KMSG.tavla, { t: 'roll' });
    const legal = legalMovesFor({ board: v.board, bar: v.bar, off: v.off }, v.turn as Side, v.dice);
    if (legal.length) a.room.send(KMSG.tavla, { t: 'move', from: legal[0]!.from, to: legal[0]!.to });
    else a.room.send(KMSG.tavla, { t: 'end' });
  }, 20);
  return () => clearInterval(iv);
}

describe('tavla tables', () => {
  it('there are at least 4 tavla tables with 2 seats each', async () => {
    const { a } = await join('Tavlaci');
    expect(TAVLA_COUNT).toBeGreaterThanOrEqual(4);
    expect(st(a).tavla.length).toBe(TAVLA_COUNT);
    expect([...tavla(a, 0).seats]).toEqual(['', '']);
    await a.leave();
  });

  it('cannot sit from across the room; near the table you sit and become host', async () => {
    const { a, room } = await join('Uzakci');
    room.debugPlace(a.id, TAVLA_TABLES[1]!.x + 6, TAVLA_TABLES[1]!.z - 6);
    await sleep(80);
    a.room.send(KMSG.tavlaSit, { table: 1 });
    await until(() => errors(a).length > 0);
    expect(me(a).tavla).toBe(-1);
    await sitAt(a, room, 1, 0);
    expect(tavla(a, 1).hostId).toBe(a.id);
    expect(me(a).seat).toBe(0);
    // seated at tavla: okey seating is refused
    a.room.send(KMSG.quickSeat, {});
    await sleep(150);
    expect(me(a).table).toBe(-1);
    a.room.send(KMSG.stand);
    await until(() => me(a).tavla === -1);
    expect([...tavla(a, 1).seats]).toEqual(['', '']);
    await a.leave();
  });

  it('two people: out-of-turn and illegal moves are rejected, legal ones applied, undo works', async () => {
    const { a, room } = await join('Beyaz');
    const { a: b } = await join('Siyah');
    await sitAt(a, room, 2, 0);
    await sitAt(b, room, 2, 1);
    a.room.send(KMSG.tableConfig, { bet: 10, points: 3 });
    await until(() => tavla(a, 2).bet === 10 && tavla(a, 2).target === 3);
    // only the host configures
    b.room.send(KMSG.tableConfig, { bet: 250 });
    a.room.send(KMSG.tableStart);
    await until(() => tavla(a, 2).status === 'playing' && !!tavla(a, 2).view);
    expect(tavla(a, 2).bet).toBe(10);
    expect(tavla(a, 2).pot).toBe(20);
    expect(me(a).money).toBe(START_MONEY - 10);
    const v = view(a, 2)!;
    // the opening roll: the starter plays both opening dice
    expect(v.phase).toBe('move');
    expect(v.opening![0]).not.toBe(v.opening![1]);
    expect(v.turn).toBe(v.opening![0] > v.opening![1] ? 0 : 1);
    const mover = v.turn === 0 ? a : b;
    const other = v.turn === 0 ? b : a;
    const before = errors(other).length;
    other.room.send(KMSG.tavla, { t: 'roll' });
    other.room.send(KMSG.tavla, { t: 'move', from: 12, to: 9 });
    await until(() => errors(other).length >= before + 2);
    expect(errors(other).at(-1)).toMatch(/Sıra sende değil/);
    // illegal: a white checker can't go backwards / to a blocked point
    const e0 = errors(mover).length;
    mover.room.send(KMSG.tavla, { t: 'move', from: v.turn === 0 ? 5 : 18, to: v.turn === 0 ? 11 : 12 });
    mover.room.send(KMSG.tavla, { t: 'move', from: BAR, to: 3 });
    mover.room.send(KMSG.tavla, { t: 'move', from: 'x', to: null });
    await until(() => errors(mover).length >= e0 + 3);
    expect(view(a, 2)!.board).toEqual(v.board);
    // a legal move is applied, undo restores it
    const legal = legalMovesFor({ board: v.board, bar: v.bar, off: v.off }, v.turn, v.dice);
    mover.room.send(KMSG.tavla, { t: 'move', from: legal[0]!.from, to: legal[0]!.to });
    await until(() => view(a, 2)!.moved.length === 1);
    expect(view(a, 2)!.board).not.toEqual(v.board);
    expect(view(a, 2)!.dice.length).toBe(1);
    // the turn can't be passed with dice left
    mover.room.send(KMSG.tavla, { t: 'end' });
    mover.room.send(KMSG.tavla, { t: 'undo' });
    await until(() => view(a, 2)!.moved.length === 0);
    expect(view(a, 2)!.board).toEqual(v.board);
    expect(view(a, 2)!.turn).toBe(v.turn);
    // everybody in the room hears about the moves
    expect(b.messages.some((m) => m.type === KMSG.tavlaEvent && (m.msg as { e: { type: string } }).e.type === 'moved')).toBe(true);
    // standing up mid-match: a bot takes the seat and the game goes on
    other.room.send(KMSG.stand);
    await until(() => me(other).tavla === -1);
    const seatOther = v.turn === 0 ? 1 : 0;
    const botId = tavla(a, 2).seats[seatOther];
    expect(st(a).players.get(botId).isBot).toBe(true);
    await a.leave();
    await b.leave();
  });

  it('a full match against a bot: pot to the winner, money conserved, the match counts', async () => {
    const { a, room } = await join('Mahalle');
    await sitAt(a, room, 0, 0);
    a.room.send(KMSG.tableConfig, { bet: 100, points: 1 });
    a.room.send(KMSG.tableBot, {});
    await until(() => [...tavla(a, 0).seats].every(Boolean) && tavla(a, 0).bet === 100);
    const botId = tavla(a, 0).seats[1];
    expect(st(a).players.get(botId).isBot).toBe(true);
    const stop = autoPlay(a, 0);
    a.room.send(KMSG.tableStart);
    await until(() => tavla(a, 0).status === 'playing');
    expect(tavla(a, 0).pot).toBe(200);
    try {
      await until(() => tavla(a, 0).status === 'result' || !!tavla(a, 0).lastMatch, 60000);
    } finally {
      stop();
    }
    const res = JSON.parse(tavla(a, 0).lastMatch);
    expect([0, 1]).toContain(res.winner);
    expect(res.pot).toBe(200);
    expect(Math.max(...res.score)).toBeGreaterThanOrEqual(1);
    expect(res.payout[res.winner]).toBe(100);
    const mine = me(a).money;
    const bot = st(a).players.get(botId).money;
    expect(mine + bot).toBe(START_MONEY * 2);
    expect(mine).toBe(res.winner === 0 ? START_MONEY + 100 : START_MONEY - 100);
    await until(() => me(a).played === 1);
    expect(me(a).won).toBe(res.winner === 0 ? 1 : 0);
    // after the result the table opens again with the same people
    await until(() => tavla(a, 0).status === 'open');
    expect(tavla(a, 0).seats[0]).toBe(a.id);
    // the stats count tavla too
    const stats = (await (await fetch(`http://127.0.0.1:${server.port}/stats`)).json()) as Record<string, number>;
    expect(stats.tavlaMatchesStarted).toBeGreaterThanOrEqual(1);
    expect(stats.tavlaGamesPlayed).toBeGreaterThanOrEqual(1);
    await a.leave();
  }, 70000);

  it('"Botlarla başla" fills the seat; a player who does nothing is played on time-out', async () => {
    const { a, room } = await join('Sabirsiz');
    const timing = (room.constructor as typeof KahvehaneRoom).timing;
    const turn = timing.turn;
    timing.turn = 300;
    try {
      await sitAt(a, room, 3, 1);
      a.room.send(KMSG.fillBots);
      await until(() => tavla(a, 3).status === 'playing');
      expect(room.debugTavla(3)).not.toBeNull();
      const timedOut = () => a.messages.some((m) => m.type === KMSG.tavlaEvent && (m.msg as { table: number; e: { type: string; seat: number } }).table === 3 && (m.msg as { e: { type: string } }).e.type === 'timeout');
      await until(timedOut, 8000);
    } finally {
      timing.turn = turn;
    }
    // leaving mid-match hands the seat to a bot; with no people left the table closes
    a.room.send(KMSG.stand);
    await until(() => me(a).tavla === -1);
    await until(() => tavla(a, 3).status === 'open' && [...tavla(a, 3).seats].every((s: string) => !s));
    await a.leave();
  });
});
